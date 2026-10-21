import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, Pin } from "lucide-react";
import type { Badge } from "@/lib/badges";
import { BadgeChip, BadgeRow } from "@/components/BadgeChip";
import { BadgeDetailDialog } from "@/components/profile/BadgeDetailDialog";
import { Badge as BadgeMark } from "@/components/Badge";
import { canonBadges, MAX_SHOWCASE_BADGES, showcaseBadges } from "@/lib/badge-set";
import { saveShowcaseBadges } from "@/lib/featured-badge";
import { toast } from "@/lib/toast";

type ProfileBadgesSectionProps = {
  /** profiles.id whose showcase this section manages. */
  profileId: string;
  /** The signed-in member owns this profile — only they get equip controls. */
  isOwner: boolean;
  /** Raw profiles.badges column; undefined before its migration lands. */
  stored?: string[] | null;
  /** The member's earned badges: server truth for both display and equipping. */
  earned: Badge[];
  /** Earned list still loading, so the section never flashes an empty state. */
  loading?: boolean;
  /** Signed-in member id, so the badge popout can offer the wear action. */
  viewerId?: string | null;
  /** Slug worn beside the name, so the popout shows the right state. */
  featuredSlug?: string | null;
};

/**
 * The profile's badge section, where the member equips what the world sees:
 * "Equip badges" opens an inline editor, tapping a badge writes it to
 * `profiles.badges`, and the showcase row re-renders for every visitor.
 *
 * Two rules keep it honest: only badges in `earned` are ever offered or
 * displayed (showcaseBadges filters on read, so a hand-edited column cannot
 * show an unearned emblem), and until something is equipped the section falls
 * back to the full earned row — the display this page already had — so no
 * existing profile loses badges by this feature existing.
 */
export function ProfileBadgesSection({
  profileId,
  isOwner,
  stored,
  earned,
  loading = false,
  viewerId = null,
  featuredSlug = null,
}: ProfileBadgesSectionProps) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openBadge, setOpenBadge] = useState<Badge | null>(null);

  const equipped = showcaseBadges(stored, earned);
  const equippedSet = new Set(equipped);
  const showcase = equipped
    .map((slug) => earned.find((badge) => badge.slug === slug))
    .filter((badge): badge is Badge => !!badge);
  const orderedEarned = canonBadges(earned);

  // Visitors with nothing to show (earned and equipped both empty) get no
  // section at all, exactly like the bare badge row this replaces.
  if (!isOwner && !loading && earned.length === 0) return null;

  const toggleEquipped = async (badge: Badge) => {
    if (saving) return;
    const on = equippedSet.has(badge.slug);
    const next = on ? equipped.filter((slug) => slug !== badge.slug) : [...equipped, badge.slug];
    if (!on && next.length > MAX_SHOWCASE_BADGES) {
      toast.error(`You can showcase up to ${MAX_SHOWCASE_BADGES} badges — unequip one first.`);
      return;
    }
    setSaving(true);
    try {
      await saveShowcaseBadges(profileId, next);
      toast.success(
        on ? `${badge.name} removed from your profile` : `${badge.name} is now on your profile`,
      );
      await qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update your showcase");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="px-1 md:px-2 mt-4" aria-label="Profile badges">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Badges
        </h2>
        {isOwner && !loading && (
          <button
            type="button"
            onClick={() => setEditing((open) => !open)}
            aria-expanded={editing}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {editing ? (
              <>
                <Check className="h-3 w-3" /> Done
              </>
            ) : (
              <>
                <Pin className="h-3 w-3" /> {equipped.length ? "Change badges" : "Equip badges"}
              </>
            )}
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-8 w-48 animate-pulse rounded-full bg-white/5" aria-hidden="true" />
      ) : showcase.length ? (
        <div className="flex flex-wrap items-center gap-1">
          {showcase.map((badge) => (
            <BadgeChip key={badge.id} badge={badge} size="md" onSelect={setOpenBadge} />
          ))}
        </div>
      ) : isOwner ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {orderedEarned.length ? (
            <>
              Showcase the badges you&apos;re proud of — they&apos;ll appear here on your profile
              for everyone who visits.
            </>
          ) : (
            <>
              No badges yet —{" "}
              <Link to="/badges" className="font-medium text-primary hover:underline">
                collect them in the badge gallery
              </Link>
              .
            </>
          )}
        </p>
      ) : (
        <BadgeRow badges={earned} max={5} onSelect={setOpenBadge} />
      )}

      <BadgeDetailDialog
        entry={openBadge ? { badge: openBadge } : null}
        open={!!openBadge}
        onOpenChange={(open) => !open && setOpenBadge(null)}
        viewerId={viewerId}
        featured={!!openBadge && openBadge.slug === featuredSlug}
      />

      {isOwner && editing && (
        <div className="glass mt-2.5 space-y-2.5 rounded-2xl border border-white/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Showcased on your profile
            </p>
            <span className="font-mono text-[11px] font-bold text-primary">
              {equipped.length}/{MAX_SHOWCASE_BADGES}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {orderedEarned.map((badge) => {
              const on = equippedSet.has(badge.slug);
              const atCap = equipped.length >= MAX_SHOWCASE_BADGES && !on;
              return (
                <button
                  key={badge.id}
                  type="button"
                  onClick={() => void toggleEquipped(badge)}
                  disabled={saving}
                  aria-pressed={on}
                  aria-label={on ? `Unequip ${badge.name}` : `Equip ${badge.name}`}
                  className={`group relative flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 ${
                    on
                      ? "border-primary/60 bg-primary/10"
                      : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]"
                  } ${atCap ? "opacity-70" : ""}`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-[#101116]">
                    <BadgeMark slug={badge.slug} size={24} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-foreground">
                      {badge.name}
                    </span>
                    <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                      {badge.rarity}
                    </span>
                  </span>
                  {on && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                      <Check className="h-2.5 w-2.5" /> On
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-[10.5px] leading-snug text-muted-foreground">
            Tap a badge to equip or unequip it. Only badges you&apos;ve earned can be showcased.
          </p>
        </div>
      )}
    </section>
  );
}
