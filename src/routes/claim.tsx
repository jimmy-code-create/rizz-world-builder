import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthCard } from "@/components/AuthCard";
import { AuthErrorBanner, classifyAuthError, type AuthErrorKind } from "@/components/AuthErrorBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getPostAuthPath } from "@/lib/onboarding";
import { DEFAULT_AVATARS, isDefaultAvatar } from "@/lib/default-avatars";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/claim")({
  component: ClaimUsernamePage,
  head: () => ({ meta: [{ title: "Claim your @ · RIZZ" }] }),
});

/** Handles nobody can impersonate or squat on. */
const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "root", "support", "help", "rizz", "official",
  "system", "moderator", "mod", "staff", "api", "feed", "explore", "settings",
  "notifications", "login", "signup", "claim", "tutorial", "null", "undefined",
]);

function ClaimUsernamePage() {
  const { user, profile, loading, profileError, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  // The dedicated pick: every account chooses its cat the first time it logs in.
  const [avatar, setAvatar] = useState<string>(() =>
    profile?.avatar_url && isDefaultAvatar(profile.avatar_url) ? profile.avatar_url : DEFAULT_AVATARS[0].url,
  );
  const [busy, setBusy] = useState(false);
  const [errorKind, setErrorKind] = useState<AuthErrorKind | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  // Live availability: debounced exact-match lookup as they type.
  const [availability, setAvailability] = useState<"idle" | "checking" | "free" | "taken" | "invalid">("idle");

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/" });
    else if (!profileError && profile?.username) nav({ to: getPostAuthPath(profile) });
  }, [loading, user, profile, profileError, nav]);

  // Profile can arrive after first paint (stale avatar otherwise).
  useEffect(() => {
    if (profile?.avatar_url && isDefaultAvatar(profile.avatar_url)) setAvatar(profile.avatar_url);
    if (!displayName && profile?.display_name) setDisplayName(profile.display_name);
  }, [profile?.avatar_url, profile?.display_name]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const value = username.trim().toLowerCase();
    if (!value) {
      setAvailability("idle");
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(value) || RESERVED_USERNAMES.has(value)) {
      setAvailability("invalid");
      return;
    }
    setAvailability("checking");
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id")
          .ilike("username", value)
          .limit(1);
        if (error) throw error;
        setAvailability(!data || data.length === 0 ? "free" : "taken");
      } catch {
        setAvailability("idle");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-[var(--brand-signal)]" role="status" aria-label="Loading account" />
      </div>
    );
  }

  const claim = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(normalized)) {
      toast.error("Username: 3–20 chars, letters/numbers/underscore");
      return;
    }
    if (RESERVED_USERNAMES.has(normalized)) {
      toast.error("That name is reserved — try another one");
      return;
    }
    if (availability === "taken") {
      toast.error("That username is taken — try another one");
      return;
    }
    if (!user) return;

    setBusy(true);
    setErrorKind(null);
    try {
      const name = displayName.trim().slice(0, 40) || normalized;
      const { data, error } = await supabase
        .from("profiles")
        .update({ username: normalized, display_name: profile?.display_name || name, avatar_url: avatar })
        .eq("id", user.id)
        .is("username", null)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        const { data: existing, error: lookupError } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle();
        if (lookupError) throw lookupError;
        if (existing?.username) {
          await refreshProfile();
          nav({ to: getPostAuthPath({ username: existing.username, tutorial_seen: profile?.tutorial_seen ?? false }) });
          return;
        }
        const { error: insertError } = await supabase
          .from("profiles")
          .upsert({ id: user.id, username: normalized, display_name: name, avatar_url: avatar });
        if (insertError) throw insertError;
      }

      await refreshProfile();
      toast.success("Your @ is yours.");
      nav({ to: "/tutorial" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Couldn't claim that username.";
      setErrorKind(classifyAuthError(message));
      setErrorMessage(message);
    } finally {
      setBusy(false);
    }
  };

  if (profileError) {
    return (
      <AuthCard title="Claim your @" subtitle="We couldn't load your account yet.">
        <p className="mb-4 text-sm text-destructive">{profileError}</p>
        <Button className="w-full" variant="outline" onClick={() => void refreshProfile()}>Retry</Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Claim your @"
      subtitle="Choose the username people will use to find you."
      footer={<>Need a different account? <Link to="/" className="text-primary hover:underline font-medium">Back to RIZZ</Link></>}
    >
      {errorKind && (
        <AuthErrorBanner kind={errorKind} rawMessage={errorMessage} onRetry={() => setErrorKind(null)} retryLabel="Try another username" />
      )}
      <form onSubmit={claim} className="space-y-4">
        <div className="space-y-2">
          <Label>Your avatar</Label>
          <p className="text-xs text-muted-foreground">Pick the cat that's you. Change it any time in Settings.</p>
          <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Choose your avatar">
            {DEFAULT_AVATARS.map((option) => {
              const selected = avatar === option.url;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={option.label}
                  title={option.label}
                  onClick={() => setAvatar(option.url)}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "ring-2 ring-[var(--ring)] ring-offset-2 ring-offset-background"
                      : "ring-1 ring-white/10 hover:ring-white/35",
                  )}
                >
                  <img src={option.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="claim-username">Username</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
            <Input
              id="claim-username"
              required
              minLength={3}
              maxLength={20}
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="h-11 border-border bg-secondary pl-7"
              placeholder="yourname"
              aria-describedby="claim-username-status"
            />
          </div>
          <p id="claim-username-status" role="status" className="text-xs" aria-live="polite">
            {availability === "checking" && <span className="text-muted-foreground">Checking availability…</span>}
            {availability === "free" && <span className="font-medium text-[#c8ff3d]">@{username.trim().toLowerCase()} is available</span>}
            {availability === "taken" && <span className="font-medium text-destructive">That username is taken</span>}
            {availability === "invalid" && username.trim() && (
              <span className="text-muted-foreground">3–20 chars, letters/numbers/underscore</span>
            )}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="claim-display">Display name <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input
            id="claim-display"
            maxLength={40}
            autoComplete="nickname"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="h-11 border-border bg-secondary"
            placeholder="What should people call you?"
          />
        </div>
        <Button
          type="submit"
          disabled={busy || availability === "taken" || availability === "checking"}
          className="h-11 w-full rounded-[6px] font-semibold"
        >
          {busy ? "Saving…" : "Claim username"}
        </Button>
      </form>
    </AuthCard>
  );
}
