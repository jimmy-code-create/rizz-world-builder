import { useEffect, useState } from "react";
import { Palette, Plus, Settings2, Flame, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ForumConfig } from "@/lib/forums";
import { cn, formatCount } from "@/lib/utils";

/**
 * The forum's front door: a banner with a gradient overlay, the forum's icon and
 * name, its description, how much is inside, and the one action that matters.
 *
 * It scrolls away and a slim menu-bar-sized header takes over, so the forum
 * never spends more than ~56px of a phone screen on chrome once you are reading
 * threads. The container owns the scroll position and tells this when that has
 * happened; the two states are one component each so neither has to animate its
 * own layout.
 */

export function ForumHero({
  config,
  name,
  realmName,
  threadCount,
  postCount24h,
  canCustomize,
  onNewPost,
  onCustomize,
  muted = false,
}: {
  config: ForumConfig;
  name: string;
  realmName: string;
  threadCount: number;
  postCount24h: number;
  canCustomize: boolean;
  onNewPost: () => void;
  onCustomize: () => void;
  muted?: boolean;
}) {
  const [bannerFailed, setBannerFailed] = useState(false);
  useEffect(() => setBannerFailed(false), [config.banner_url]);

  const accent = config.accent_color || undefined;
  const icon = config.icon_emoji || "🗂️";

  return (
    <section className="relative">
      <div
        className="relative h-40 w-full overflow-hidden sm:h-52"
        style={{
          background: accent
            ? `linear-gradient(135deg, ${accent}44, transparent 70%), var(--forum-surface-sunken)`
            : "linear-gradient(135deg, var(--forum-accent-soft), transparent 70%), var(--forum-surface-sunken)",
        }}
      >
        {config.banner_url && !bannerFailed && (
          <img
            src={config.banner_url}
            alt=""
            loading="eager"
            decoding="async"
            onError={() => setBannerFailed(true)}
            className="h-full w-full object-cover"
          />
        )}
        {/* Gradient overlay: keeps the title readable over any banner. */}
        <div aria-hidden className="forum-hero-scrim absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4">
          <span
            className="grid h-14 w-14 shrink-0 place-items-center rounded-[var(--forum-radius-sm)] border border-white/15 bg-black/45 text-2xl backdrop-blur-sm sm:h-16 sm:w-16 sm:text-3xl"
            aria-hidden
          >
            {icon}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
              {realmName}
            </p>
            <h1 className="truncate font-display text-xl font-bold leading-tight text-white sm:text-2xl">
              {name}
            </h1>
          </div>
        </div>
      </div>

      <div
        className="forum-card rounded-t-none border-t-0 p-4 sm:p-5"
        style={{ padding: "var(--forum-pad)" }}
      >
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {config.description || "Ask questions, share what you find, and keep the answers in one place."}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
          <span className="forum-chip text-muted-foreground">
            <Users className="h-3 w-3" aria-hidden />
            {formatCount(threadCount)} {threadCount === 1 ? "thread" : "threads"}
          </span>
          <span className="forum-chip text-muted-foreground">
            <Flame className="h-3 w-3 text-primary" aria-hidden />
            {postCount24h === 0 ? "Quiet today" : `${postCount24h} today`}
          </span>
          {muted && <span className="forum-chip text-[var(--forum-archived)]">Muted</span>}
          {config.slowmode_seconds > 0 && (
            <span className="forum-chip text-[var(--forum-pinned)]">
              Slowmode {config.slowmode_seconds}s
            </span>
          )}
          {config.auto_archive_days ? (
            <span className="forum-chip text-muted-foreground">
              Auto-archive after {config.auto_archive_days}d
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button
            type="button"
            onClick={onNewPost}
            className="h-11 min-w-0 flex-1 gap-2 border-0 bg-primary text-primary-foreground shadow-md sm:flex-none sm:px-6"
          >
            <Plus className="h-4 w-4" aria-hidden />
            <span className="truncate">New post</span>
          </Button>
          {canCustomize && (
            <Button
              type="button"
              variant="outline"
              onClick={onCustomize}
              className="h-11 gap-2 border-[var(--forum-border)] bg-[var(--forum-surface-sunken)] text-foreground"
            >
              <Palette className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Customize</span>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

/** The slim header that sticks once the hero has scrolled away. */
export function ForumSlimHeader({
  config,
  name,
  accent,
  sticky = true,
  canCustomize,
  onNewPost,
  onCustomize,
  children,
}: {
  config: ForumConfig;
  name: string;
  accent?: string | null;
  sticky?: boolean;
  canCustomize: boolean;
  onNewPost: () => void;
  onCustomize: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b px-3 py-2",
        sticky && "sticky top-0 z-30",
      )}
      style={{
        background: "var(--surface-bar)",
        borderColor: "var(--forum-border)",
        backdropFilter: "blur(18px) saturate(130%)",
        WebkitBackdropFilter: "blur(18px) saturate(130%)",
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.4rem)",
      }}
    >
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--forum-radius-sm)] border border-[var(--forum-border)] text-base"
        style={{ background: accent ? `${accent}33` : "var(--forum-accent-soft)" }}
        aria-hidden
      >
        {config.icon_emoji || "🗂️"}
      </span>
      <h2 className="min-w-0 flex-1 truncate font-display text-sm font-bold">{name}</h2>
      {children}
      {canCustomize && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Forum settings"
          onClick={onCustomize}
          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        onClick={onNewPost}
        className="h-9 shrink-0 gap-1.5 border-0 bg-primary text-primary-foreground px-3 text-primary-foreground"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        New
      </Button>
    </div>
  );
}
