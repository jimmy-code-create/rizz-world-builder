import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { acceptInvite } from "@/lib/groups";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/join/$code")({
  head: () => ({ meta: [{ title: "Join group · RIZZ" }] }),
  component: JoinPage,
});

function JoinPage() {
  const { code } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    (async () => {
      try {
        const g = await acceptInvite(code, user.id);
        toast.success(`Joined ${g?.name ?? "group"} ✨`);
        if (g?.id) nav({ to: "/g/$id", params: { id: g.id } });
        else nav({ to: "/groups" });
      } catch (e: any) {
        toast.error(e.message);
        nav({ to: "/groups" });
      }
    })();
  }, [code, user, loading, nav]);

  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="text-center">
        <div className="h-12 w-12 mx-auto rounded-full bg-gradient-primary animate-pulse-glow mb-3" />
        <p className="text-sm text-muted-foreground">Joining group…</p>
      </div>
    </div>
  );
}