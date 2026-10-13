import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { randomDefaultAvatar } from "@/lib/default-avatars";
import { AuthCard } from "@/components/AuthCard";
import { AuthErrorBanner, classifyAuthError, type AuthErrorKind } from "@/components/AuthErrorBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { getPendingInvitePath, getPostAuthPath } from "@/lib/onboarding";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({ meta: [{ title: "Join RIZZ" }] }),
});

function SignupPage() {
  const nav = useNavigate();
  const { user, profile, loading: authLoading, profileError } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errKind, setErrKind] = useState<AuthErrorKind | null>(null);
  const [errMsg, setErrMsg] = useState<string>("");

  useEffect(() => {
    if (!user || authLoading || profileError) return;
    // A new account created from an invite link joins it straight away.
    const pendingInvite = getPendingInvitePath();
    if (pendingInvite) {
      window.location.replace(pendingInvite);
      return;
    }
    nav({ to: getPostAuthPath(profile) });
  }, [user, profile, authLoading, profileError, nav]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return toast.error("Username: 3–20 chars, letters/numbers/underscore");
    setLoading(true);
    setErrKind(null);
    const { error } = mode === "otp"
      ? await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true,
            data: { username, display_name: username, avatar_url: randomDefaultAvatar(username) },
          },
        })
      : await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: window.location.origin + "/feed",
          data: { username, display_name: username, avatar_url: randomDefaultAvatar(username) },
        },
      });
    setLoading(false);
    if (error) {
      const kind = classifyAuthError(error.message);
      setErrKind(kind);
      setErrMsg(error.message);
      if (kind !== "network" && kind !== "rate_limit") toast.error(error.message);
      return;
    }
    if (mode === "otp") {
      setOtpSent(true);
      toast.success("Code sent — check your email");
      return;
    }
    toast.success("You're in. Welcome to RIZZ.");
    nav({ to: "/" });
  };

  const verifyOtp = async () => {
    if (!email || !otp.trim()) return toast.error("Enter the code from your email");
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: otp.trim(), type: "email" });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("You're in. Welcome to RIZZ.");
    nav({ to: "/" });
  };

  return (
    <AuthCard
      title="Claim your @"
      subtitle="Choose your username to get started."
      footer={<>Already have an account? <Link to="/login" className="text-primary hover:underline font-medium">Log in</Link></>}
    >
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
            <Input id="username" required value={username} onChange={(e) => setUsername(e.target.value)} className="h-11 pl-7 bg-muted/30 border-border focus-visible:ring-primary" placeholder="yourname" />
          </div>
        </div>
        <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 bg-muted/30 border-border focus-visible:ring-primary" /></div>
        <div role="tablist" aria-label="Sign-in method" className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/60 p-1">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "password"}
            className={`h-9 rounded-md text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              mode === "password" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => { setMode("password"); setOtpSent(false); }}
          >
            Password
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "otp"}
            className={`h-9 rounded-md text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              mode === "otp" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setMode("otp")}
          >
            Email code
          </button>
        </div>
        {mode === "password" ? (
          <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 bg-muted/30 border-border focus-visible:ring-primary" /></div>
        ) : otpSent ? (
          <div className="space-y-2"><Label htmlFor="otp">Email code</Label><Input id="otp" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(e) => setOtp(e.target.value.slice(0, 8))} className="h-11 bg-muted/30 border-border tracking-[0.3em] focus-visible:ring-primary" placeholder="123456" /></div>
        ) : null}
        <Button
          type={mode === "otp" && otpSent ? "button" : "submit"}
          onClick={mode === "otp" && otpSent ? verifyOtp : undefined}
          disabled={loading}
          className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {loading ? "Please wait…" : mode === "otp" ? (otpSent ? "Verify code" : "Send email code") : "Create account"}
        </Button>
      </form>
    </AuthCard>
  );
}