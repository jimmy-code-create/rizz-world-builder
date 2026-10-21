import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import { AvatarStatusBadge, StatusDotButton } from "@/components/presence/StatusDot";
import { Nameplate } from "@/components/profile/Nameplate";
import { ProfileEffect } from "@/components/profile/ProfileEffect";
import { ProfileFrame } from "@/components/profile/ProfileFrame";
import { VerifiedSeal } from "@/components/profile/VerifiedSeal";
import { getBanner } from "@/lib/banner";
import { getBannerEffectSpec, getFrameSpec } from "@/lib/effect-registry";
import { defaultAvatarFor } from "@/lib/default-avatars";
import type { PublicPresence } from "@/lib/presence";
import { cn } from "@/lib/utils";

type EffectVisual = {
  slug?: string | null;
} | null;

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

export type ProfileHeaderEffects = {
  profile_effect?: EffectVisual;
  avatar_decoration?: EffectVisual;
  profile_frame?: EffectVisual;
} | null;

export type ProfileHeaderProps = {
  user: ProfileHeaderUser | null | undefined;
  effects?: ProfileHeaderEffects;
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
  /** Featured badge node beside the verified tick. */
  featuredBadge?: ReactNode;
  /** Accent ring for an avatar with no decoration; false hides it. */
  avatarRing?: string | false | null;
  /** Background behind the name row; also the status-dot cutout. */
  surface?: string;
  /** Inline page gutter (matches the content below the header). */
  gutter?: string;
  className?: string;
};

/**
 * ONE profile header for the settings preview, card, popup and full profile.
 *
 * The container owns the proportions; the banner is always 3:1, the avatar is
 * a percentage of the container, and the effect layer is clipped inside the
 * banner so it can never reach the name row or stats.
 */
export function ProfileHeader({
  user,
  effects,
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
  surface = "#141416",
  gutter,
  className,
}: ProfileHeaderProps) {
  if (!user) return null;

  const username = user.username ?? "member";
  const displayName = user.displayName || user.username || "Member";
  const initial = displayName.charAt(0).toUpperCase();
  const avatarSrc = user.avatarUrl ?? defaultAvatarFor(username);
  const banner = getBanner(user);
  const profileEffect = effects?.profile_effect ?? null;
  const avatarDecoration = effects?.avatar_decoration ?? null;
  const profileFrame = effects?.profile_frame ?? null;
  const effectSpec = getBannerEffectSpec(profileEffect?.slug);
  const frameSpec = getFrameSpec(profileFrame?.slug);

  return (
    <div
      className={cn("relative isolate w-full", className)}
      style={
        {
          containerType: "inline-size",
          "--avatar-size": "clamp(64px, 22cqw, 128px)",
          "--header-gutter": gutter ?? "clamp(12px, 2.6cqw, 24px)",
          "--header-bg": surface,
        } as CSSProperties
      }
    >
      {/* 1. Banner photo/gradient. The box never changes height, even when empty. */}
      <div
        className="relative w-full touch-none overflow-hidden rounded-3xl bg-[#141416] sm:touch-auto"
        style={{ aspectRatio: "3 / 1", background: banner.background }}
        onPointerDown={onBannerPointerDown}
      >
        {/* 2. Effect: clipped to the banner, above the photo, below content. */}
        {effectSpec && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
            style={{
              height: `${effectSpec.maxHeightPct}%`,
              width: "100%",
              top: effectSpec.anchor === "center" ? "50%" : 0,
              transform: effectSpec.anchor === "center" ? "translateY(-50%)" : undefined,
              opacity: effectSpec.opacity,
              maskImage: "linear-gradient(to bottom, #000 0%, #000 82%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, #000 0%, #000 82%, transparent 100%)",
            }}
          >
            <ProfileEffect slug={profileEffect?.slug} className="absolute inset-0" />
          </div>
        )}

        {/* 2b. Frame: same banner box, above the effect, below the scrim. */}
        {frameSpec && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[15] overflow-hidden"
            style={{ opacity: frameSpec.opacity }}
          >
            <ProfileFrame slug={profileFrame?.slug} />
          </div>
        )}

        {/* 3. Soft scrim for the avatar/name overlap. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-1/2"
          style={{
            background:
              "linear-gradient(to top, var(--header-bg) 0%, color-mix(in srgb, var(--header-bg) 55%, transparent) 48%, transparent 100%)",
          }}
        />

        {/* Buttons always sit above the effect and remain tappable. */}
        {overlayActions && (
          <div className="absolute right-2.5 top-2.5 z-40 flex items-center gap-1.5">
            {overlayActions}
          </div>
        )}
      </div>

      <div className="relative z-30" style={{ paddingInline: "var(--header-gutter)" }}>
        {/* Avatar overlaps the banner; the gutter keeps the 120% ring off the edge. */}
        <div
          className="flex items-end justify-between gap-3"
          style={{ marginTop: "calc(var(--avatar-size) * -0.5)" }}
        >
          <div
            className="relative inline-flex shrink-0"
            style={{
              width: "var(--avatar-size)",
              height: "var(--avatar-size)",
              marginLeft: "calc(var(--avatar-size) * 0.1 + 8px)",
            }}
          >
            <AvatarDecoration
              src={avatarSrc}
              fallback={initial}
              size="var(--avatar-size)"
              decorationSlug={avatarDecoration?.slug}
            />
            {avatarRing && !avatarDecoration?.slug && (
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
          <span className="min-w-0" />
        </div>

        {/* 4. Name row: 10% of the avatar + 8px away from the ring. */}
        <div style={{ marginTop: "calc(var(--avatar-size) * 0.1 + 8px)" }}>
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="min-w-0 truncate font-display text-[clamp(20px,5.4cqw,28px)] font-bold leading-tight tracking-tight text-[#f2efe6]">
                  <Nameplate name={displayName} className="block truncate" />
                </h1>
                {user.verified && <VerifiedSeal size={22} className="mb-0.5" />}
                {featuredBadge && <span className="shrink-0">{featuredBadge}</span>}
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
