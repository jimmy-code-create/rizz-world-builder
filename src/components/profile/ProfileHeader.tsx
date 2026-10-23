import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarStatusBadge, StatusDotButton } from "@/components/presence/StatusDot";
import { Nameplate } from "@/components/profile/Nameplate";
import { getBanner } from "@/lib/banner";
import { defaultAvatarFor } from "@/lib/default-avatars";
import type { PublicPresence } from "@/lib/presence";
import { cn } from "@/lib/utils";

export type ProfileHeaderUser = {
  id?: string | null;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bannerMode?: string | null;
  bannerGradient?: unknown;
  updatedAt?: string | null;
  accentColor?: string | null;
  verified?: boolean;
  reducedMotion?: boolean;
};

export type ProfileHeaderProps = {
  user: ProfileHeaderUser | null | undefined;
  status?: PublicPresence;
  /** Pass false for a surface that should not show a dot yet. */
  statusEnabled?: boolean;
  /** The viewer owns this profile (invisible statuses stay visible to them). */
  statusIsSelf?: boolean;
  customStatus?: { emoji?: string | null; text?: string | null } | null;
  /** Status pill / "Set status" line, rendered under the handle. */
  statusLine?: ReactNode;
  /** Extra handle-row detail (pronouns, realm role, …). */
  handleExtra?: ReactNode;
  /** Name-row trailing actions (Share / Edit profile / Follow …). */
  actions?: ReactNode;
  /** Banner-corner actions ("…" and close). */
  overlayActions?: ReactNode;
  /** Starts a sheet drag when a phone pulls down on the banner. */
  onBannerPointerDown?: (event: ReactPointerEvent) => void;
  /** The badge line beside the name (see BadgeLine): one non-wrapping row. */
  featuredBadge?: ReactNode;
  /** Accent ring around the avatar; false hides it. */
  avatarRing?: string | false | null;
  /**
   * Soft accent halo behind the avatar — a glow rather than a hard ring. Kept
   * quiet enough to sit over a banner photo.
   */
  avatarGlow?: string | false | null;
  /**
   * Background behind the name row; also the status-dot cutout. Defaults to
   * the dark tone derived from the profile gradient, so every surface agrees.
   */
  surface?: string;
  /** Inline page gutter (matches the content below the header). */
  gutter?: string;
  /**
   * Tighter banner/avatar/name rhythm for the profile preview sheet, where a
   * compact header leaves more room for the bio and activity below.
   */
  compact?: boolean;
  className?: string;
};

/**
 * ONE profile header for the settings preview, card, popup and full profile.
 *
 * The container owns the proportions; the banner is always 3:1 and the avatar
 * is a percentage of the container, so every surface keeps the same anatomy.
 */
export function ProfileHeader({
  user,
  status = "offline",
  statusEnabled = true,
  statusIsSelf = false,
  customStatus,
  statusLine,
  handleExtra,
  actions,
  overlayActions,
  onBannerPointerDown,
  featuredBadge,
  avatarRing,
  avatarGlow,
  surface,
  gutter,
  compact = false,
  className,
}: ProfileHeaderProps) {
  if (!user) return null;

  const username = user.username ?? "member";
  const displayName = user.displayName || user.username || "Member";
  const initial = displayName.charAt(0).toUpperCase();
  const avatarSrc = user.avatarUrl ?? defaultAvatarFor(username);
  const banner = getBanner(user);
  const headerSurface = surface ?? banner.surface;

  return (
    <div
      className={cn("relative isolate w-full", className)}
      style={
        {
          containerType: "inline-size",
          "--avatar-size": compact ? "clamp(52px, 16cqw, 84px)" : "clamp(60px, 20cqw, 116px)",
          "--header-gutter": gutter ?? "clamp(12px, 2.6cqw, 24px)",
          "--header-bg": headerSurface,
        } as CSSProperties
      }
    >
      {/* 1. Banner photo. The box never changes height, even when empty. */}
      <div
        className="relative w-full touch-none overflow-hidden rounded-3xl bg-[#141416] sm:touch-auto"
        style={{ aspectRatio: compact ? "3.4 / 1" : "3 / 1", background: banner.background }}
        onPointerDown={onBannerPointerDown}
      >
        {/* 2. Soft scrim for the avatar/name overlap. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-1/2"
          style={{
            background:
              "linear-gradient(to top, var(--header-bg) 0%, color-mix(in srgb, var(--header-bg) 55%, transparent) 48%, transparent 100%)",
          }}
        />

        {/* Buttons always sit above the banner and remain tappable. */}
        {overlayActions && (
          <div className="absolute right-2.5 top-2.5 z-40 flex items-center gap-1.5">
            {overlayActions}
          </div>
        )}
      </div>

      <div className="relative z-30" style={{ paddingInline: "var(--header-gutter)" }}>
        {/* Avatar overlaps the banner; the gutter keeps the small collar off the edge. */}
        <div
          className="flex items-end justify-between gap-3"
          style={{ marginTop: "calc(var(--avatar-size) * -0.5)" }}
        >
          <div
            className="relative inline-flex shrink-0"
            style={{
              width: "var(--avatar-size)",
              height: "var(--avatar-size)",
              // Flush left with the name row and the cards below; the small
              // offset only keeps a decoration's overhang on screen.
              marginLeft: "calc(var(--avatar-size) * 0.08)",
            }}
          >
            {avatarGlow && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 z-0 rounded-full"
                style={{
                  boxShadow: `0 0 22px 2px color-mix(in srgb, ${avatarGlow} 45%, transparent), 0 0 64px 12px color-mix(in srgb, ${avatarGlow} 18%, transparent)`,
                }}
              />
            )}
            <Avatar className="relative z-[1] h-full w-full">
              <AvatarImage src={avatarSrc} />
              <AvatarFallback className="bg-[var(--brand-ink-3,#1c1c1f)] font-semibold text-[var(--brand-paper,#f4f1e7)]">
                {initial}
              </AvatarFallback>
            </Avatar>
            {avatarRing && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 z-30 rounded-full"
                style={{ boxShadow: `0 0 0 2px ${avatarRing}` }}
              />
            )}
            <AvatarStatusBadge emoji={customStatus?.emoji} />
            {statusEnabled && (
              <span
                className="absolute z-40 grid place-items-center rounded-full"
                style={{
                  width: "22%",
                  height: "22%",
                  right: "-1%",
                  bottom: "-1%",
                  background: "var(--header-bg)",
                  boxShadow: "0 0 0 3.5px var(--header-bg)",
                }}
                title={status}
              >
                <StatusDotButton
                  userId={user.id ?? ""}
                  username={username}
                  status={status}
                  isSelf={statusIsSelf}
                  size={22}
                  className="h-full w-full [&_svg]:h-full [&_svg]:w-full"
                />
              </span>
            )}
          </div>
        </div>

        {/* 4. Name row: just clear of the avatar in the compact preview, and a
               little more breathing room on the roomy profile surfaces. */}
        <div
          style={{
            marginTop: compact
              ? "calc(var(--avatar-size) * 0.02 + 5px)"
              : "calc(var(--avatar-size) * 0.1 + 8px)",
          }}
        >
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-nowrap items-center gap-1.5">
                <h1 className="min-w-0 truncate font-display text-[clamp(20px,5.4cqw,28px)] font-bold leading-tight tracking-tight text-[#f2efe6]">
                  <Nameplate name={displayName} className="block truncate" />
                </h1>
                {featuredBadge && (
                  <span className="flex shrink-0 items-center">{featuredBadge}</span>
                )}
              </div>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
                <p className="truncate text-sm text-muted-foreground">@{username}</p>
                {handleExtra}
              </div>
              {statusLine}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
