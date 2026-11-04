import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/AuthCard";
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
import { readWelcomeName } from "@/lib/welcome";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Log in — RIZZ" }] }),
});

function LoginPage() {
  const nav = useNavigate();
  const { user, profile, loading: authLoading, profileError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errKind, setErrKind] = useState<AuthErrorKind | null>(null);
  const [errMsg, setErrMsg] = useState<string>("");
  const [welcomeName, setWelcomeName] = useState("");

  useEffect(() => {
    // Read after mount so SSR and hydration paint the same generic greeting.
    setWelcomeName(readWelcomeName());
  }, []);

  useEffect(() => {
    if (!user || authLoading || profileError) return;
    // New members see the welcome tour before anything else — including a
    // pending invite. Finishing the tour lands them on the invite, so the link
    // is not lost, it just does not skip onboarding.
    if (profile?.username && !profile.tutorial_seen) {
      nav({ to: "/tutorial", search: { replay: false } });
      return;
    }
    // Someone who followed an invite link finishes joining instead of landing
    // on the feed. Group and realm invites are both handled here.
    const pendingInvite = getPendingInvitePath();
    if (pendingInvite) {
      window.location.replace(pendingInvite);
      return;
    }
    nav({ to: getPostAuthPath(profile) });
  }, [user, profile, authLoading, profileError, nav]);

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

  const first = welcomeName.trim().split(/\s+/)[0];

  return (
    <AuthCard
      title={first ? `Welcome back, ${first}.` : "Welcome back."}
      subtitle="Log in to get back to your feed, your realms and whoever is in voice."
      footer={
        <div className="space-y-4">
          <p className="text-center">
            New to RIZZ?{" "}
            <Link
              to="/signup"
              className="font-semibold text-[#15151a] underline decoration-[#c9ff3d] decoration-2 underline-offset-4 transition hover:decoration-[#15151a]"
            >
              Create an account
            </Link>
          </p>
          <p className="text-center text-[11px] text-[#9a968b]">
            Your account stays yours. No posts go out until you make them.
          </p>
        </div>
      }
    >
      {errKind && (
        <AuthErrorBanner
          kind={errKind}
          rawMessage={errMsg}
          onRetry={() => {
            setErrKind(null);
            void onEmail(new Event("submit") as unknown as React.FormEvent);
          }}
          retryLabel="Try logging in again"
        />
      )}
      <form onSubmit={onEmail} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-[12px] font-semibold text-[#3f3d37]">
            Email
          </Label>
          <div className="relative">
            <Mail
              aria-hidden
              className="pointer-events-none absolute left-4 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#a09c91]"
              strokeWidth={2}
            />
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-[54px] rounded-2xl border-[#e3e0d7] bg-[#f7f6f2] pl-11 pr-4 text-[15px] text-[#15151a] shadow-none placeholder:text-[#a5a196] focus-visible:border-[#15151a] focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-[#c9ff3d]/40"
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-[12px] font-semibold text-[#3f3d37]">
              Password
            </Label>
            <Link
              to="/reset-password"
              className="text-[11px] font-semibold text-[#7b786f] transition-colors hover:text-[#15151a]"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <LockKeyhole
              aria-hidden
              className="pointer-events-none absolute left-4 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#a09c91]"
              strokeWidth={2}
            />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-[54px] rounded-2xl border-[#e3e0d7] bg-[#f7f6f2] pl-11 pr-[52px] text-[15px] text-[#15151a] shadow-none placeholder:text-[#a5a196] focus-visible:border-[#15151a] focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-[#c9ff3d]/40"
              placeholder="Your password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-1.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-xl text-[#8a877d] transition-colors hover:bg-[#ebe9e2] hover:text-[#15151a]"
            >
              {showPassword ? (
                <EyeOff className="h-[18px] w-[18px]" aria-hidden />
              ) : (
                <Eye className="h-[18px] w-[18px]" aria-hidden />
              )}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="mt-1 h-[54px] w-full rounded-2xl bg-[#15151a] text-[15px] font-semibold text-white shadow-none transition hover:bg-[#2a2a2e] active:scale-[0.99] disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Logging in…
            </>
          ) : (
            <>
              Log in
              <ArrowRight className="h-4 w-4" aria-hidden />
            </>
          )}
        </Button>
      </form>
    </AuthCard>
  );
}
