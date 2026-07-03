import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { AuthCard } from "@/components/AuthCard";
import { AuthErrorBanner, classifyAuthError, type AuthErrorKind } from "@/components/AuthErrorBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({ meta: [{ title: "Join RIZZ" }] }),
});

function SignupPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errKind, setErrKind] = useState<AuthErrorKind | null>(null);
  const [errMsg, setErrMsg] = useState<string>("");

  useEffect(() => { if (user) nav({ to: "/feed" }); }, [user, nav]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return toast.error("Username: 3–20 chars, letters/numbers/underscore");
    setLoading(true);
    setErrKind(null);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin + "/feed", data: { username, display_name: username } },
    });
    setLoading(false);
    if (error) {
      const kind = classifyAuthError(error.message);
      setErrKind(kind);
      setErrMsg(error.message);
      if (kind !== "network" && kind !== "rate_limit") toast.error(error.message);
      return;
    }
    toast.success("You're in. Welcome to RIZZ.");
    nav({ to: "/feed" });
  };

  const onGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/feed" });
    if (result.error) {
      const msg = (result.error as Error).message ?? "Google sign-in failed";
      const kind = classifyAuthError(msg);
      setErrKind(kind);
      setErrMsg(msg);
      if (kind !== "network" && kind !== "rate_limit") toast.error(msg);
    }
  };

  return (
    <AuthCard
      title="Claim your @"
      subtitle="Free forever. Pick a username, drop in."
      footer={<>Already have an account? <Link to="/login" className="text-[var(--rizz-pink)] hover:underline font-medium">Log in</Link></>}
    >
      <Button type="button" onClick={onGoogle} variant="outline" className="w-full glass border-white/10 hover:bg-white/5 h-11">Continue with Google</Button>
      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />OR<div className="h-px flex-1 bg-border" /></div>
      {errKind && (
        <AuthErrorBanner
          kind={errKind}
          rawMessage={errMsg}
          onRetry={() => { setErrKind(null); void onSubmit(new Event("submit") as unknown as React.FormEvent); }}
          retryLabel="Try creating account again"
        />
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
            <Input id="username" required value={username} onChange={(e) => setUsername(e.target.value)} className="h-11 pl-7 glass border-white/10" placeholder="yourname" />
          </div>
        </div>
        <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 glass border-white/10" /></div>
        <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 glass border-white/10" /></div>
        <Button type="submit" disabled={loading} className="w-full h-11 bg-gradient-primary border-0 shadow-glow hover:opacity-90">{loading ? "Creating…" : "Create account"}</Button>
      </form>
    </AuthCard>
  );
}