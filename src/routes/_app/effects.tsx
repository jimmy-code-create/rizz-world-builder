import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Eye, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PuppyLoveEffect } from "@/components/profile/PuppyLoveEffect";
import { useAuth } from "@/lib/auth";
import { useEquipped } from "@/lib/useEquipped";
import {
  COSMETICS_ENABLED,
  PUPPY_LOVE_EFFECT,
  equipEffect,
  unequipEffect,
} from "@/lib/effects";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/_app/effects")({
  head: () => ({ meta: [{ title: "Effects · RIZZ" }] }),
  component: EffectsPage,
});

/**
 * The effects shelf.
 *
 * There is exactly one cosmetic — the Puppy Love profile effect — so this is
 * a showcase rather than a marketplace: Biscuit plays at the size he plays on
 * a profile banner, with the avatar disc in place, and the owner can equip or
 * remove him. The preview surface is the page's own banner mock; the effect
 * itself is transparent vector art.
 */
function EffectsPage() {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const equippedQ = useEquipped(user?.id);
  const isEquipped = equippedQ.data?.profile_effect?.slug === PUPPY_LOVE_EFFECT.slug;
  const profileUsername = profile?.username;
  const initial = (profile?.display_name || profileUsername || "?").charAt(0).toUpperCase();

  const equip = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to equip effects.");
      return equipEffect(user.id, PUPPY_LOVE_EFFECT.slug, "profile_effect");
    },
    onSuccess: ({ persisted }) => {
      void qc.invalidateQueries({ queryKey: ["equipped", user?.id] });
      toast.success("Puppy Love equipped", {
        description: persisted
          ? "Biscuit now shows on your profile for everyone."
          : "Saved on this device. Apply the latest migration to show it to visitors.",
      });
    },
    onError: (error) => {
      toast.error("Couldn't equip Puppy Love", {
        description: error instanceof Error ? error.message : "Try again in a moment.",
      });
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to change effects.");
      return unequipEffect(user.id, PUPPY_LOVE_EFFECT.slug, "profile_effect");
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["equipped", user?.id] });
      toast.success("Puppy Love removed from your profile");
    },
    onError: (error) => {
      toast.error("Couldn't remove the effect", {
        description: error instanceof Error ? error.message : "Try again in a moment.",
      });
    },
  });

  const busy = equip.isPending || remove.isPending;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <div className="mb-6 flex items-center gap-3">
        <IconButton
          aria-label="Back"
          size="lg"
          variant="ghost"
          onClick={() => nav({ to: profileUsername ? `/u/${profileUsername}` : "/feed" })}
        >
          <ArrowLeft className="h-5 w-5" />
        </IconButton>
        <span className="text-sm font-medium text-muted-foreground">Profile</span>
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-paper-dim,#a9a69c)]">
            Cosmetics
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Profile effects
          </h1>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-line,rgba(244,241,231,0.13))] px-3 py-1 text-xs font-medium text-[var(--brand-paper-dim,#a9a69c)]">
          <Sparkles className="h-3.5 w-3.5" />
          1 available
        </span>
      </div>

      <article className="overflow-hidden rounded-3xl border border-[var(--brand-line,rgba(244,241,231,0.13))] bg-[var(--brand-ink-2,#131315)]">
        <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-[var(--brand-paper,#f4f1e7)]">
              {PUPPY_LOVE_EFFECT.name}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--brand-paper-dim,#a9a69c)]">
              Profile effect · <span className="text-[var(--brand-signal,#c8ff3d)]">Mythic</span>
            </p>
          </div>
          {isEquipped && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-signal,#c8ff3d)]/50 px-2.5 py-1 text-[11px] font-semibold text-[var(--brand-signal,#c8ff3d)]">
              <Check className="h-3.5 w-3.5" /> Equipped
            </span>
          )}
        </div>

        {/* A real banner-shaped surface, with the real effect and a real avatar
            disc — the same composition a visitor sees on a profile. */}
        <div className="px-4 pt-4 sm:px-6">
          <div
            className="relative h-44 overflow-hidden rounded-2xl sm:h-52"
            style={{
              background:
                "radial-gradient(120% 140% at 70% 20%, color-mix(in srgb, #c9ff3d 22%, var(--brand-ink,#0a0a0b)), var(--brand-ink,#0a0a0b) 62%)",
            }}
            role="img"
            aria-label="Puppy Love preview: Biscuit the dog in a lime hoodie and heart-shaped shades inside a profile banner"
          >
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--brand-ink-2,#131315)]/70 to-transparent" />
            <PuppyLoveEffect />
            {/* The avatar disc sits in the shot so the composition is readable,
                but it is chrome in the preview — the effect itself contains no
                avatar, card or badge. */}
            <div className="absolute bottom-3 left-3">
              <Avatar className="h-12 w-12 ring-4 ring-[var(--brand-ink-2,#131315)]">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-[var(--brand-ink-3,#1c1c1f)] font-semibold text-[var(--brand-paper,#f4f1e7)]">
                  {initial}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--brand-paper-dim,#a9a69c)]">
            <Eye className="h-3.5 w-3.5" />
            Banner preview — the effect itself has no background and never covers profile controls.
          </p>
        </div>

        <div className="space-y-4 px-4 pb-5 pt-8 sm:px-6">
          <p className="max-w-xl text-sm leading-relaxed text-[var(--brand-paper-dim,#a9a69c)]">
            {PUPPY_LOVE_EFFECT.description}
          </p>

          <ul className="flex flex-wrap gap-2 text-[11px] font-medium text-[var(--brand-paper-dim,#a9a69c)]">
            <li className="rounded-full border border-[var(--brand-line,rgba(244,241,231,0.13))] px-2.5 py-1">
              Transparent vector
            </li>
            <li className="rounded-full border border-[var(--brand-line,rgba(244,241,231,0.13))] px-2.5 py-1">
              Seamless loop
            </li>
            <li className="rounded-full border border-[var(--brand-line,rgba(244,241,231,0.13))] px-2.5 py-1">
              Reduced-motion aware
            </li>
          </ul>

          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center">
            {!COSMETICS_ENABLED ? (
              <p className="text-sm text-[var(--brand-paper-dim,#a9a69c)]">
                Cosmetics are paused right now.
              </p>
            ) : isEquipped ? (
              <Button
                variant="outline"
                className="glass border-white/10"
                onClick={() => remove.mutate()}
                disabled={busy}
              >
                {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Remove from profile
              </Button>
            ) : (
              <Button onClick={() => equip.mutate()} disabled={busy || equippedQ.isLoading}>
                {equip.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Equip on my profile
              </Button>
            )}

            <Link to={profileUsername ? "/u/$username" : "/feed"} params={profileUsername ? { username: profileUsername } : undefined}>
              <Button variant="ghost" className="text-[var(--brand-paper-dim,#a9a69c)] hover:text-[var(--brand-paper,#f4f1e7)]">
                View my profile
              </Button>
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
