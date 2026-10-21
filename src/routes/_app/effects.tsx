import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Download,
  Eye,
  Layers3,
  Loader2,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  downloadReceipt,
  downloadReceiptText,
  loadStoredReceipts,
  newOrderId,
  receiptLines,
  storeReceipt,
  type EffectOrder,
} from "@/lib/effect-receipt";
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
  const [receipt, setReceipt] = useState<EffectOrder | null>(null);
  const [pending, setPending] = useState<ProfileEffect | null>(null);
  const [receipts, setReceipts] = useState<EffectOrder[]>(() => loadStoredReceipts(user?.id));
  const [slot, setSlot] = useState<"all" | ProfileEffectType>("all");
  const [ownedOnly, setOwnedOnly] = useState(false);

  useEffect(() => {
    setReceipts(loadStoredReceipts(user?.id));
  }, [user?.id]);

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
      return (data ?? {}) as { status?: string; balance?: number };
    },
    onSuccess: async (result, effect) => {
      await refreshSlotData();
      setPending(null);
      if (result.status === "owned") {
        toast.info(`${effect.name} is already in your collection`);
        return;
      }
      const order: EffectOrder = {
        id: newOrderId(),
        date: new Date().toISOString(),
        account: profile?.username ? `@${profile.username}` : "RIZZ member",
        effect,
        amount: effect.paw_price,
        balanceAfter: Number(result.balance ?? Math.max(balance - effect.paw_price, 0)),
      };
      setReceipt(order);
      if (user?.id) setReceipts(storeReceipt(user.id, order));
      toast.success(`${effect.name} unlocked and equipped`, {
        description: "Your receipt is ready to download.",
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
            Cosmetics shop
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Effects shop
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One look per slot — unlock once, wear it forever.
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

      {/* Shop wallet: balance, collection progress and the two-step promise. */}
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-[var(--brand-signal,#c8ff3d)]/20 bg-[linear-gradient(135deg,rgba(200,255,61,0.12),rgba(19,19,21,0.92)_48%,#111112)] p-4 sm:p-5">
        <div className="pointer-events-none absolute -right-14 -top-20 h-56 w-56 rounded-full bg-[var(--brand-signal,#c8ff3d)]/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-paper-dim,#a9a69c)]">
              Your wallet
            </p>
            <p className="mt-0.5 flex items-center gap-2 font-display text-2xl font-bold text-[var(--brand-signal,#c8ff3d)]">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--brand-signal,#c8ff3d)]/15">
                <Sparkles className="h-4 w-4" />
              </span>
              {formatNumber(balance)} Paws
            </p>
            <p className="mt-1 text-xs text-[var(--brand-paper-dim,#a9a69c)]">
              Buy with Paws · no card checkout · receipt after every order.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-paper-dim,#a9a69c)]">
                Collection
              </p>
              <p className="text-sm font-bold text-[var(--brand-paper,#f4f1e7)]">
                {owned.size} / {PROFILE_EFFECTS.length}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-paper-dim,#a9a69c)]">
                Worn
              </p>
              <p className="text-sm font-bold text-[var(--brand-paper,#f4f1e7)]">
                {Object.keys(equipped).length} / {PROFILE_EFFECTS.length}
              </p>
            </div>
          </div>
        </div>
        <div className="relative mt-4 flex items-center gap-2">
          <span className="text-[10px] text-[var(--brand-paper-dim,#a9a69c)]">Set progress</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[var(--brand-signal,#c8ff3d)] transition-[width] duration-500"
              style={{ width: `${(owned.size / PROFILE_EFFECTS.length) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-semibold tabular-nums text-[var(--brand-paper,#f4f1e7)]">
            {Math.round((owned.size / PROFILE_EFFECTS.length) * 100)}%
          </span>
        </div>
      </section>

      {/* Shelf controls: one slot at a time, or your collection only. */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Effect slots">
          {(["all", "avatar_decoration", "profile_effect", "profile_frame"] as const).map(
            (value) => {
              const active = slot === value;
              const label = value === "all" ? "All looks" : SLOT_META[value].label;
              const count =
                value === "all"
                  ? PROFILE_EFFECTS.length
                  : PROFILE_EFFECTS.filter((e) => e.type === value).length;
              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSlot(value)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-signal,#c8ff3d)] ${
                    active
                      ? "border-white/20 bg-white/[0.1] text-[var(--brand-paper,#f4f1e7)]"
                      : "border-[var(--brand-line,rgba(244,241,231,0.13))] text-[var(--brand-paper-dim,#a9a69c)] hover:border-white/25 hover:text-[var(--brand-paper,#f4f1e7)]"
                  }`}
                >
                  {label}
                  <span
                    className={`tabular-nums ${active ? "text-[var(--brand-signal,#c8ff3d)]" : "opacity-60"}`}
                  >
                    {count}
                  </span>
                </button>
              );
            },
          )}
        </div>
        <button
          type="button"
          aria-pressed={ownedOnly}
          onClick={() => setOwnedOnly((on) => !on)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-signal,#c8ff3d)] ${
            ownedOnly
              ? "border-[var(--brand-signal,#c8ff3d)]/50 bg-[var(--brand-signal,#c8ff3d)]/10 text-[var(--brand-signal,#c8ff3d)]"
              : "border-[var(--brand-line,rgba(244,241,231,0.13))] text-[var(--brand-paper-dim,#a9a69c)] hover:text-[var(--brand-paper,#f4f1e7)]"
          }`}
        >
          <Check className="h-3 w-3" /> Owned only
        </button>
      </div>

      {/* Three taps, spelled out: the shelf's promise in one line. */}
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {[
          { step: "1", title: "Unlock with Paws", note: "Server-checked price, no card" },
          { step: "2", title: "Wear the slot", note: "One look per slot, swap any time" },
          { step: "3", title: "Shows everywhere", note: "Profile, hover card and preview" },
        ].map((row) => (
          <div
            key={row.step}
            className="flex items-center gap-2.5 rounded-2xl border border-[var(--brand-line,rgba(244,241,231,0.13))] bg-[var(--brand-ink-2,#131315)] px-3 py-2.5"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[var(--brand-signal,#c8ff3d)]/30 bg-[var(--brand-signal,#c8ff3d)]/10 text-[10px] font-bold text-[var(--brand-signal,#c8ff3d)]">
              {row.step}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-bold text-[var(--brand-paper,#f4f1e7)]">
                {row.title}
              </span>
              <span className="block truncate text-[10px] text-[var(--brand-paper-dim,#a9a69c)]">
                {row.note}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PROFILE_EFFECTS.map((effect) => {
          if (slot !== "all" && effect.type !== slot) return null;
          if (ownedOnly && !owned.has(effect.slug)) return null;
          const worn = equipped[effect.type]?.slug === effect.slug;
          const isOwned = owned.has(effect.slug);
          const busy = pendingSlug === effect.slug;
          const short = isOwned ? 0 : Math.max(0, effect.paw_price - balance);

          return (
            <article
              key={effect.slug}
              className="group flex flex-col overflow-hidden rounded-3xl border border-[var(--brand-line,rgba(244,241,231,0.13))] bg-[var(--brand-ink-2,#131315)] transition-[border-color,box-shadow] duration-200 hover:border-white/25 hover:shadow-[0_24px_60px_-44px_rgba(0,0,0,0.9)]"
              style={{
                boxShadow: worn
                  ? `0 0 0 1px ${effect.preview_color}55, 0 18px 48px -32px ${effect.preview_color}`
                  : undefined,
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
                      className="h-10 w-full gap-2 border-white/15 bg-white/[0.04] text-[13px] font-bold text-[var(--brand-paper,#f4f1e7)] hover:bg-white/[0.08]"
                      onClick={() => remove.mutate(effect)}
                      disabled={busy}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Remove from profile
                    </Button>
                  ) : isOwned ? (
                    <Button
                      onClick={() => equip.mutate(effect)}
                      disabled={busy}
                      className="h-10 w-full gap-2 border-0 bg-[var(--brand-signal,#c8ff3d)] text-[13px] font-bold text-[#0b0b0c] shadow-[0_12px_26px_-18px_var(--brand-signal,#c8ff3d)] hover:bg-[var(--brand-signal,#c8ff3d)]/90"
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Equip
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setPending(effect)}
                      disabled={busy || short > 0}
                      className="h-10 w-full gap-2 border-0 bg-[var(--brand-signal,#c8ff3d)] text-[13px] font-bold text-[#0b0b0c] shadow-[0_12px_26px_-18px_var(--brand-signal,#c8ff3d)] hover:bg-[var(--brand-signal,#c8ff3d)]/90"
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <LockKeyhole className="h-4 w-4" />
                      )}
                      Unlock · {formatNumber(effect.paw_price)} Paws
                    </Button>
                  )}

                  {short > 0 ? (
                    <Link
                      to="/drops"
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-[var(--brand-line,rgba(244,241,231,0.13))] py-1.5 text-[10.5px] font-semibold text-[var(--brand-paper-dim,#a9a69c)] transition-colors hover:border-[var(--brand-signal,#c8ff3d)]/40 hover:text-[var(--brand-signal,#c8ff3d)]"
                    >
                      <Sparkles className="h-3 w-3" /> Earn {formatNumber(short)} more Paws
                    </Link>
                  ) : (
                    <p className="flex items-center gap-1.5 text-[10px] text-[var(--brand-paper-dim,#a9a69c)]">
                      <Eye className="h-3 w-3" />
                      {SLOT_META[effect.type].blurb}
                    </p>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {PROFILE_EFFECTS.filter(
        (effect) =>
          (slot === "all" || effect.type === slot) && (!ownedOnly || owned.has(effect.slug)),
      ).length === 0 && (
        <div className="rounded-3xl border border-[var(--brand-line,rgba(244,241,231,0.13))] bg-[var(--brand-ink-2,#131315)] p-8 text-center">
          <p className="text-sm font-bold text-[var(--brand-paper,#f4f1e7)]">
            Nothing in this slot yet
          </p>
          <p className="mt-1 text-xs text-[var(--brand-paper-dim,#a9a69c)]">
            {ownedOnly ? "You don't own a look in this slot yet." : "Try another slot filter."}
          </p>
        </div>
      )}

      <p className="mt-5 text-xs text-[var(--brand-paper-dim,#a9a69c)]">
        Every look is transparent vector art, reduced-motion aware, and never covers profile
        controls. Unlocking spends Paws through the server wallet; there is no card checkout.
      </p>

      {receipts.length > 0 && (
        <section className="mt-8" aria-labelledby="recent-orders">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-paper-dim,#a9a69c)]">
                Receipts
              </p>
              <h2
                id="recent-orders"
                className="mt-0.5 font-display text-lg font-bold tracking-tight"
              >
                Recent orders
              </h2>
            </div>
            <span className="flex items-center gap-1 text-[10px] text-[var(--brand-paper-dim,#a9a69c)]">
              <ShieldCheck className="h-3 w-3" /> Stored on this device
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {receipts.slice(0, 6).map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => setReceipt(order)}
                className="group/order flex min-h-[64px] items-center gap-3 rounded-2xl border border-[var(--brand-line,rgba(244,241,231,0.13))] bg-[var(--brand-ink-2,#131315)] p-3 text-left transition-colors hover:border-[var(--brand-signal,#c8ff3d)]/35 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-signal,#c8ff3d)]"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--brand-signal,#c8ff3d)]/25 bg-[var(--brand-signal,#c8ff3d)]/10 text-[var(--brand-signal,#c8ff3d)]">
                  <ReceiptText className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{order.effect.name}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-[var(--brand-paper-dim,#a9a69c)]">
                    {order.id} ·{" "}
                    {new Date(order.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-xs font-bold text-[var(--brand-paper,#f4f1e7)]">
                    −{formatNumber(order.amount)}
                  </span>
                  <span className="block text-[9px] text-[var(--brand-paper-dim,#a9a69c)]">
                    Paws
                  </span>
                </span>
                <Download className="h-3.5 w-3.5 shrink-0 text-[var(--brand-paper-dim,#a9a69c)] transition-colors group-hover/order:text-[var(--brand-signal,#c8ff3d)]" />
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="mt-5">
        <Link
          to={profile?.username ? "/u/$username" : "/feed"}
          params={profile?.username ? { username: profile.username } : undefined}
        >
          <Button
            variant="ghost"
            className="text-[var(--brand-paper-dim,#a9a69c)] hover:text-[var(--brand-paper,#f4f1e7)]"
          >
            <Eye className="mr-2 h-4 w-4" /> View my profile
          </Button>
        </Link>
      </div>

      <Dialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open && !purchase.isPending) setPending(null);
        }}
      >
        <DialogContent className="max-w-sm gap-0 overflow-hidden border-[#2a2a2e] bg-[#111214] p-0">
          {pending && (
            <>
              <DialogHeader className="border-b border-white/10 p-5 text-left">
                <DialogTitle className="font-display text-xl font-bold tracking-tight">
                  Review order
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-[var(--brand-paper-dim,#a9a69c)]">
                  Paws come out of your wallet. No card is charged, and the look is equipped the
                  moment the server confirms.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 p-5">
                <div className="flex items-center gap-3 rounded-2xl border border-[#2a2a2e] bg-[#17171a] p-3">
                  <span
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-white/10"
                    style={{
                      background: `${pending.preview_color}1f`,
                      color: pending.preview_color,
                    }}
                  >
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#f2efe6]">{pending.name}</p>
                    <p className="mt-0.5 text-[11px] text-[#a9a69c]">
                      {SLOT_META[pending.type].label} ·{" "}
                      <span style={{ color: RARITY_COLOR[pending.rarity] }}>{pending.rarity}</span>
                    </p>
                  </div>
                  <span className="ml-auto shrink-0 text-sm font-bold text-[#f2efe6]">
                    {formatNumber(pending.paw_price)} Paws
                  </span>
                </div>

                <dl className="divide-y divide-[#232327] rounded-2xl border border-[#2a2a2e] px-3.5 text-[12px]">
                  {[
                    ["Wallet balance", `${formatNumber(balance)} Paws`],
                    ["This order", `−${formatNumber(pending.paw_price)} Paws`],
                    [
                      "Balance after",
                      `${formatNumber(Math.max(balance - pending.paw_price, 0))} Paws`,
                    ],
                    ["Delivery", "Equipped instantly"],
                  ].map(([label, value], index) => (
                    <div
                      key={label}
                      className={`flex items-center justify-between gap-3 py-2.5 ${index === 2 ? "font-semibold text-[#f2efe6]" : "text-[#a9a69c]"}`}
                    >
                      <dt>{label}</dt>
                      <dd className={index === 2 ? "text-[#c9ff3d]" : "text-[#f2efe6]"}>{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="grid gap-2">
                  <Button
                    type="button"
                    className="h-11 gap-2"
                    disabled={purchase.isPending || balance < pending.paw_price}
                    onClick={() => purchase.mutate(pending)}
                  >
                    {purchase.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LockKeyhole className="h-4 w-4" />
                    )}
                    Unlock · {formatNumber(pending.paw_price)} Paws
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 text-[var(--brand-paper-dim,#a9a69c)]"
                    onClick={() => setPending(null)}
                    disabled={purchase.isPending}
                  >
                    Keep browsing
                  </Button>
                </div>
                <p className="flex items-center justify-center gap-1.5 text-[10px] text-[var(--brand-paper-dim,#a9a69c)]">
                  <ShieldCheck className="h-3 w-3" /> Price checked by the server · receipt follows
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!receipt} onOpenChange={(open) => !open && setReceipt(null)}>
        <DialogContent className="max-h-[92dvh] max-w-md gap-0 overflow-y-auto border-[#2a2a2e] bg-[#111214] p-0">
          {receipt && (
            <>
              <DialogHeader className="border-b border-white/10 p-5 text-left">
                <DialogTitle className="font-display text-xl font-bold tracking-tight">
                  Order complete
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-[var(--brand-paper-dim,#a9a69c)]">
                  {receipt.effect.name} is equipped. Keep the receipt for your records — it
                  downloads as a standalone page.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 p-5">
                <div className="rounded-2xl border border-[#2a2a2e] bg-[linear-gradient(160deg,#17171a,#101012_62%)] p-4">
                  <div className="flex items-center justify-between gap-3 border-b border-[#2a2a2e] pb-3">
                    <span className="inline-flex items-center gap-2 text-[11px] font-extrabold tracking-[0.14em] text-[var(--brand-signal,#c8ff3d)]">
                      <span className="h-2 w-2 rounded-full bg-[var(--brand-signal,#c8ff3d)] shadow-[0_0_10px_var(--brand-signal,#c8ff3d)]" />
                      RIZZ
                    </span>
                    <span className="rounded-full border border-[#3f5d12] bg-[#1b2409] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#d7ff71]">
                      Paid
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold text-[#f2efe6]">
                    {receipt.effect.name}
                  </h3>
                  <p className="text-[11px] text-[#a9a69c]">
                    {SLOT_META[receipt.effect.type].label} · {receipt.effect.rarity}
                  </p>
                  <dl className="mt-3 divide-y divide-[#232327] text-[12px]">
                    {receiptLines(receipt).map(([label, value]) => (
                      <div key={label} className="flex items-start justify-between gap-3 py-2">
                        <dt className="text-[#8e8b83]">{label}</dt>
                        <dd className="text-right font-semibold text-[#f2efe6]">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-2 flex items-center justify-between rounded-xl border border-[#33420f] bg-[#182007] px-3 py-2.5">
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.1em] text-[#a9a69c]">
                        Total paid
                      </p>
                      <p className="font-display text-lg font-bold text-[#c9ff3d]">
                        {formatNumber(receipt.amount)} Paws
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] uppercase tracking-[0.1em] text-[#a9a69c]">
                        Balance after
                      </p>
                      <p className="text-sm font-bold text-[#f2efe6]">
                        {formatNumber(receipt.balanceAfter)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    onClick={() => downloadReceipt(receipt)}
                    className="h-11 gap-2 bg-[var(--brand-signal,#c8ff3d)] text-[#0b0b0c] hover:bg-[var(--brand-signal,#c8ff3d)]/90"
                  >
                    <Download className="h-4 w-4" /> Download receipt
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => downloadReceiptText(receipt)}
                    className="h-11 gap-2 border-white/10"
                  >
                    <ReceiptText className="h-4 w-4" /> Text copy
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={() => setReceipt(null)}
                  className="w-full text-center text-xs font-medium text-[var(--brand-paper-dim,#a9a69c)] transition-colors hover:text-[var(--brand-paper,#f4f1e7)]"
                >
                  Keep shopping
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
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
      <div
        className="relative h-48 overflow-hidden rounded-t-3xl"
        style={wash}
        role="img"
        aria-label={`${effect.name} avatar decoration preview`}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.55) 0.7px, transparent 0.8px)",
            backgroundSize: "11px 11px",
          }}
        />
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
      <div
        className="relative h-48 overflow-hidden rounded-t-3xl"
        style={wash}
        role="img"
        aria-label={`${effect.name} profile frame preview`}
      >
        <div className="absolute inset-x-5 bottom-4 top-9 rounded-xl border border-white/10 bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" />
        <DarkMoonFrame slug={effect.slug} />
        <span className="absolute left-3 top-3 z-20 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/35 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/60 backdrop-blur-sm">
          <span className="h-1 w-1 rounded-full bg-[#dfe8ef]" /> Live preview
        </span>
        <div className="absolute bottom-7 left-7 z-10 flex items-center gap-2.5 transition-transform duration-500 group-hover:scale-[1.02]">
          <Avatar className="h-11 w-11 ring-2 ring-[var(--brand-ink-2,#131315)]">
            <AvatarImage src={avatarUrl ?? undefined} />
            <AvatarFallback className="bg-[var(--brand-ink-3,#1c1c1f)] text-xs">
              {initial}
            </AvatarFallback>
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
    <div
      className="relative h-48 overflow-hidden rounded-t-3xl"
      style={wash}
      role="img"
      aria-label={`${effect.name} profile effect preview`}
    >
      <PuppyLoveEffect />
      <span className="absolute left-3 top-3 z-20 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/35 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/60 backdrop-blur-sm">
        <span className="h-1 w-1 rounded-full bg-[var(--brand-signal,#c8ff3d)]" /> Live preview
      </span>
      <div className="absolute bottom-4 left-5 z-10 flex items-center gap-2.5 transition-transform duration-500 group-hover:scale-[1.02]">
        <Avatar className="h-11 w-11 ring-4 ring-[var(--brand-ink,#0a0a0b)]">
          <AvatarImage src={avatarUrl ?? undefined} />
          <AvatarFallback className="bg-[var(--brand-ink-3,#1c1c1f)] text-sm">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-bold text-white/90">Your banner</p>
          <p className="text-[10px] text-white/55">{effect.name} · animated</p>
        </div>
      </div>
    </div>
  );
}
