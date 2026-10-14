import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Hash, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { acceptRealmInvite, previewRealmInvite } from "@/lib/realms";
import { PENDING_REALM_INVITE_KEY } from "@/lib/onboarding";
import { Button } from "@/components/ui/button";

/**
 * /join-realm/<code> — the realm invite, for signed-in and signed-out visitors
 * alike, which is why it lives outside the app shell. Previewing an invite is
 * allowed for anonymous callers, accepting it is not: a signed-out visitor is
 * remembered here and sent to log in, and the login page brings them right back.
 */
export const Route = createFileRoute("/join-realm/$code")({
  head: () => ({
    meta: [
      { title: "Join a realm · RIZZ" },
      { name: "description", content: "Open your RIZZ realm invitation and join the conversation." },
      { property: "og:title", content: "Join a RIZZ realm" },
      { property: "og:description", content: "Open your realm invitation and join the conversation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JoinRealmPage,
});

function JoinRealmPage() {
  const { code } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const autoJoinStarted = useRef(false);

  const invite = useQuery({
    queryKey: ["realm-invite-preview", code],
    queryFn: () => previewRealmInvite(code),
    retry: false,
  });

  const openRealm = async (realmId: string) => {
    const { data } = await supabase.from("realms").select("slug").eq("id", realmId).maybeSingle();
    const slug = (data as { slug?: string | null } | null)?.slug;
    if (slug) nav({ to: "/r/$slug", params: { slug } });
    else nav({ to: "/realms" });
  };

  const join = useMutation({
    mutationFn: () => acceptRealmInvite(code),
    onSuccess: (realmId) => {
      try { window.sessionStorage.removeItem(PENDING_REALM_INVITE_KEY); } catch { /* optional */ }
      toast.success(`Joined ${invite.data?.realm_name ?? "the realm"}`);
      void openRealm(realmId);
    },
    onError: (error: Error) => {
      const text = error.message.toLowerCase();
      const message = text.includes("banned")
        ? "You're banned from this realm, so this invite won't work."
        : text.includes("expired")
          ? "This invite has expired. Ask for a new one."
          : text.includes("limit")
            ? "This invite has reached its use limit."
            : text.includes("already")
              ? "You're already a member of this realm."
              : error.message;
      toast.error(message);
    },
  });
  const joinInvite = join.mutate;

  // Someone who followed the link while signed out lands back here after login:
  // finish what they started instead of showing them the button again.
  useEffect(() => {
    if (!user || autoJoinStarted.current || !invite.data) return;
    let pending = false;
    try {
      pending = window.sessionStorage.getItem(PENDING_REALM_INVITE_KEY) === code;
    } catch { /* optional */ }
    if (!pending) return;

    if (invite.data.status === "already_member" && invite.data.realm_id) {
      autoJoinStarted.current = true;
      try { window.sessionStorage.removeItem(PENDING_REALM_INVITE_KEY); } catch { /* optional */ }
      void openRealm(invite.data.realm_id);
    } else if (invite.data.status === "valid") {
      autoJoinStarted.current = true;
      joinInvite();
    } else if (["expired", "limit_reached", "invalid"].includes(invite.data.status)) {
      try { window.sessionStorage.removeItem(PENDING_REALM_INVITE_KEY); } catch { /* optional */ }
    }
  }, [code, invite.data, user, joinInvite]);

  const signInToJoin = () => {
    try { window.sessionStorage.setItem(PENDING_REALM_INVITE_KEY, code); } catch { /* optional */ }
    nav({ to: "/login" });
  };

  const preview = invite.data;
  const canJoin = preview?.status === "valid";
  const alreadyMember = preview?.status === "already_member";
  const statusMessage = preview?.status === "expired"
    ? "This invite has expired. Ask the realm owner for a new one."
    : preview?.status === "limit_reached"
      ? "This invite has reached its use limit."
      : preview?.status === "banned"
        ? "You're banned from this realm."
        : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-4 py-10">
      <section className="w-full rounded-3xl border border-white/10 glass-strong p-6 text-center shadow-lg">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to RIZZ
        </Link>

        {invite.isLoading || authLoading ? (
          <p role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking this invite…
          </p>
        ) : invite.isError ? (
          <div className="py-5">
            <h1 className="font-display text-xl font-bold">Invite details are unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">Try again in a moment, or ask for a fresh link.</p>
            <Button variant="outline" className="glass mt-5 border-white/10" onClick={() => void invite.refetch()}>
              Try again
            </Button>
          </div>
        ) : preview?.realm_id ? (
          <>
            <span className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-md">
              <Hash className="h-9 w-9 text-white" />
            </span>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Realm invitation</p>
            <h1 className="mt-2 font-display text-2xl font-extrabold">{preview.realm_name ?? "A realm"}</h1>
            {preview.topic && <p className="mt-2 text-sm text-muted-foreground">{preview.topic}</p>}
            <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" /> {preview.member_count} member{preview.member_count === 1 ? "" : "s"}
            </p>

            {statusMessage && <p role="alert" className="mt-4 text-sm text-destructive">{statusMessage}</p>}
            {alreadyMember && <p className="mt-4 text-sm text-muted-foreground">You're already in this realm.</p>}

            {canJoin && (user ? (
              <Button
                onClick={() => join.mutate()}
                disabled={join.isPending}
                className="mt-6 h-11 w-full border-0 bg-primary text-primary-foreground shadow-md"
              >
                {join.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join realm"}
              </Button>
            ) : (
              <Button
                onClick={signInToJoin}
                className="mt-6 h-11 w-full border-0 bg-primary text-primary-foreground shadow-md"
              >
                Log in to join
              </Button>
            ))}

            {alreadyMember && (
              <Button
                onClick={() => void openRealm(preview.realm_id!)}
                className="mt-6 h-11 w-full border-0 bg-primary text-primary-foreground shadow-md"
              >
                Open realm
              </Button>
            )}
          </>
        ) : (
          <div className="py-5">
            <h1 className="font-display text-xl font-bold">Invite not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {statusMessage ?? "This link isn't valid. Ask the realm owner for a new invite."}
            </p>
            <Button asChild variant="outline" className="glass mt-5 border-white/10">
              <Link to="/realms">Browse realms</Link>
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}
