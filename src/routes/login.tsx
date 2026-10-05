import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/AuthCard";
import { AuthErrorBanner, classifyAuthError, type AuthErrorKind } from "@/components/AuthErrorBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [{ title: "Log in — RIZZ" }, { name: "robots", content: "noindex, nofollow" }],
  }),
});

function LoginPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errKind, setErrKind] = useState<AuthErrorKind | null>(null);
  const [errMsg, setErrMsg] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    let pendingCode: string | null = null;
    try {
      pendingCode = window.sessionStorage.getItem("rizz:pending-group-invite");
    } catch {
      // A blocked session store should not stop a normal login.
    }
    if (pendingCode && /^[a-z0-9]{4,64}$/i.test(pendingCode)) {
      window.location.replace(`/join/${encodeURIComponent(pendingCode)}`);
      return;
    }
    nav({ to: "/feed" });
  }, [user, nav]);

  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrKind(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      const kind = classifyAuthError(error.message);
      setErrKind(kind);
      setErrMsg(error.message);
      if (kind !== "network" && kind !== "rate_limit") toast.error(error.message);
      return;
    }
    toast.success("Welcome back");
  };

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log into your world."
      footer={
        <>
          New here? <Link to="/signup" className="text-[var(--rizz-pink)] hover:underline font-medium">Create an account</Link>
        </>
      }
    >
      {errKind && (
        <AuthErrorBanner
          kind={errKind}
          rawMessage={errMsg}
          onRetry={() => { setErrKind(null); void onEmail(new Event("submit") as unknown as React.FormEvent); }}
          retryLabel="Try logging in again"
        />
      )}
      <form onSubmit={onEmail} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 glass border-white/10" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/reset-password" className="text-xs text-muted-foreground hover:text-foreground">Forgot?</Link>
          </div>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 glass border-white/10" />
        </div>
        <Button type="submit" disabled={loading} className="w-full h-11 bg-gradient-primary border-0 shadow-glow hover:opacity-90">
          {loading ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </AuthCard>
  );
}