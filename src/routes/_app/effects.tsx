import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  Loader2,
  Lock,
  PawPrint,
  Play,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import { CinematicEffect } from "@/components/profile/CinematicEffect";
import { useAuth } from "@/lib/auth";
import {
  COSMETICS_ENABLED,
  RARITY_FLAT,
  SHOWCASE_EFFECTS,
  effectPawPrice,
  equipProfileEffect,
  fetchUserEffects,
  purchaseEffectWithPaws,
  unequipProfileEffect,
  type ProfileEffect as CatalogEffect,
  type UserEffect,
} from "@/lib/effects";
import { CINEMATIC_BY_SLUG, CINEMATIC_EFFECTS, type CinematicAsset } from "@/lib/cinematic-effects";
import { formatNumber } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/effects")({
  head: () => ({ meta: [{ title: "Effects · RIZZ" }] }),
  component: EffectsPage,
});

/**
 * Optional card-checkout links. Paws unlocks are handled by the server RPC;
 * card checkout still needs a provider webhook before it can grant ownership,
 * so the UI never pretends a card payment unlocked anything by itself.
 */
const env = import.meta.env as Record<string, string | undefined>;
const CHECKOUT_READY = env.VITE_EFFECTS_CHECKOUT_READY === "true";
const DEFAULT_CHECKOUT = env.VITE_EFFECTS_CHECKOUT_URL;
const CHECKOUT_BY_SLUG: Record<string, string | undefined> = {
  "fx-web-slinger": env.VITE_EFFECTS_CHECKOUT_WEB_SLINGER,
  "fx-sakura-bloom": env.VITE_EFFECTS_CHECKOUT_SAKURA_BLOOM,
  "fx-arcane-nexus": env.VITE_EFFECTS_CHECKOUT_ARCANE_NEXUS,
  "fx-sakura-storm": env.VITE_EFFECTS_CHECKOUT_SAKURA_STORM,
};

function checkoutFor(slug: string): string | null {
  // The operator must explicitly confirm that the fulfilment webhook is live.
  // A checkout URL on its own is not enough to grant an effect.
  if (!CHECKOUT_READY) return null;
  return CHECKOUT_BY_SLUG[slug] || DEFAULT_CHECKOUT || null;
}

/**
 * Give the payment provider enough context to fulfil the right effect for the
 * right member. Stripe Payment Links pass `client_reference_id` through to the
 * completed session; other providers can read the same query keys.
 */
function checkoutHref(base: string, userId: string, slug: string): string {
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://rizz.app";
    const url = new URL(base, origin);
    url.searchParams.set("client_reference_id", userId);
    url.searchParams.set("effect", slug);
    return url.toString();
  } catch {
    return base;
  }
}

function metaFor(slug: string): CatalogEffect {
  return SHOWCASE_EFFECTS.find((effect) => effect.slug === slug) ?? SHOWCASE_EFFECTS[0]!;
}

function typeLabel(effect: CatalogEffect) {
  return effect.type === "avatar_decoration" ? "Avatar decoration" : "Full-profile effect";
}

function EffectsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const osReduced = useReducedMotion();
  const reduced = Boolean(profile?.reduced_motion) || Boolean(osReduced);

  const [selectedSlug, setSelectedSlug] = useState(SHOWCASE_EFFECTS[0]!.slug);
  const [shopOpen, setShopOpen] = useState(false);
  const [busy, setBusy] = useState<"buy" | "apply" | "remove" | null>(null);
  const [shopError, setShopError] = useState<string | null>(null);

  const selectedAsset = CINEMATIC_BY_SLUG[selectedSlug] ?? CINEMATIC_EFFECTS[0]!;
  const selected = metaFor(selectedAsset.slug);
  const pawPrice = effectPawPrice(selected);
  const checkoutBase = checkoutFor(selected.slug);
  const checkoutUrl = checkoutBase && user ? checkoutHref(checkoutBase, user.id, selected.slug) : checkoutBase;
  const balance = profile?.paw_balance ?? 0;

  const ownedQ = useQuery({
    queryKey: ["user-effects", user?.id],
    queryFn: () => fetchUserEffects(user!.id),
    enabled: !!user,
    staleTime: 30_000,
  });
  const ownedBySlug = useMemo(() => {
    const map = new Map<string, UserEffect>();
    for (const row of ownedQ.data ?? []) map.set(row.effect.slug, row);
    return map;
  }, [ownedQ.data]);
  const ownedRow = ownedBySlug.get(selected.slug);
  const owned = Boolean(ownedRow);
  const equipped = Boolean(ownedRow?.equipped);

  const displayName = profile?.display_name || profile?.username || "you";
  const username = profile?.username || "you";
  const initial = displayName.charAt(0).toUpperCase();

  useEffect(() => {
    setShopError(null);
  }, [selected.slug, shopOpen]);

  const choose = (asset: CinematicAsset) => {
    setSelectedSlug(asset.slug);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    }
  };

  const invalidate = async () => {
    if (user) {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["user-effects", user.id] }),
        qc.invalidateQueries({ queryKey: ["equipped", user.id] }),
      ]);
    }
    await refreshProfile().catch(() => undefined);
  };

  const buyWithPaws = async () => {
    if (!user) {
      nav({ to: "/login" });
      return;
    }
    setBusy("buy");
    setShopError(null);
    try {
      const result = await purchaseEffectWithPaws(selected.slug);
      await invalidate();
      toast.success(
        result.status === "owned"
          ? `${selected.name} is already in your collection`
          : `${selected.name} unlocked and applied to your profile`,
      );
      setShopOpen(false);
    } catch (error) {
      setShopError(error instanceof Error ? error.message : "Couldn't unlock this effect.");
    } finally {
      setBusy(null);
    }
  };

  const apply = async () => {
    setBusy("apply");
    try {
      await equipProfileEffect(selected.slug);
      await invalidate();
      toast.success(`${selected.name} applied`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't apply this effect.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy("remove");
    try {
      await unequipProfileEffect(selected.slug);
      await invalidate();
      toast.success(`${selected.name} removed from your profile`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't remove this effect.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-1 py-2 sm:py-6">
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
        <Link
          to="/drops"
          className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/[0.07] px-3 text-xs font-bold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <PawPrint className="h-3.5 w-3.5" />
          {formatNumber(balance)} Paws
          <span className="font-medium text-muted-foreground">· earn</span>
        </Link>
      </div>

      <div className="mb-5">
        <div className="mb-2 flex flex-wrap items-center gap-2.5">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Effects</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-signal,#c8ff3d)]/35 bg-[var(--brand-signal,#c8ff3d)]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--brand-signal,#c8ff3d)]">
            <Sparkles className="h-3 w-3" /> Live collection
          </span>
          {!COSMETICS_ENABLED && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-300">
              <Lock className="h-3 w-3" /> Preview only
            </span>
          )}
        </div>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          One full-profile effect, three avatar decorations. Unlock with Paws earned from bounties,
          then apply the look straight to your profile.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Paws are earned by claiming bounties. Card checkout is available only when the operator
          has connected a checkout link and a fulfilment webhook.
        </p>
      </div>

      <div className="mb-7 rounded-2xl border border-[var(--brand-line,rgba(244,241,231,0.13))] bg-[var(--brand-ink-2,#131315)] p-3 sm:p-4">
        <div className="mb-3 flex items-start justify-between gap-3 px-0.5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Now previewing
            </p>
            <h2 className="truncate font-display text-lg font-bold sm:text-xl">{selected.name}</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{typeLabel(selected)}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <RarityPill rarity={selected.rarity} />
            {equipped && (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                Applied
              </span>
            )}
            {owned && !equipped && (
              <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                Owned
              </span>
            )}
          </div>
        </div>

        {selected.type === "avatar_decoration" ? (
          <div className="relative overflow-hidden rounded-xl border border-white/5 bg-[#08080b]">
            <div className="relative flex aspect-[16/9] items-center justify-center">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background: `radial-gradient(60% 95% at 50% 50%, ${selectedAsset.accent}33, transparent 70%)`,
                }}
              />
              <div className="relative z-10 scale-[1.35] sm:scale-[1.5]">
                <AvatarDecoration
                  src={profile?.avatar_url}
                  fallback={initial}
                  size={112}
                  effectSlug={selected.slug}
                  accent={selected.preview_color}
                  preview
                  reducedMotion={reduced}
                  className="rounded-full ring-4 ring-white/75"
                />
              </div>
              <div className="absolute inset-x-3 bottom-3 z-20 flex items-end gap-2.5">
                <div className="min-w-0 rounded-xl bg-black/45 px-3 py-1.5 backdrop-blur-md">
                  <p className="truncate font-display text-sm font-bold text-white drop-shadow-md">
                    {displayName}
                  </p>
                  <p className="truncate text-[11px] text-white/65">@{username}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-xl border border-white/5 bg-[#08080b]">
            <div className="relative aspect-video">
              <CinematicEffect
                slug={selectedAsset.slug}
                accent={selected.preview_color}
                reducedMotion={reduced}
                fit="cover"
                priority
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
              <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-signal,#c8ff3d)]" />
                Full profile
              </div>
              <div className="absolute inset-x-3 bottom-3 flex items-end gap-2.5">
                <Avatar className="h-10 w-10 shrink-0 shadow-lg ring-2 ring-white/75">
                  {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
                  <AvatarFallback className="bg-white/15 text-sm font-bold text-white">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 pb-0.5">
                  <p className="truncate font-display text-sm font-bold text-white drop-shadow-md">
                    {displayName}
                  </p>
                  <p className="truncate text-[11px] text-white/65">@{username}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 px-0.5">
          {!user ? (
            <Button
              asChild
              className="h-10 rounded-full bg-[var(--brand-signal,#c8ff3d)] px-5 text-sm font-bold text-[var(--brand-signal-ink,#0a0a0b)]"
            >
              <Link to="/login">Sign in to unlock</Link>
            </Button>
          ) : equipped ? (
            <Button
              type="button"
              variant="outline"
              onClick={remove}
              disabled={busy === "remove"}
              className="h-10 rounded-full border-white/10 bg-white/5"
            >
              {busy === "remove" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Applied · remove
            </Button>
          ) : owned ? (
            <Button
              type="button"
              onClick={apply}
              disabled={busy === "apply"}
              className="h-10 rounded-full bg-[var(--brand-signal,#c8ff3d)] px-5 text-sm font-bold text-[var(--brand-signal-ink,#0a0a0b)] hover:bg-[var(--brand-signal,#c8ff3d)]/90"
            >
              {busy === "apply" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Apply to profile
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => setShopOpen(true)}
              className="h-10 rounded-full bg-[var(--brand-signal,#c8ff3d)] px-5 text-sm font-bold text-[var(--brand-signal-ink,#0a0a0b)] hover:bg-[var(--brand-signal,#c8ff3d)]/90"
            >
              <PawPrint className="h-4 w-4" /> Unlock for {formatNumber(pawPrice)} Paws
            </Button>
          )}

          {profile?.username ? (
            <Button
              asChild
              variant="outline"
              className="h-10 rounded-full border-white/10 bg-white/5"
            >
              <a
                href={`/u/${encodeURIComponent(profile.username)}?previewEffect=${encodeURIComponent(
                  selectedAsset.slug,
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                <Eye className="h-4 w-4" /> Preview on profile
              </a>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled
              className="h-10 rounded-full border-white/10 bg-white/5"
              title="Sign in to preview this on a profile"
            >
              <Eye className="h-4 w-4" /> Preview on profile
            </Button>
          )}
          <span className="text-[11px] text-muted-foreground">One-time unlock · 9.6s loop</span>
        </div>

        <div className="mt-2 px-0.5">
          <p className="text-sm leading-relaxed text-muted-foreground">{selected.description}</p>
        </div>
      </div>

      <section>
        <div className="mb-2.5 flex items-baseline justify-between gap-3 px-0.5">
          <div>
            <h2 className="font-display text-base font-bold sm:text-lg">The collection</h2>
            <p className="text-xs text-muted-foreground">
              One full-profile effect. Three avatar decorations.
            </p>
          </div>
          <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
            {SHOWCASE_EFFECTS.length}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CINEMATIC_EFFECTS.map((asset) => {
            const meta = metaFor(asset.slug);
            const isSelected = asset.slug === selectedAsset.slug;
            const row = ownedBySlug.get(asset.slug);
            const isEquipped = Boolean(row?.equipped);
            return (
              <button
                key={asset.slug}
                type="button"
                onClick={() => choose(asset)}
                aria-pressed={isSelected}
                aria-label={`Preview ${meta.name}`}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border bg-[var(--brand-ink-2,#131315)] p-1.5 text-left transition-colors",
                  isSelected
                    ? "border-[var(--brand-signal,#c8ff3d)] ring-1 ring-[var(--brand-signal,#c8ff3d)]"
                    : "border-[var(--brand-line,rgba(244,241,231,0.13))] hover:border-white/25",
                )}
              >
                <div className="relative aspect-video overflow-hidden rounded-xl border border-white/5 bg-[#08080b]">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background: `radial-gradient(70% 85% at 50% 45%, ${asset.accent}33, transparent 72%)`,
                    }}
                  />
                  <img
                    src={asset.poster}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

                  <span className="absolute left-2 top-2 rounded-full bg-black/55 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white backdrop-blur">
                    {meta.type === "avatar_decoration" ? "Avatar" : "Profile"}
                  </span>
                  {isEquipped ? (
                    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-400 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-950">
                      <Check className="h-2.5 w-2.5" /> Applied
                    </span>
                  ) : row ? (
                    <span className="absolute right-2 top-2 rounded-full bg-white/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-black">
                      Owned
                    </span>
                  ) : isSelected ? (
                    <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[var(--brand-signal,#c8ff3d)] text-[var(--brand-signal-ink,#0a0a0b)]">
                      <Eye className="h-3.5 w-3.5" />
                    </span>
                  ) : null}

                  <div className="absolute inset-x-3 bottom-2.5 flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white drop-shadow">
                        {meta.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-white/70">
                        <span style={{ color: RARITY_FLAT[meta.rarity] }}>{meta.rarity}</span>
                        <span aria-hidden> · </span>
                        {formatNumber(effectPawPrice(meta))} Paws
                      </p>
                    </div>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur">
                      <Play className="h-3.5 w-3.5 fill-current" />
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <p className="mt-6 px-0.5 text-[11px] leading-relaxed text-muted-foreground">
        Paws come from real bounty claims.{" "}
        <Link to="/drops" className="underline underline-offset-4 hover:text-foreground">
          Earn Paws in Bounties
        </Link>
        . The stage and every card are built from the real 9.6-second loop.{" "}
        <Link
          to="/settings/preferences"
          className="underline underline-offset-4 hover:text-foreground"
        >
          Reduce motion
        </Link>{" "}
        in preferences holds it on a still frame. Profile previews open in a new tab.
      </p>

      <ShopDialog
        open={shopOpen}
        onOpenChange={setShopOpen}
        effect={selected}
        asset={selectedAsset}
        signedIn={Boolean(user)}
        balance={balance}
        owned={owned}
        busy={busy === "buy"}
        error={shopError}
        checkoutUrl={checkoutUrl}
        onBuy={buyWithPaws}
        onEarn={() => {
          setShopOpen(false);
          nav({ to: "/drops" });
        }}
      />
    </div>
  );
}

function RarityPill({ rarity }: { rarity: CatalogEffect["rarity"] }) {
  const color = RARITY_FLAT[rarity];
  return (
    <span
      className="shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{ color, borderColor: `${color}66`, background: `${color}1a` }}
    >
      {rarity}
    </span>
  );
}

function ShopDialog({
  open,
  onOpenChange,
  effect,
  asset,
  signedIn,
  balance,
  owned,
  busy,
  error,
  checkoutUrl,
  onBuy,
  onEarn,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  effect: CatalogEffect;
  asset: CinematicAsset;
  signedIn: boolean;
  balance: number;
  owned: boolean;
  busy: boolean;
  error: string | null;
  checkoutUrl: string | null;
  onBuy: () => void;
  onEarn: () => void;
}) {
  const price = effectPawPrice(effect);
  const shortfall = Math.max(price - balance, 0);
  const canAfford = balance >= price;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100%_-_1.5rem)] max-w-md gap-0 overflow-y-auto overflow-x-hidden rounded-2xl border-white/10 bg-[var(--brand-ink-2,#131315)] p-0 text-foreground">
        <div className="relative aspect-[3/1] overflow-hidden bg-[#08080b]">
          <img src={asset.poster} alt="" className="h-full w-full object-cover opacity-90" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--brand-ink-2,#131315)] via-transparent to-transparent" />
        </div>

        <div className="p-5">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="font-display text-xl">Unlock {effect.name}</DialogTitle>
                <DialogDescription className="mt-1">
                  {typeLabel(effect)} · one-time unlock.
                </DialogDescription>
              </div>
              <RarityPill rarity={effect.rarity} />
            </div>
          </DialogHeader>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Paws price
              </p>
              <p className="font-display text-lg font-bold">{formatNumber(price)} Paws</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Balance
              </p>
              <p
                className={cn(
                  "font-display text-sm font-bold",
                  canAfford ? "text-emerald-300" : "text-amber-300",
                )}
              >
                {formatNumber(balance)} Paws
              </p>
            </div>
          </div>

          {owned ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-xs text-emerald-200">
              <Check className="h-4 w-4 shrink-0" /> Already in your collection.
            </div>
          ) : null}

          {error && (
            <div className="mt-4 rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-xs leading-relaxed text-red-200">
              {error}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2">
            {!signedIn ? (
              <Button
                asChild
                className="h-10 rounded-full bg-[var(--brand-signal,#c8ff3d)] text-sm font-bold text-[var(--brand-signal-ink,#0a0a0b)] hover:bg-[var(--brand-signal,#c8ff3d)]/90"
              >
                <Link to="/login">Sign in to unlock with Paws</Link>
              </Button>
            ) : owned ? (
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-10 rounded-full bg-[var(--brand-signal,#c8ff3d)] text-sm font-bold text-[var(--brand-signal-ink,#0a0a0b)]"
              >
                <Check className="h-4 w-4" /> Owned
              </Button>
            ) : canAfford ? (
              <Button
                type="button"
                onClick={onBuy}
                disabled={busy}
                className="h-10 rounded-full bg-[var(--brand-signal,#c8ff3d)] text-sm font-bold text-[var(--brand-signal-ink,#0a0a0b)] hover:bg-[var(--brand-signal,#c8ff3d)]/90"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PawPrint className="h-4 w-4" />
                )}
                Unlock for {formatNumber(price)} Paws
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  onClick={onEarn}
                  className="h-10 rounded-full bg-[var(--brand-signal,#c8ff3d)] text-sm font-bold text-[var(--brand-signal-ink,#0a0a0b)] hover:bg-[var(--brand-signal,#c8ff3d)]/90"
                >
                  <PawPrint className="h-4 w-4" /> Earn {formatNumber(shortfall)} more Paws
                </Button>
                <p className="text-center text-[11px] text-muted-foreground">
                  Claim bounties to top up your wallet.
                </p>
              </>
            )}

            {checkoutUrl ? (
              signedIn ? (
                <Button
                  asChild
                  variant="outline"
                  className="h-10 rounded-full border-white/10 bg-white/5"
                >
                  <a href={checkoutUrl} target="_blank" rel="noreferrer">
                    Buy with card · ${asset.priceUsd.toFixed(2)} <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              ) : (
                <Button
                  asChild
                  variant="outline"
                  className="h-10 rounded-full border-white/10 bg-white/5"
                >
                  <Link to="/login">Sign in to buy with card</Link>
                </Button>
              )
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled
                className="h-10 rounded-full border-white/10 bg-white/5 text-muted-foreground"
              >
                <Lock className="h-4 w-4" /> Card checkout not connected
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              className="h-9 rounded-full text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onOpenChange(false)}
            >
              Keep previewing
            </Button>
          </div>

          <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
            {checkoutUrl
              ? "Paws unlock instantly. Card checkout opens in a new tab and is fulfilled separately."
              : "Paws unlock instantly. No card checkout is connected in this build."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
