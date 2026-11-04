import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { randomDefaultAvatar } from "@/lib/default-avatars";
import { AuthCard } from "@/components/AuthCard";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  AuthErrorBanner,
  classifyAuthError,
  type AuthErrorKind,
} from "@/components/AuthErrorBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
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
    // New members meet Rizzy first, even when they arrived from an invite
    // link. The tour keeps the invite pending and hands them back afterwards.
    if (profile?.username && !profile.tutorial_seen) {
      nav({ to: "/tutorial", search: { replay: false } });
      return;
    }
    // An existing account created from an invite link joins it straight away.
    const pendingInvite = getPendingInvitePath();
    if (pendingInvite) {
      window.location.replace(pendingInvite);
      return;
    }
    nav({ to: getPostAuthPath(profile) });
  }, [user, profile, authLoading, profileError, nav]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username))
      return toast.error("Username: 3–20 chars, letters/numbers/underscore");
    setLoading(true);
    setErrKind(null);
    const { error } =
      mode === "otp"
        ? await supabase.auth.signInWithOtp({
            email,
            options: {
              shouldCreateUser: true,
              data: { username, display_name: username, avatar_url: randomDefaultAvatar(username) },
            },
          })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: window.location.origin + "/tutorial",
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
      subtitle="Pick a username, add an email and a password. That's the whole sign-up."
      footer={
        <p className="text-center">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-[#15151a] underline decoration-[#c9ff3d] decoration-2 underline-offset-4 transition hover:decoration-[#15151a]"
          >
            Log in
          </Link>
        </p>
      }
    >
      {errKind && (
        <AuthErrorBanner
          kind={errKind}
          rawMessage={errMsg}
          onRetry={() => {
            setErrKind(null);
            void onSubmit(new Event("submit") as unknown as React.FormEvent);
          }}
          retryLabel="Try creating account again"
        />
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-[#a09c91]">
              @
            </span>
            <Input
              id="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              enterKeyHint="next"
              className="h-[54px] rounded-2xl border-[#e3e0d7] bg-[#f7f6f2] pl-10 pr-4 text-[15px] shadow-none placeholder:text-[#a5a196] focus-visible:border-[#15151a] focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-[#c9ff3d]/40"
              placeholder="yourname"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-[54px] rounded-2xl border-[#e3e0d7] bg-[#f7f6f2] px-4 text-[15px] shadow-none placeholder:text-[#a5a196] focus-visible:border-[#15151a] focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-[#c9ff3d]/40"
          />
        </div>
        <SegmentedControl
          label="Sign-up method"
          value={mode}
          options={[
            { value: "password" as const, label: "Password" },
            { value: "otp" as const, label: "Email code" },
          ]}
          onChange={(next) => {
            setMode(next);
            if (next === "password") setOtpSent(false);
          }}
        />
        {mode === "password" ? (
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-[54px] rounded-2xl border-[#e3e0d7] bg-[#f7f6f2] px-4 text-[15px] shadow-none placeholder:text-[#a5a196] focus-visible:border-[#15151a] focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-[#c9ff3d]/40"
              placeholder="At least 8 characters"
            />
          </div>
        ) : otpSent ? (
          <div className="space-y-2">
            <Label htmlFor="otp">Email code</Label>
            <Input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.slice(0, 8))}
              className="h-[54px] rounded-2xl border-[#e3e0d7] bg-[#f7f6f2] px-4 text-[17px] tracking-[0.3em] shadow-none focus-visible:border-[#15151a] focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-[#c9ff3d]/40"
              placeholder="123456"
            />
          </div>
        ) : null}
        <Button
          type={mode === "otp" && otpSent ? "button" : "submit"}
          onClick={mode === "otp" && otpSent ? verifyOtp : undefined}
          disabled={loading}
          className="mt-1 h-[54px] w-full rounded-2xl bg-[#15151a] text-[15px] font-semibold text-white shadow-none transition hover:bg-[#2a2a2e] active:scale-[0.99] disabled:opacity-60"
        >
          {loading
            ? "Please wait…"
            : mode === "otp"
              ? otpSent
                ? "Verify code"
                : "Send email code"
              : "Create account"}
        </Button>
      </form>
    </AuthCard>
  );
}
