import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { acceptInvite, previewGroupInvite } from "@/lib/groups";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/join/$code")({
  head: () => ({
    meta: [
      { title: "Join a RIZZ group" },
      { name: "description", content: "Join your friends in a RIZZ group chat." },
      { property: "og:title", content: "Join a RIZZ group" },
      { property: "og:description", content: "Open your group invitation and join the conversation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JoinPage,
});

const PENDING_INVITE_KEY = "rizz:pending-group-invite";

function JoinPage() {
  const { code } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const autoJoinStarted = useRef(false);
  const invite = useQuery({
    queryKey: ["group-invite-preview", code],
    queryFn: () => previewGroupInvite(code),
    retry: false,
  });
  const join = useMutation({
    mutationFn: () => acceptInvite(code),
    onSuccess: (group) => {
      try { window.sessionStorage.removeItem(PENDING_INVITE_KEY); } catch { /* optional */ }
      toast.success(`Joined ${group?.name ?? "group"}`);
      if (group?.id) nav({ to: "/g/$id", params: { id: group.id } });
      else nav({ to: "/groups" });
    },
    onError: (error: Error) => {
      const text = error.message.toLowerCase();
      const message = text.includes("blocked")
        ? "You can’t join this group because it includes someone you’ve blocked."
        : text.includes("expired")
          ? "This invite has expired. Ask a group member for a new link."
          : text.includes("already")
            ? "You’re already a member of this group."
            : text.includes("use limit") || text.includes("max_uses")
              ? "This invite has reached its use limit."
              : text.includes("revoked") || text.includes("invalid") || text.includes("not found")
                ? "This invite was revoked or is invalid. Ask for a new link."
                : error.message;
      toast.error(message);
    },
  });
  const joinInvite = join.mutate;

  useEffect(() => {
    if (!user || autoJoinStarted.current) return;
    let pending = false;
    try {
      pending = window.sessionStorage.getItem(PENDING_INVITE_KEY) === code;
    } catch { /* optional */ }
    if (pending && invite.data?.status === "already_member" && invite.data.group_id) {
      autoJoinStarted.current = true;
      try { window.sessionStorage.removeItem(PENDING_INVITE_KEY); } catch { /* optional */ }
      nav({ to: "/g/$id", params: { id: invite.data.group_id } });
    } else if (pending && invite.data?.status === "valid") {
      autoJoinStarted.current = true;
      joinInvite();
    } else if (
      pending &&
      ["expired", "limit_reached", "revoked_or_invalid"].includes(invite.data?.status ?? "")
    ) {
      try { window.sessionStorage.removeItem(PENDING_INVITE_KEY); } catch { /* optional */ }
    }
  }, [code, invite.data, user, nav, joinInvite]);

  const signInToJoin = () => {
    try { window.sessionStorage.setItem(PENDING_INVITE_KEY, code); } catch { /* optional */ }
    nav({ to: "/login" });
  };

  const group = invite.data;
  const canJoin = group?.status === "valid";
  const alreadyMember = group?.status === "already_member";
  const statusMessage = group?.status === "expired"
    ? "This invite has expired. Ask a group member for a new link."
    : group?.status === "revoked_or_invalid"
      ? "This invite was revoked or is invalid. Ask for a new link."
      : group?.status === "limit_reached"
        ? "This invite has reached its use limit."
        : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-4 py-10">
      <section className="w-full rounded-3xl border border-white/10 bg-card/80 p-6 text-center shadow-glow-lg backdrop-blur-xl">
        <Link to="/feed" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to RIZZ
        </Link>
        {invite.isLoading ? (
          <div role="status" className="py-8 text-sm text-muted-foreground">Checking this invite…</div>
        ) : invite.isError ? (
          <div className="py-5">
            <h1 className="text-xl font-bold">Invite details are unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Group invite previews need a small Lovable backend update. See BACKEND_REQUIREMENTS.md.
            </p>
            <Button onClick={() => void invite.refetch()} variant="outline" className="mt-5">Try again</Button>
          </div>
        ) : group?.group_id ? (
          <>
            <Avatar className="mx-auto mb-4 h-20 w-20 ring-2 ring-[var(--rizz-pink)]/50">
              <AvatarImage src={group.icon_url ?? undefined} />
              <AvatarFallback className="bg-gradient-primary text-2xl font-bold">
                {group.group_name?.charAt(0).toUpperCase() ?? "G"}
              </AvatarFallback>
            </Avatar>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--rizz-pink)]">Group invitation</p>
            <h1 className="mt-2 text-2xl font-extrabold">{group.group_name}</h1>
            {group.topic && <p className="mt-2 text-sm text-muted-foreground">{group.topic}</p>}
            <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" /> {group.member_count} member{group.member_count === 1 ? "" : "s"}
            </p>
            {statusMessage && <p role="alert" className="mt-4 text-sm text-destructive">{statusMessage}</p>}
            {alreadyMember && <p className="mt-4 text-sm text-muted-foreground">You’re already a member of this group.</p>}
            {canJoin && (user ? (
              <Button onClick={() => join.mutate()} disabled={join.isPending} className="mt-6 w-full bg-gradient-primary">
                {join.isPending ? "Joining…" : "Join group"}
              </Button>
            ) : (
              <Button onClick={signInToJoin} className="mt-6 w-full bg-gradient-primary">Log in to join</Button>
            ))}
            {alreadyMember && user && (
              <Button onClick={() => nav({ to: "/g/$id", params: { id: group.group_id! } })} className="mt-6 w-full bg-gradient-primary">
                Open group
              </Button>
            )}
          </>
        ) : (
          <div className="py-5">
            <h1 className="text-xl font-bold">Invite not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">{statusMessage ?? "Ask a group member for a new invite link."}</p>
          </div>
        )}
      </section>
    </main>
  );
}