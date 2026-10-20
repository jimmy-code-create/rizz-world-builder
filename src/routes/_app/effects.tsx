import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Bell, Check, Eye, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { useAuth } from "@/lib/auth";
import {
  COSMETICS_ENABLED,
  DISCORD_SHOWCASE_EFFECTS,
  RARITY_FLAT,
  type ProfileEffect as CatalogEffect,
  type ProfileEffectType,
} from "@/lib/effects";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import { Nameplate } from "@/components/profile/Nameplate";
import { ProfileEffect as ProfileEffectVisual } from "@/components/profile/ProfileEffect";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/effects")({
  head: () => ({ meta: [{ title: "Effects · RIZZ" }] }),
  component: EffectsPage,
});

const SECTIONS: { type: ProfileEffectType; title: string; blurb: string }[] = [
  {
    type: "avatar_decoration",
    title: "Avatar decorations",
    blurb: "Animated art that frames your avatar.",
  },
  {
    type: "nameplate",
    title: "Nameplates",
    blurb: "A frame and a finish for your name.",
  },
  {
    type: "profile_effect",
    title: "Profile effects",
    blurb: "Full-width motion across your banner.",
  },
];

const TYPE_LABEL: Record<ProfileEffectType, string> = {
  avatar_decoration: "Avatar decoration",
  nameplate: "Nameplate",
  profile_effect: "Profile effect",
};

/** The two halves of the Web Slinger launch, flagged in the grid. */
const NEW_EFFECTS = new Set(["deco-web-slinger", "fx-web-slinger"]);

function EffectsPage() {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const stageRef = useRef<HTMLDivElement>(null);

  // Previews are client-only: several of them use random star fields, and the
  // Lottie player needs a DOM. Rendering them after mount also keeps the first
  // paint of a 25-tile gallery cheap.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [selectedSlug, setSelectedSlug] = useState("deco-web-slinger");
  const selected =
    DISCORD_SHOWCASE_EFFECTS.find((e) => e.slug === selectedSlug) ??
    DISCORD_SHOWCASE_EFFECTS.find((e) => e.slug === "deco-web-slinger")!;

  const displayName = profile?.display_name || profile?.username || "you";
  const username = profile?.username || "you";
  const initial = displayName.charAt(0).toUpperCase();

  const groups = useMemo(
    () =>
      SECTIONS.map((section) => ({
        ...section,
        items: DISCORD_SHOWCASE_EFFECTS.filter((e) => e.type === section.type),
      })),
    [],
  );

  const choose = (effect: CatalogEffect) => {
    setSelectedSlug(effect.slug);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // The "notify me" chip only matters while the catalogue is paused.
  const storageKey = `rizz_effects_notify_${user?.id || "guest"}`;
  const [notified, setNotified] = useState(false);
  useEffect(() => {
    try {
      setNotified(localStorage.getItem(storageKey) === "true");
    } catch {}
  }, [storageKey]);
  const toggleNotify = () => {
    const next = !notified;
    setNotified(next);
    try {
      localStorage.setItem(storageKey, String(next));
    } catch {}
  };

  return (
    <div className="mx-auto max-w-3xl px-1 py-2 sm:py-6">
      {/* Header */}
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

      {/* Intro */}
      <div className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2.5">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Effects</h1>
          {!COSMETICS_ENABLED && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
              <Lock className="h-3 w-3" /> Preview only
            </span>
          )}
        </div>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          Animated avatar decorations, nameplates and profile effects. Tap any piece to preview it
          on a profile.
        </p>

        {!COSMETICS_ENABLED && (
          <div className="mt-3 flex flex-wrap items-center gap-2.5 rounded-xl border border-[var(--brand-line,rgba(244,241,231,0.13))] bg-[var(--brand-ink-2,#131315)] px-3 py-2.5">
            <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
              Cosmetics are paused while we finish the launch. Everything here is previewable —
              nothing can be equipped yet.
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={toggleNotify}
              className={cn(
                "h-8 shrink-0 rounded-full border px-3 text-xs font-semibold",
                notified
                  ? "border-[var(--brand-signal,#c8ff3d)]/60 bg-[var(--brand-signal,#c8ff3d)]/15 text-[var(--brand-signal,#c8ff3d)] hover:bg-[var(--brand-signal,#c8ff3d)]/25"
                  : "border-white/10 bg-white/5 text-foreground hover:bg-white/10",
              )}
            >
              {notified ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5" /> You're on the list
                </>
              ) : (
                <>
                  <Bell className="mr-1.5 h-3.5 w-3.5" /> Notify me
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Preview stage */}
      <div
        ref={stageRef}
        className="mb-9 scroll-mt-20 rounded-2xl border border-[var(--brand-line,rgba(244,241,231,0.13))] bg-[var(--brand-ink-2,#131315)] p-3 sm:p-4"
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

        {mounted && (
          <PreviewStage
            effect={selected}
            avatarUrl={profile?.avatar_url}
            displayName={displayName}
            username={username}
            initial={initial}
          />
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 px-0.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 font-semibold text-[var(--brand-signal,#c8ff3d)]">
            <Sparkles className="h-3.5 w-3.5" />
            {selected.unlock_rizz.toLocaleString()} rizz
          </span>
          <span aria-hidden>·</span>
          <span>{TYPE_LABEL[selected.type]}</span>
          <span aria-hidden>·</span>
          <span className="uppercase tracking-wide" style={{ color: RARITY_FLAT[selected.rarity] }}>
            {selected.rarity}
          </span>
        </div>
        <p className="mt-1.5 px-0.5 text-sm leading-relaxed text-muted-foreground">
          {selected.description}
        </p>
      </div>

      {/* Catalogue */}
      {groups.map((group) => (
        <section key={group.type} className="mb-8">
          <div className="mb-2.5 flex items-baseline justify-between gap-3 px-0.5">
            <div>
              <h2 className="font-display text-base font-bold sm:text-lg">{group.title}</h2>
              <p className="text-xs text-muted-foreground">{group.blurb}</p>
            </div>
            <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
              {group.items.length}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {group.items.map((effect) => (
              <EffectTile
                key={effect.slug}
                effect={effect}
                selected={effect.slug === selected.slug}
                onSelect={() => choose(effect)}
                mounted={mounted}
                avatarUrl={profile?.avatar_url}
                initial={initial}
              />
            ))}
          </div>
        </section>
      ))}

      <p className="mb-4 px-0.5 text-[11px] leading-relaxed text-muted-foreground">
        Effects are previews until cosmetics launch.{" "}
        <Link to="/settings/preferences" className="underline underline-offset-4 hover:text-foreground">
          Reduce motion
        </Link>{" "}
        in preferences holds animated effects on a still frame.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Stage                                                                      */
/* -------------------------------------------------------------------------- */

function PreviewStage({
  effect,
  avatarUrl,
  displayName,
  username,
  initial,
}: {
  effect: CatalogEffect;
  avatarUrl?: string | null;
  displayName: string;
  username: string;
  initial: string;
}) {
  // Avatar decorations are square art built around the avatar, so they get a
  // square stage. Nameplates and banner effects are shown on a mock profile.
  if (effect.type === "avatar_decoration") {
    return (
      <div className="relative grid h-64 place-items-center overflow-hidden rounded-xl border border-white/5 bg-[#0b0b0f] sm:h-80">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(55% 60% at 50% 45%, ${effect.preview_color}24, transparent 72%)`,
          }}
        />
        <AvatarDecoration
          src={avatarUrl}
          fallback={initial}
          size={112}
          effectSlug={effect.slug}
          accent={effect.preview_color}
          preview
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/5 bg-[#0b0b0f] p-2.5">
      <div className="relative">
        <div
          className="relative h-36 overflow-hidden rounded-lg sm:h-44"
          style={{
            background: `linear-gradient(135deg, ${effect.preview_color}3d, #121218 55%, ${effect.preview_color}26)`,
          }}
        >
          {effect.type === "profile_effect" && (
            <ProfileEffectVisual
              slug={effect.slug}
              accent={effect.preview_color}
              preview
            />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0b0f]/85 via-transparent to-transparent" />
        </div>

        <div className="absolute -bottom-7 left-3.5">
          <AvatarDecoration
            src={avatarUrl}
            fallback={initial}
            size={64}
            effectSlug={null}
            preview
            className="rounded-full ring-4 ring-[#0b0b0f]"
          />
        </div>
      </div>

      <div className="min-w-0 pl-3 pt-9">
        {effect.type === "nameplate" ? (
          <Nameplate
            name={displayName}
            slug={effect.slug}
            accent={effect.preview_color}
            preview
            className="max-w-full"
          />
        ) : (
          <p className="truncate font-display text-lg font-bold">{displayName}</p>
        )}
        <p className="mt-0.5 truncate text-xs text-muted-foreground">@{username}</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Grid                                                                       */
/* -------------------------------------------------------------------------- */

function EffectTile({
  effect,
  selected,
  onSelect,
  mounted,
  avatarUrl,
  initial,
}: {
  effect: CatalogEffect;
  selected: boolean;
  onSelect: () => void;
  mounted: boolean;
  avatarUrl?: string | null;
  initial: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Preview ${effect.name}`}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-[var(--brand-ink-2,#131315)] p-1.5 text-left transition-colors",
        selected
          ? "border-[var(--brand-signal,#c8ff3d)] ring-1 ring-[var(--brand-signal,#c8ff3d)]"
          : "border-[var(--brand-line,rgba(244,241,231,0.13))] hover:border-white/25",
      )}
    >
      <div className="relative grid h-28 place-items-center overflow-hidden rounded-lg border border-white/5 bg-[#0b0b0f]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(70% 80% at 50% 45%, ${effect.preview_color}22, transparent 72%)`,
          }}
        />
        {mounted && <EffectThumb effect={effect} avatarUrl={avatarUrl} initial={initial} />}
        {NEW_EFFECTS.has(effect.slug) && (
          <span className="absolute left-1.5 top-1.5 z-10 rounded-full bg-[var(--brand-signal,#c8ff3d)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[var(--brand-signal-ink,#0a0a0b)]">
            New
          </span>
        )}
        {selected && (
          <span className="absolute right-1.5 top-1.5 z-10 grid h-5 w-5 place-items-center rounded-full bg-[var(--brand-signal,#c8ff3d)] text-[var(--brand-signal-ink,#0a0a0b)]">
            <Eye className="h-3 w-3" />
          </span>
        )}
      </div>

      <div className="px-1 pb-0.5 pt-1.5">
        <p className="truncate text-[11px] font-semibold leading-tight">{effect.name}</p>
        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
          <span style={{ color: RARITY_FLAT[effect.rarity] }}>{effect.rarity}</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{effect.unlock_rizz.toLocaleString()}</span>
        </p>
      </div>
    </button>
  );
}

function EffectThumb({
  effect,
  avatarUrl,
  initial,
}: {
  effect: CatalogEffect;
  avatarUrl?: string | null;
  initial: string;
}) {
  if (effect.type === "avatar_decoration") {
    return (
      <AvatarDecoration
        src={avatarUrl}
        fallback={initial}
        size={52}
        effectSlug={effect.slug}
        accent={effect.preview_color}
        preview
      />
    );
  }

  if (effect.type === "nameplate") {
    return (
      <Nameplate
        name="You"
        slug={effect.slug}
        accent={effect.preview_color}
        preview
        className="max-w-full"
      />
    );
  }

  // The Web Slinger banner already plays in the stage when it is selected, so
  // its tile uses the rendered still rather than a third Lottie instance.
  if (effect.slug === "fx-web-slinger") {
    return (
      <img
        src="/effects/fx-web-slinger-frame.svg"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover object-top opacity-90"
      />
    );
  }

  return <ProfileEffectVisual slug={effect.slug} accent={effect.preview_color} preview />;
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
