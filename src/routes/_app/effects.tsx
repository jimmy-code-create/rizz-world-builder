import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Eye, Layers3, Loader2, LockKeyhole, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BloodwebDecoration } from "@/components/profile/BloodwebDecoration";
import { DarkMoonFrame } from "@/components/profile/DarkMoonFrame";
import { PuppyLoveEffect } from "@/components/profile/PuppyLoveEffect";
import { useAuth } from "@/lib/auth";
import { useEquipped, useOwnedEffectSlugs } from "@/lib/useEquipped";
import {
  COSMETICS_ENABLED,
  PROFILE_EFFECTS,
  equipEffect,
  unequipEffect,
  type ProfileEffect,
  type ProfileEffectType,
} from "@/lib/effects";
import { untypedRpc } from "@/lib/untyped-db";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/lib/formatters";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/_app/effects")({
  head: () => ({ meta: [{ title: "Effects · RIZZ" }] }),
  component: EffectsPage,
});

const SLOT_META: Record<ProfileEffectType, { label: string; blurb: string }> = {
  avatar_decoration: { label: "Avatar decoration", blurb: "Wraps your photo" },
  profile_effect: { label: "Profile effect", blurb: "Plays on your banner" },
  profile_frame: { label: "Profile frame", blurb: "Frames the whole card" },
};

const RARITY_COLOR: Record<ProfileEffect["rarity"], string> = {
  common: "#c8c8cf",
  rare: "#6cd7ff",
  epic: "#cd9bff",
  legendary: "#ffd166",
  mythic: "#ff6a86",
};

/**
 * The cosmetics shelf.
 *
 * Three looks, one per slot, so an avatar decoration, a banner effect and a
 * frame can be worn together. Cards show the real vector art on a mock profile
 * surface; ownership comes from `user_profile_effects`, and every purchase or
 * equip goes through the secure RPCs rather than direct table writes.
 */
function EffectsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const equippedQ = useEquipped(user?.id);
  const ownedQ = useOwnedEffectSlugs(user?.id);
  const equipped = equippedQ.data ?? {};
  const owned = ownedQ.data ?? new Set<string>();
  const balance = Number(profile?.paw_balance ?? 0);
  const initial = (profile?.display_name || profile?.username || "?").charAt(0).toUpperCase();

  const refreshSlotData = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["equipped"] }),
      qc.invalidateQueries({ queryKey: ["owned-effects"] }),
      refreshProfile(),
    ]);
  };

  const equip = useMutation({
    mutationFn: async (effect: ProfileEffect) => {
      if (!user) throw new Error("Sign in to equip effects.");
      return equipEffect(user.id, effect.slug, effect.type);
    },
    onSuccess: async (_result, effect) => {
      await refreshSlotData();
      toast.success(`${effect.name} equipped`, {
        description: "Worn on your profile, cards and previews.",
      });
    },
    onError: (error) => {
      toast.error("Couldn't equip that look", {
        description: error instanceof Error ? error.message : "Try again in a moment.",
      });
    },
  });

  const purchase = useMutation({
    mutationFn: async (effect: ProfileEffect) => {
      if (!user) throw new Error("Sign in to unlock effects.");
      const { data, error } = await untypedRpc(supabase)("purchase_profile_effect", {
        _slug: effect.slug,
      });
      if (error) throw error;
      return data as { status?: string; balance?: number };
    },
    onSuccess: async (_result, effect) => {
      await refreshSlotData();
      toast.success(`${effect.name} unlocked and equipped`, {
        description: "It is now live for everyone who visits your profile.",
      });
    },
    onError: (error) => {
      toast.error("Couldn't unlock that look", {
        description: error instanceof Error ? error.message : "Try again in a moment.",
      });
    },
  });

  const remove = useMutation({
    mutationFn: async (effect: ProfileEffect) => {
      if (!user) throw new Error("Sign in to change effects.");
      return unequipEffect(user.id, effect.slug, effect.type);
    },
    onSuccess: async (_result, effect) => {
      await refreshSlotData();
      toast.success(`${effect.name} removed from your profile`);
    },
    onError: (error) => {
      toast.error("Couldn't remove that look", {
        description: error instanceof Error ? error.message : "Try again in a moment.",
      });
    },
  });

  const pendingSlug = equip.isPending
    ? equip.variables?.slug
    : purchase.isPending
      ? purchase.variables?.slug
      : remove.isPending
        ? remove.variables?.slug
        : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-10">
      <div className="mb-6 flex items-center gap-3">
        <IconButton
          aria-label="Back"
          size="lg"
          variant="ghost"
          onClick={() => nav({ to: profile?.username ? `/u/${profile.username}` : "/feed" })}
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
            Profile looks
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One look per slot — wear an avatar decoration, a banner effect and a frame together.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-line,rgba(244,241,231,0.13))] px-3 py-1 text-xs font-medium text-[var(--brand-paper-dim,#a9a69c)]">
            <Sparkles className="h-3.5 w-3.5" />
            {PROFILE_EFFECTS.length} looks
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-signal,#c8ff3d)]/30 bg-[var(--brand-signal,#c8ff3d)]/10 px-3 py-1 text-xs font-bold text-[var(--brand-signal,#c8ff3d)]">
            {formatNumber(balance)} Paws
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PROFILE_EFFECTS.map((effect) => {
          const worn = equipped[effect.type]?.slug === effect.slug;
          const isOwned = owned.has(effect.slug);
          const busy = pendingSlug === effect.slug;
          const short = isOwned ? 0 : Math.max(0, effect.paw_price - balance);

          return (
            <article
              key={effect.slug}
              className="group flex flex-col overflow-hidden rounded-3xl border border-[var(--brand-line,rgba(244,241,231,0.13))] bg-[var(--brand-ink-2,#131315)] transition-colors hover:border-white/20"
              style={{
                boxShadow: worn ? `0 0 0 1px ${effect.preview_color}55, 0 18px 48px -32px ${effect.preview_color}` : undefined,
              }}
            >
              <EffectPreview
                effect={effect}
                avatarUrl={profile?.avatar_url ?? null}
                initial={initial}
              />

              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-bold tracking-tight text-[var(--brand-paper,#f4f1e7)]">
                      {effect.name}
                    </h2>
                    <p className="mt-0.5 text-[11px] text-[var(--brand-paper-dim,#a9a69c)]">
                      {SLOT_META[effect.type].label} ·{" "}
                      <span style={{ color: RARITY_COLOR[effect.rarity] }}>{effect.rarity}</span>
                    </p>
                  </div>
                  {worn ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--brand-signal,#c8ff3d)]/50 bg-[var(--brand-signal,#c8ff3d)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-signal,#c8ff3d)]">
                      <Check className="h-3 w-3" /> Worn
                    </span>
                  ) : isOwned ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-paper-dim,#a9a69c)]">
                      <Check className="h-3 w-3" /> Owned
                    </span>
                  ) : null}
                </div>

                <p className="mt-2 text-xs leading-relaxed text-[var(--brand-paper-dim,#a9a69c)]">
                  {effect.description}
                </p>

                <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Effect details">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-[var(--brand-paper-dim,#a9a69c)]">
                    <Layers3 className="h-2.5 w-2.5" /> {SLOT_META[effect.type].label}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-[var(--brand-paper-dim,#a9a69c)]">
                    <Sparkles className="h-2.5 w-2.5" /> Animated
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-[var(--brand-paper-dim,#a9a69c)]">
                    <Eye className="h-2.5 w-2.5" /> Transparent SVG
                  </span>
                </div>

                <div className="mt-auto flex flex-col gap-2 pt-4">
                  {!COSMETICS_ENABLED ? (
                    <p className="text-xs text-[var(--brand-paper-dim,#a9a69c)]">
                      Cosmetics are paused right now.
                    </p>
                  ) : worn ? (
                    <Button
                      variant="outline"
                      className="glass border-white/10"
                      onClick={() => remove.mutate(effect)}
                      disabled={busy}
                    >
                      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      Remove from profile
                    </Button>
                  ) : isOwned ? (
                    <Button onClick={() => equip.mutate(effect)} disabled={busy}>
                      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                      Equip
                    </Button>
                  ) : (
                    <Button
                      onClick={() => purchase.mutate(effect)}
                      disabled={busy || short > 0}
                      className="gap-2"
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <LockKeyhole className="h-4 w-4" />
                      )}
                      Unlock · {formatNumber(effect.paw_price)} Paws
                    </Button>
                  )}

                  <p className="flex items-center gap-1.5 text-[10px] text-[var(--brand-paper-dim,#a9a69c)]">
                    <Eye className="h-3 w-3" />
                    {SLOT_META[effect.type].blurb}
                    {!isOwned && short > 0 ? ` · ${formatNumber(short)} more Paws needed` : ""}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <p className="mt-5 text-xs text-[var(--brand-paper-dim,#a9a69c)]">
        Every look is transparent vector art, reduced-motion aware, and never covers profile
        controls. Unlocking spends Paws through the server wallet; there is no card checkout.
      </p>

      <div className="mt-5">
        <Link to={profile?.username ? "/u/$username" : "/feed"} params={profile?.username ? { username: profile.username } : undefined}>
          <Button variant="ghost" className="text-[var(--brand-paper-dim,#a9a69c)] hover:text-[var(--brand-paper,#f4f1e7)]">
            <Eye className="mr-2 h-4 w-4" /> View my profile
          </Button>
        </Link>
      </div>
    </div>
  );
}

function EffectPreview({
  effect,
  avatarUrl,
  initial,
}: {
  effect: ProfileEffect;
  avatarUrl: string | null;
  initial: string;
}) {
  const wash = {
    background: `radial-gradient(120% 130% at 72% 18%, ${effect.preview_color}38, var(--brand-ink,#0a0a0b) 64%)`,
  };

  if (effect.type === "avatar_decoration") {
    return (
      <div className="relative h-48 overflow-hidden rounded-t-3xl" style={wash} role="img" aria-label={`${effect.name} avatar decoration preview`}>
        <div className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.55) 0.7px, transparent 0.8px)", backgroundSize: "11px 11px" }} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--brand-ink-2,#131315)]/75 to-transparent" />
        <span className="absolute left-3 top-3 z-20 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/35 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/60 backdrop-blur-sm">
          <span className="h-1 w-1 rounded-full bg-[#ff3048]" /> Live preview
        </span>
        <div className="grid h-full place-items-center pb-2 transition-transform duration-500 group-hover:scale-[1.03]">
          <div className="relative" style={{ width: 120, height: 120 }}>
            <Avatar className="relative z-[1] h-[120px] w-[120px] rounded-full ring-4 ring-[var(--brand-ink-2,#131315)]">
              <AvatarImage src={avatarUrl ?? undefined} />
              <AvatarFallback className="bg-[var(--brand-ink-3,#1c1c1f)] text-3xl font-semibold text-[var(--brand-paper,#f4f1e7)]">
                {initial}
              </AvatarFallback>
            </Avatar>
            <BloodwebDecoration slug={effect.slug} />
          </div>
        </div>
      </div>
    );
  }

  if (effect.type === "profile_frame") {
    return (
      <div className="relative h-48 overflow-hidden rounded-t-3xl" style={wash} role="img" aria-label={`${effect.name} profile frame preview`}>
        <div className="absolute inset-x-5 bottom-4 top-9 rounded-xl border border-white/10 bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" />
        <DarkMoonFrame slug={effect.slug} />
        <span className="absolute left-3 top-3 z-20 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/35 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/60 backdrop-blur-sm">
          <span className="h-1 w-1 rounded-full bg-[#dfe8ef]" /> Live preview
        </span>
        <div className="absolute bottom-7 left-7 z-10 flex items-center gap-2.5 transition-transform duration-500 group-hover:-translate-y-0.5">
          <Avatar className="h-11 w-11 ring-2 ring-[var(--brand-ink-2,#131315)]">
            <AvatarImage src={avatarUrl ?? undefined} />
            <AvatarFallback className="bg-[var(--brand-ink-3,#1c1c1f)] text-xs">{initial}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-bold text-white/90">Your name</p>
            <p className="text-[10px] text-white/50">Framed profile · this month</p>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-5 bottom-4 z-10 flex gap-1.5 pl-1">
          <span className="h-1 w-10 rounded-full bg-white/35" />
          <span className="h-1 w-5 rounded-full bg-white/15" />
          <span className="h-1 w-7 rounded-full bg-white/10" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-48 overflow-hidden rounded-t-3xl" style={wash} role="img" aria-label={`${effect.name} profile effect preview`}>
      <PuppyLoveEffect />
      <span className="absolute left-3 top-3 z-20 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/35 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/60 backdrop-blur-sm">
        <span className="h-1 w-1 rounded-full bg-[var(--brand-signal,#c8ff3d)]" /> Live preview
      </span>
      <div className="absolute bottom-4 left-5 z-10 flex items-center gap-2.5 transition-transform duration-500 group-hover:-translate-y-0.5">
        <Avatar className="h-11 w-11 ring-4 ring-[var(--brand-ink,#0a0a0b)]">
          <AvatarImage src={avatarUrl ?? undefined} />
          <AvatarFallback className="bg-[var(--brand-ink-3,#1c1c1f)] text-sm">{initial}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-bold text-white/90">Your banner</p>
          <p className="text-[10px] text-white/55">{effect.name} · animated</p>
        </div>
      </div>
    </div>
  );
}
