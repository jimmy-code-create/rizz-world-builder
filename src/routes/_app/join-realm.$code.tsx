import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { acceptRealmInvite, previewRealmInvite } from "@/lib/realms";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/join-realm/$code")({
  head: () => ({ meta: [{ title: "Join realm · RIZZ" }] }),
  component: JoinRealmPage,
});

function JoinRealmPage() {
  const { code } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewRealmInvite>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await previewRealmInvite(code);
        if (!cancelled) setPreview(result);
      } catch {
        if (!cancelled) setPreview(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  const joinedRealm = async () => {
    if (!user) return;
    setJoining(true);
    try {
      const realmId = await acceptRealmInvite(code);
      toast.success("Realm joined!");
      const { data } = await import("@/integrations/supabase/client").then((m) =>
        m.supabase.from("realms").select("slug").eq("id", realmId).maybeSingle(),
      );
      nav({ to: data?.slug ? "/r/$slug" : "/realms", params: data?.slug ? { slug: data.slug } : {} });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't join with this invite");
    } finally {
      setJoining(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="glass rounded-3xl p-12 mt-8 max-w-md mx-auto text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-cyan-200" />
        <p className="mt-3 text-sm text-muted-foreground">Checking invite…</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-3xl p-8 mt-8 max-w-md mx-auto text-center">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        {preview?.status === "valid" && preview.realm_name ? (
          <>              <div className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center text-2xl">🧭</div>
            <h1 className="font-display text-2xl font-bold mt-4">You're invited to {preview.realm_name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{preview.topic || "No description"}</p>
            <p className="text-xs text-muted-foreground mt-1">{preview.member_count} members</p>
            {user ? (
              <Button onClick={joinedRealm} disabled={joining} className="mt-6 w-full bg-gradient-primary border-0 shadow-glow">
                {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join realm"}
              </Button>
            ) : (
              <Link to="/login">
                <Button className="mt-6 w-full bg-gradient-primary border-0 shadow-glow">Sign in to join</Button>
              </Link>
            )}
          </>
        ) : (
          <>
            <div className="mx-auto h-16 w-16 rounded-2xl glass flex items-center justify-center text-2xl">🕳️</div>
            <h1 className="font-display text-2xl font-bold mt-4">
              {preview?.status === "expired" && "Invite expired"}
              {preview?.status === "limit_reached" && "Invite used up"}
              {preview?.status === "banned" && "You are banned"}
              {preview?.status === "already_member" && "Already a member"}
              {!preview || preview.status === "invalid" ? "Invalid invite" : ""}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {preview?.status === "already_member"
                ? "You're already in this realm."
                : "This invite can't be used. Ask the realm owner for a new one."}
            </p>
            <Link to="/realms">
              <Button variant="outline" className="glass border-white/10 mt-6">Browse realms</Button>
            </Link>
          </>
        )}
      </motion.div>
    </div>
  );
}
