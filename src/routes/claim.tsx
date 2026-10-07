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
import { toast } from "sonner";

export const Route = createFileRoute("/claim")({
  component: ClaimUsernamePage,
  head: () => ({ meta: [{ title: "Claim your @ · RIZZ" }] }),
});

function ClaimUsernamePage() {
  const { user, profile, loading, profileError, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorKind, setErrorKind] = useState<AuthErrorKind | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (loading || profileError) return;
    if (!user) nav({ to: "/login" });
    else if (profile?.username) nav({ to: getPostAuthPath(profile) });
  }, [loading, user, profile, profileError, nav]);

  const claim = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = username.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(normalized)) {
      toast.error("Username: 3–20 chars, letters/numbers/underscore");
      return;
    }
    if (!user) return;

    setBusy(true);
    setErrorKind(null);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({ username: normalized, display_name: profile?.display_name || normalized })
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
          .upsert({ id: user.id, username: normalized, display_name: normalized });
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
      footer={<>Need a different account? <Link to="/" className="text-[var(--rizz-pink)] hover:underline font-medium">Back to RIZZ</Link></>}
    >
      {errorKind && (
        <AuthErrorBanner kind={errorKind} rawMessage={errorMessage} onRetry={() => setErrorKind(null)} retryLabel="Try another username" />
      )}
      <form onSubmit={claim} className="space-y-4">
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
              className="h-11 pl-7 glass border-white/10"
              placeholder="yourname"
            />
          </div>
        </div>
        <Button type="submit" disabled={busy} className="w-full h-11 bg-gradient-primary border-0 shadow-glow hover:opacity-90">
          {busy ? "Saving…" : "Claim username"}
        </Button>
      </form>
    </AuthCard>
  );
}
