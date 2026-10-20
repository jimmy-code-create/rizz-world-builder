import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  Eye,
  Lock,
  Play,
  ShieldAlert,
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
import { useAuth } from "@/lib/auth";
import {
  COSMETICS_ENABLED,
  DISCORD_SHOWCASE_EFFECTS,
  RARITY_FLAT,
  type ProfileEffect as CatalogEffect,
} from "@/lib/effects";
import { CINEMATIC_BY_SLUG, CINEMATIC_EFFECTS, type CinematicAsset } from "@/lib/cinematic-effects";
import { CinematicEffect } from "@/components/profile/CinematicEffect";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/effects")({
  head: () => ({ meta: [{ title: "Effects · RIZZ" }] }),
  component: EffectsPage,
});

/**
 * Checkout links are optional. A single default link or a per-effect link can
 * be supplied at build time. Without one, the buy sheet offers a local
 * save-for-launch marker instead of pretending a charge happened.
 */
const env = import.meta.env as Record<string, string | undefined>;
const DEFAULT_CHECKOUT = env.VITE_EFFECTS_CHECKOUT_URL;
const CHECKOUT_BY_SLUG: Record<string, string | undefined> = {
  "fx-web-slinger": env.VITE_EFFECTS_CHECKOUT_WEB_SLINGER,
  "fx-sakura-bloom": env.VITE_EFFECTS_CHECKOUT_SAKURA_BLOOM,
  "fx-arcane-nexus": env.VITE_EFFECTS_CHECKOUT_ARCANE_NEXUS,
  "fx-sakura-storm": env.VITE_EFFECTS_CHECKOUT_SAKURA_STORM,
};
const CHECKOUT_CONFIGURED = Boolean(
  DEFAULT_CHECKOUT ||
  Object.entries(CHECKOUT_BY_SLUG).some(
    ([slug, url]) => Boolean(url) && !CINEMATIC_BY_SLUG[slug]?.rightsReview,
  ),
);

function checkoutFor(slug: string): string | null {
  return CHECKOUT_BY_SLUG[slug] || DEFAULT_CHECKOUT || null;
}

function metaFor(slug: string): CatalogEffect {
  return (
    DISCORD_SHOWCASE_EFFECTS.find((effect) => effect.slug === slug) ?? DISCORD_SHOWCASE_EFFECTS[0]!
  );
}

function EffectsPage() {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const stageRef = useRef<HTMLDivElement>(null);
  const osReduced = useReducedMotion();
  const reduced = Boolean(profile?.reduced_motion) || Boolean(osReduced);
  const [playback, setPlayback] = useState<"live" | "still">("still");
  const still = reduced || playback === "still";

  const [selectedSlug, setSelectedSlug] = useState(CINEMATIC_EFFECTS[0]!.slug);
  const [buyOpen, setBuyOpen] = useState(false);
  const selectedAsset = CINEMATIC_BY_SLUG[selectedSlug] ?? CINEMATIC_EFFECTS[0]!;
  const selected = metaFor(selectedAsset.slug);

  const displayName = profile?.display_name || profile?.username || "you";
  const username = profile?.username || "you";
  const initial = displayName.charAt(0).toUpperCase();

  const storageKey = `rizz_effects_saved_${user?.id || "guest"}_${selectedAsset.slug}`;
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      setSaved(localStorage.getItem(storageKey) === "true");
    } catch {
      // localStorage can be unavailable in private or embedded contexts.
    }
  }, [storageKey]);
  const toggleSaved = () => {
    const next = !saved;
    setSaved(next);
    try {
      localStorage.setItem(storageKey, String(next));
    } catch {
      // A failed write must not break the buy sheet.
    }
  };

  const choose = (asset: CinematicAsset) => {
    setSelectedSlug(asset.slug);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      </div>

      <div className="mb-5">
        <div className="mb-2 flex flex-wrap items-center gap-2.5">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Effects</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-signal,#c8ff3d)]/35 bg-[var(--brand-signal,#c8ff3d)]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--brand-signal,#c8ff3d)]">
            <Sparkles className="h-3 w-3" /> Cinematic collection
          </span>
          {!COSMETICS_ENABLED && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-300">
              <Lock className="h-3 w-3" /> Preview only
            </span>
          )}
        </div>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          Four cinematic profile effects cut and cleaned from one reel. The stage plays the real
          loop on supported browsers; every card is a frame from that same loop.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {!COSMETICS_ENABLED
            ? "Previews are ready. Checkout and equipping open when cosmetics launch."
            : CHECKOUT_CONFIGURED
              ? "Checkout is available in the buy sheet."
              : "Checkout is not connected in this build; save the effect in the buy sheet."}
        </p>
      </div>

      <div
        ref={stageRef}
        className="mb-7 scroll-mt-20 rounded-2xl border border-[var(--brand-line,rgba(244,241,231,0.13))] bg-[var(--brand-ink-2,#131315)] p-3 sm:p-4"
      >
        <div className="mb-3 flex items-start justify-between gap-3 px-0.5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Now previewing
            </p>
            <h2 className="truncate font-display text-lg font-bold sm:text-xl">{selected.name}</h2>
          </div>
          <RarityPill rarity={selected.rarity} />
        </div>

        <div className="relative overflow-hidden rounded-xl border border-white/5 bg-[#08080b]">
          <div className="relative aspect-video">
            <CinematicEffect
              slug={selectedAsset.slug}
              accent={selected.preview_color}
              reducedMotion={reduced}
              onPlaybackChange={setPlayback}
              fit="cover"
              priority
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />

            <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-md">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  still ? "bg-white/45" : "animate-pulse bg-[var(--brand-signal,#c8ff3d)]",
                )}
              />
              {still ? "Still preview" : "Live preview"}
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

        <div className="mt-3 flex flex-wrap items-center gap-2 px-0.5">
          <Button
            type="button"
            onClick={() => setBuyOpen(true)}
            className="h-10 rounded-full bg-[var(--brand-signal,#c8ff3d)] px-5 text-sm font-bold text-[var(--brand-signal-ink,#0a0a0b)] hover:bg-[var(--brand-signal,#c8ff3d)]/90"
          >
            {selectedAsset.rightsReview
              ? "Rights review"
              : `Buy $${selectedAsset.priceUsd.toFixed(2)}`}
          </Button>
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
          <span className="text-[11px] text-muted-foreground">
            {selectedAsset.rightsReview
              ? "Preview only · 9.6s loop"
              : "One-time unlock · 9.6s loop"}
          </span>
        </div>

        <div className="mt-2 px-0.5">
          <p className="text-sm leading-relaxed text-muted-foreground">{selected.description}</p>
          {selectedAsset.rightsReview && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-300/90">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Supplied character footage. Checkout stays locked until the rights review is cleared.
            </p>
          )}
        </div>
      </div>

      <section>
        <div className="mb-2.5 flex items-baseline justify-between gap-3 px-0.5">
          <div>
            <h2 className="font-display text-base font-bold sm:text-lg">The collection</h2>
            <p className="text-xs text-muted-foreground">Four loops. One reel. Real previews.</p>
          </div>
          <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
            4
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CINEMATIC_EFFECTS.map((asset) => {
            const meta = metaFor(asset.slug);
            const isSelected = asset.slug === selectedAsset.slug;
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
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                  <span className="absolute left-2 top-2 rounded-full bg-[var(--brand-signal,#c8ff3d)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[var(--brand-signal-ink,#0a0a0b)]">
                    New
                  </span>
                  {asset.rightsReview && (
                    <span className="absolute left-2 top-8 rounded-full border border-amber-400/30 bg-black/55 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-amber-200 backdrop-blur">
                      Rights check
                    </span>
                  )}
                  {isSelected && (
                    <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[var(--brand-signal,#c8ff3d)] text-[var(--brand-signal-ink,#0a0a0b)]">
                      <Eye className="h-3.5 w-3.5" />
                    </span>
                  )}

                  <div className="absolute inset-x-3 bottom-2.5 flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white drop-shadow">
                        {meta.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-white/65">
                        <span style={{ color: RARITY_FLAT[meta.rarity] }}>{meta.rarity}</span>
                        <span aria-hidden> · </span>${asset.priceUsd.toFixed(2)}
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
        The stage and every card are built from the real 9.6-second loop; nothing here is a stand-in
        illustration.{" "}
        <Link
          to="/settings/preferences"
          className="underline underline-offset-4 hover:text-foreground"
        >
          Reduce motion
        </Link>{" "}
        in preferences holds it on a still frame. Profile previews open in a new tab.
      </p>

      <BuyDialog
        open={buyOpen}
        onOpenChange={setBuyOpen}
        effect={selected}
        asset={selectedAsset}
        signedIn={Boolean(user)}
        saved={saved}
        onSave={toggleSaved}
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

function BuyDialog({
  open,
  onOpenChange,
  effect,
  asset,
  signedIn,
  saved,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  effect: CatalogEffect;
  asset: CinematicAsset;
  signedIn: boolean;
  saved: boolean;
  onSave: () => void;
}) {
  const checkoutUrl = asset.rightsReview ? null : checkoutFor(asset.slug);
  const canCheckout = COSMETICS_ENABLED && !asset.rightsReview && Boolean(checkoutUrl);

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
                <DialogTitle className="font-display text-xl">
                  {asset.rightsReview ? `Rights review: ${effect.name}` : `Unlock ${effect.name}`}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {asset.rightsReview
                    ? "Supplied third-party character footage. This preview is not for sale yet."
                    : `One cinematic profile loop. $${asset.priceUsd.toFixed(2)} one-time.`}
                </DialogDescription>
              </div>
              <RarityPill rarity={effect.rarity} />
            </div>
          </DialogHeader>

          {asset.rightsReview && (
            <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-200">
              <p className="flex items-center gap-1.5 font-semibold">
                <ShieldAlert className="h-3.5 w-3.5" /> Rights review required
              </p>
              <p className="mt-1 text-amber-200/80">
                This clip contains supplied third-party character footage. Checkout is intentionally
                locked until the rights to sell it are confirmed.
              </p>
            </div>
          )}

          {!asset.rightsReview && !COSMETICS_ENABLED && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-relaxed">
              <p className="font-semibold text-foreground">Checkout opens at launch.</p>
              <p className="mt-1 text-muted-foreground">
                Cosmetics are paused, so unlocks cannot be equipped yet. Save this effect on this
                device for launch; this only marks it in this browser.
              </p>
            </div>
          )}

          {!asset.rightsReview && COSMETICS_ENABLED && !checkoutUrl && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-relaxed">
              <p className="font-semibold text-foreground">
                Checkout is not connected in this build.
              </p>
              <p className="mt-1 text-muted-foreground">
                Save this effect on this device for later; this only marks it in this browser.
              </p>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                One-time
              </p>
              <p className="font-display text-lg font-bold">${asset.priceUsd.toFixed(2)}</p>
            </div>
            <p className="text-right text-[11px] text-muted-foreground">
              {asset.rightsReview ? "Preview only" : "Lifetime unlock"}
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {canCheckout ? (
              signedIn ? (
                <Button
                  asChild
                  className="h-10 rounded-full bg-[var(--brand-signal,#c8ff3d)] text-sm font-bold text-[var(--brand-signal-ink,#0a0a0b)] hover:bg-[var(--brand-signal,#c8ff3d)]/90"
                >
                  <a href={checkoutUrl!} target="_blank" rel="noreferrer">
                    Continue to secure checkout <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              ) : (
                <Button
                  asChild
                  className="h-10 rounded-full bg-[var(--brand-signal,#c8ff3d)] text-sm font-bold text-[var(--brand-signal-ink,#0a0a0b)] hover:bg-[var(--brand-signal,#c8ff3d)]/90"
                >
                  <Link to="/login">Sign in to buy</Link>
                </Button>
              )
            ) : (
              <Button
                type="button"
                onClick={onSave}
                className={cn(
                  "h-10 rounded-full border px-4 text-sm font-semibold",
                  saved
                    ? "border-[var(--brand-signal,#c8ff3d)]/60 bg-[var(--brand-signal,#c8ff3d)]/15 text-[var(--brand-signal,#c8ff3d)] hover:bg-[var(--brand-signal,#c8ff3d)]/25"
                    : "border-transparent bg-[var(--brand-signal,#c8ff3d)] text-[var(--brand-signal-ink,#0a0a0b)] hover:bg-[var(--brand-signal,#c8ff3d)]/90",
                )}
              >
                {saved ? (
                  <>
                    <Check className="h-4 w-4" /> Saved on this device
                  </>
                ) : (
                  <>
                    <Bookmark className="h-4 w-4" /> Save on this device
                  </>
                )}
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
            {asset.rightsReview
              ? "No payment is taken for this clip."
              : canCheckout
                ? "Checkout opens in a new tab. Keep your receipt; fulfilment is confirmed separately."
                : "No payment is taken in this build."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
