import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Coins,
  Film,
  Image,
  Loader2,
  Lock,
  Palette,
  RefreshCw,
  ShieldCheck,
  Smile,
  Sparkles,
  Sticker,
  Upload,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/badges/Badge";
import { ReactionPills } from "@/components/reactions/ReactionPills";
import { CatEmoji } from "@/components/emoji/CatEmoji";
import { BANNER_PRESETS, gradientCss } from "@/lib/banner";
import {
  PURIFY_PERKS,
  PURIFY_PRICE_LABEL,
  PURIFY_PRICE_SHORT,
  isPurifyActive,
  usePurify,
  type PurifyPerkIcon,
} from "@/lib/purify";
import { startPurifyCheckout } from "@/lib/purify-checkout";
import { markPaywallSeen, openPurifyPaywall } from "@/lib/purify-paywall";
import { PurifyShield } from "@/components/purify/PurifyShield";

export const Route = createFileRoute("/_app/purify")({
  head: () => ({ meta: [{ title: "Purify · RIZZ" }] }),
  component: PurifyPage,
});

const PERK_ICONS: Record<PurifyPerkIcon, LucideIcon> = {
  bounty: Coins,
  super: Sparkles,
  animated: Sticker,
  badge: ShieldCheck,
  gradient: Palette,
  banner: Image,
  gif: Film,
  upload: Upload,
  emoji: Smile,
};

/** One real preset, so the gradient example is the actual profile wash. */
const DEMO_GRADIENT = BANNER_PRESETS[0];

function formatUntil(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * The demo strip: the three perks that are easiest to feel, drawn with the
 * real components in a demo state — the same badge, the same pill row, the
 * same button — so what a member sees here is what they get.
 */
const DEMO_REACTIONS = [
  { key: "💀", count: 3, mine: false },
  { key: "😂", count: 2, mine: true },
  { key: "🔥", count: 1, mine: false, superCount: 1 },
];

/**
 * Purify is the $1/month tier. This page is the only place that starts billing;
 * every gate in the app links here or opens the paywall sheet.
 *
 * It is a page, not an advert: no video, nothing that can fail to load, no
 * member counts we cannot back up. The motion is entrance-only and disappears
 * entirely under reduced motion.
 */
function PurifyPage() {
  const { session, profile, refreshProfile } = useAuth();
  const { active, until, enforced } = usePurify();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const [starting, setStarting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // `refreshProfile` updates context state; the restore answer is read from the
  // ref so it sees the refreshed row rather than the one this render started with.
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const glowShift = useTransform(scrollYProgress, [0, 1], [0, 44]);
  const endsOn = formatUntil(until);

  /** Staggered entrance, 250–350ms ease-out; no motion at all under reduce. */
  const enter = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.32, ease: "easeOut" as const, delay },
        };

  async function startCheckout() {
    if (starting) return;
    setStarting(true);
    setNotice(null);
    try {
      window.location.href = await startPurifyCheckout(session?.access_token);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Couldn't start checkout.";
      setNotice(message);
      toast.error(message);
    } finally {
      setStarting(false);
    }
  }

  async function restore() {
    if (restoring) return;
    setRestoring(true);
    try {
      await refreshProfile();
      // The refreshed profile lands as context state; give React one beat.
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (isPurifyActive(profileRef.current)) {
        toast.success("Purify is back on this account");
      } else {
        toast.info("No active subscription found", {
          description: "If you just subscribed, give it a minute and try again.",
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't check your subscription.");
    } finally {
      setRestoring(false);
    }
  }

  function maybeLater() {
    markPaywallSeen();
    // Replace, so Back returns to where the member came from.
    void navigate({ to: "/feed", replace: true });
  }

  return (
    // `w-full` is load-bearing: without it this flex child sizes to the swipe
    // strip's max-content on a phone, and every card runs off the right edge.
    <div className="mx-auto w-full min-w-0 max-w-xl space-y-4 pb-10">
      <Link
        to="/settings"
        className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Settings
      </Link>

      {/* Hero: the mark, a headline, one line. The glow drifts a little slower
          than the content — the only parallax on the page. */}
      <section
        ref={heroRef}
        className="glass relative overflow-hidden rounded-3xl border border-white/5 px-5 py-8 text-center"
      >
        <motion.div
          aria-hidden="true"
          style={reduceMotion ? undefined : { y: glowShift }}
          className="pointer-events-none absolute inset-x-0 -top-24 h-64"
        >
          <span
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 70% at 50% 45%, color-mix(in srgb, var(--primary) 26%, transparent), transparent 72%)",
            }}
          />
        </motion.div>

        <div className="relative">
          <motion.div {...enter(0)} className="mx-auto w-fit">
            <PurifyShield size={84} />
          </motion.div>

          <motion.h1
            {...enter(0.06)}
            className="mt-4 font-display text-[30px] font-bold leading-tight tracking-tight"
          >
            Everything unlocked.
          </motion.h1>
          <motion.p {...enter(0.1)} className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
            From escrow bounties to a full profile gradient — every unlock, the animated cats and
            your realm's emoji, for the price of one coffee a month.
          </motion.p>
        </div>
      </section>

      {/* Perks, straight from the config — one edit there changes this list,
          the sheet and any copy that quotes it. */}
      {PURIFY_PERKS.length > 0 && (
        <motion.section {...enter(0.14)} className="glass rounded-2xl border border-white/5 p-4">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            What Purify unlocks
          </h2>
          <ul className="mt-3 divide-y divide-white/5">
            {PURIFY_PERKS.map((perk) => {
              const Icon = PERK_ICONS[perk.icon] ?? Sparkles;
              return (
                <li key={perk.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{perk.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      {perk.detail}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </motion.section>
      )}

      {/* Live strip: real components in a demo state, swipeable, no video. */}
      <motion.section {...enter(0.18)}>
        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          See it in action
        </h2>
        <div className="-mx-3 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-4 sm:px-4">
          <div className="w-[236px] shrink-0 snap-start rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Profile
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Avatar className="h-9 w-9 border border-white/10">
                <AvatarFallback className="bg-primary/15 text-xs font-bold text-primary">KE</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-sm font-bold">
                  kesoku
                  <Badge type="premium" size={16} noTooltip label="Purify" hint="Subscriber" />
                </p>
                <p className="truncate text-[11px] text-muted-foreground">@kesoku_1234</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              The amethyst crest sits beside your name everywhere.
            </p>
          </div>

          <div className="w-[236px] shrink-0 snap-start rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Animated emoji
            </p>
            <div className="mt-2 flex items-end gap-1.5">
              <CatEmoji name="cat_cool" size={32} animate="loop" preview />
              <CatEmoji name="cat_music" size={32} animate="loop" preview />
              <CatEmoji name="cat_love" size={32} animate="loop" preview />
              <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                <Lock className="h-2.5 w-2.5" aria-hidden="true" /> Purify
              </span>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Twelve faces that move. Free accounts keep the still set.
            </p>
          </div>

          <div className="w-[236px] shrink-0 snap-start rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Gradient
            </p>
            <div
              className="mt-2 overflow-hidden rounded-xl border border-white/10"
              style={{ background: gradientCss(DEMO_GRADIENT) }}
            >
              <div className="h-9 bg-black/15" />
              <div className="flex items-center gap-2 px-2 pb-2 pt-1">
                <Avatar className="h-8 w-8 border-2 border-black/30">
                  <AvatarFallback className="bg-black/40 text-[10px] font-bold text-white">KE</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white">kesoku</p>
                  <p className="truncate text-[10px] text-white/70">@kesoku_1234</p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              16 gradients across the whole profile, not just the banner box.
            </p>
          </div>

          <div className="w-[236px] shrink-0 snap-start rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Post
            </p>
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed">
              dropping the trailer tonight, no cap 🎬
            </p>
            <ReactionPills
              groups={DEMO_REACTIONS}
              onToggle={() => openPurifyPaywall("Super reactions")}
              className="mt-2"
            />
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              A super reaction leads the row with a glow.
            </p>
          </div>

          <div className="w-[236px] shrink-0 snap-start rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Bounty
            </p>
            <p className="mt-2 text-sm font-semibold leading-snug">Design three sticker frames</p>
            <p className="mt-1 inline-flex rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
              500 Paws
            </p>
            <button
              type="button"
              className="mt-3 h-11 w-full rounded-xl bg-primary text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Take it
            </button>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Escrow holds the prize until the work is reviewed.
            </p>
          </div>
        </div>
        <p className="mt-2 px-1 text-[11px] text-muted-foreground">Swipe for more →</p>
      </motion.section>

      {/* Pricing: one number, one promise, one button. */}
      <motion.section {...enter(0.22)} className="glass rounded-3xl border border-white/5 p-5 text-center">
        <p className="font-display text-4xl font-bold text-primary">{PURIFY_PRICE_LABEL}</p>
        <p className="mt-1 text-xs text-muted-foreground">Billed monthly. Cancel anytime.</p>

        {active ? (
          <p className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-3 text-xs font-semibold">
            <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            Active{endsOn ? ` · renews ${endsOn}` : ""}
          </p>
        ) : (
          <div className="mt-4">
            <Button
              type="button"
              onClick={() => void startCheckout()}
              disabled={starting}
              className="h-12 w-full gap-2 text-[15px] font-bold"
            >
              {starting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {starting ? "Opening checkout…" : `Get Purify · ${PURIFY_PRICE_SHORT}`}
            </Button>

            <button
              type="button"
              onClick={() => void restore()}
              disabled={restoring}
              className="mt-1 inline-flex min-h-11 w-full items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <RefreshCw className={restoring ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} aria-hidden="true" />
              Restore purchase
            </button>
          </div>
        )}

        {notice && (
          <p role="status" className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            {notice}
          </p>
        )}

        {!enforced && (
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Billing opens soon. Animated cats are already members-only; everything else stays
            free until launch.
          </p>
        )}
      </motion.section>

      {!active && (
        <motion.div {...enter(0.26)} className="text-center">
          <button
            type="button"
            onClick={maybeLater}
            className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Maybe later
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </motion.div>
      )}

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        If Purify ends, nothing you already set is taken away — your current banner and gradient
        stay exactly as they are. Only new gradient or banner changes ask for Purify again.
      </p>
    </div>
  );
}
