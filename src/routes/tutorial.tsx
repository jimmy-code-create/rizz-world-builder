import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AuthCard } from "@/components/AuthCard";
import { CustomEmoji } from "@/components/CustomEmoji";
import { Button } from "@/components/ui/button";
import { AvatarPicker } from "@/components/onboarding/AvatarPicker";
import { DEFAULT_AVATARS } from "@/lib/default-avatars";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getPendingInvitePath } from "@/lib/onboarding";
import { TUTORIAL_INTERESTS } from "@/lib/emoji.js";
import { toast } from "@/lib/toast";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";

export const Route = createFileRoute("/tutorial")({
  component: TutorialPage,
  head: () => ({ meta: [{ title: "Your interests · RIZZ" }] }),
});

function TutorialPage() {
  const { user, profile, loading, profileError, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hasEntered = useRef(false);

  useEffect(() => {
    if (loading || profileError) return;
    if (!user) {
      nav({ to: "/" });
      return;
    }
    if (!profile) {
      nav({ to: "/claim" });
      return;
    }
    if (!profile.username) {
      nav({ to: "/claim" });
      return;
    }
    if (profile.tutorial_seen && !hasEntered.current) {
      nav({ to: "/feed" });
      return;
    }
    if (!profile.tutorial_seen && !hasEntered.current) {
      hasEntered.current = true;
      setSelected(profile.interests ?? []);
      setSelectedAvatar(profile.avatar_url ?? DEFAULT_AVATARS[0].url);
    }
  }, [loading, profileError, user, profile, nav, refreshProfile]);

  const finish = async (interests: string[], avatarUrl: string) => {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ tutorial_seen: true, interests, avatar_url: avatarUrl })
        .eq("id", user.id);
      if (updateError) throw updateError;
      await refreshProfile();
      toast.success("You're all set.");
      // Someone who followed an invite link finishes joining instead of
      // landing on the feed (same rule as login/signup).
      const pendingInvite = getPendingInvitePath();
      if (pendingInvite) {
        window.location.replace(pendingInvite);
        return;
      }
      nav({ to: "/feed" });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Couldn't save your interests.");
    } finally {
      setBusy(false);
    }
  };

  const toggleInterest = (interest: string) => {
    setSelected((current) =>
      current.includes(interest)
        ? current.filter((item) => item !== interest)
        : current.length < 6
          ? [...current, interest]
          : current,
    );
  };

  if (loading || !user) {
    return <div className="flex min-h-dvh items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-[var(--brand-signal)]" role="status" aria-label="Loading" /></div>;
  }

  if (profileError || !profile) {
    return (
      <AuthCard title="Find your people" subtitle={profileError ?? "We couldn't load your account yet."}>
        <Button className="w-full" variant="outline" onClick={() => void refreshProfile()}>Retry</Button>
      </AuthCard>
    );
  }

  if (!profile.username) {
    return <div className="flex min-h-dvh items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-[var(--brand-signal)]" role="status" aria-label="Loading" /></div>;
  }

  if (profile.tutorial_seen && !hasEntered.current) {
    return <div className="flex min-h-dvh items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-[var(--brand-signal)]" role="status" aria-label="Loading" /></div>;
  }

  const keepPhoto = !!profile.avatar_url && !isDefaultAvatar(profile.avatar_url);

  return (
    <AuthCard
      title={step === 1 ? "Pick your picture" : "Find your people"}
      subtitle={step === 1
        ? "Choose one of our six cats, or upload a photo of your own."
        : "Choose up to six interests. They’ll appear on your profile and help RIZZ find your people."}
    >
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-xs font-medium">
          <span className="text-muted-foreground">Step {step} of 2</span>
          <span className="flex items-center gap-1.5 text-primary"><Sparkles className="h-3.5 w-3.5" /> Make it yours</span>
        </div>
        <div className="grid grid-cols-2 gap-2" aria-label="Onboarding progress">
          {[1, 2].map((item) => (
            <div key={item} className={`h-1.5 rounded-full ${item <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
      </div>

      {step === 1 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Choose a profile cat">
            {DEFAULT_AVATARS.map((avatar) => {
              const active = selectedAvatar === avatar.url;
              return (
                <button
                  key={avatar.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={avatar.label}
                  onClick={() => setSelectedAvatar(avatar.url)}
                  disabled={busy}
                  className={`group flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    active ? "border-primary bg-primary/10 shadow-[0_0_0_1px_var(--primary)]" : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  <img src={avatar.url} alt="" className="h-14 w-14 rounded-full object-cover" />
                  <span className="text-xs font-medium">{avatar.label}</span>
                </button>
              );
            })}
            {keepPhoto && (
              <button
                type="button"
                role="radio"
                aria-checked={selectedAvatar === profile.avatar_url}
                aria-label="Keep my current photo"
                onClick={() => setSelectedAvatar(profile.avatar_url!)}
                disabled={busy}
                className={`flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  selectedAvatar === profile.avatar_url ? "border-primary bg-primary/10 shadow-[0_0_0_1px_var(--primary)]" : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <img src={profile.avatar_url!} alt="" className="h-14 w-14 rounded-full object-cover" />
                <span className="text-xs font-medium">My photo</span>
              </button>
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground">You can change your picture or upload a photo later in Profile settings.</p>
        </div>
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">What are you into?</p>
            <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium tabular-nums">
              {selected.length} / 6
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {TUTORIAL_INTERESTS.map(({ id, emoji }) => {
              const isSelected = selected.includes(id);
              return (
                <Button
                  key={id}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  aria-pressed={isSelected}
                  disabled={busy || (!isSelected && selected.length >= 6)}
                  onClick={() => toggleInterest(id)}
                  className={`h-11 justify-start gap-2 rounded-xl ${isSelected ? "border-transparent bg-primary text-primary-foreground hover:bg-primary" : "border-border bg-card"}`}
                >
                  <CustomEmoji name={emoji} className="h-5 w-5" />
                  <span>{id}</span>
                  {isSelected && <Check className="ml-auto h-4 w-4" aria-hidden />}
                </Button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Pick a few now. You can update these later in Profile settings.</p>
        </div>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}

      <div className="mt-5 flex items-center gap-2">
        {step === 2 && (
          <Button type="button" variant="outline" disabled={busy} onClick={() => setStep(1)} className="h-11 gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() =>
            void finish(
              step === 2 ? (profile.interests ?? []) : (profile.interests ?? selected),
              selectedAvatar,
            )
          }
          className="h-11"
        >
          {step === 1 ? "Skip" : "Skip interests"}
        </Button>
        <Button
          type="button"
          disabled={busy || !selectedAvatar}
          onClick={() => {
            if (step === 1) setStep(2);
            else void finish(selected, selectedAvatar);
          }}
          className="ml-auto h-11 gap-1.5 rounded-xl px-5 font-semibold"
        >
          {busy ? "Saving…" : step === 1 ? "Continue" : "Finish"}
          {!busy && (step === 1 ? <ArrowRight className="h-4 w-4" /> : <Check className="h-4 w-4" />)}
        </Button>
      </div>
    </AuthCard>
  );
}
