import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge as BadgeMark } from "@/components/Badge";
import type { Badge } from "@/lib/badges";
import { setFeaturedBadge } from "@/lib/featured-badge";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const RARITY_TONE: Record<Badge["rarity"], { label: string; color: string }> = {
  common: { label: "Common", color: "#c8c8cf" },
  rare: { label: "Rare", color: "#6cd7ff" },
  epic: { label: "Epic", color: "#cd9bff" },
  legendary: { label: "Legendary", color: "#ffd166" },
  mythic: { label: "Mythic", color: "#ff6a86" },
};

function earnedLabel(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Discord-style badge popout.
 *
 * Tapping any badge on a profile opens this: the emblem at showcase size, its
 * tier, what it means, when it was earned, and — for the owner — the one action
 * that matters, wearing it beside their name. Visitors get the same card without
 * the controls, so a badge is never a dead icon.
 */
export function BadgeDetailDialog({
  entry,
  open,
  onOpenChange,
  featured = false,
  viewerId = null,
}: {
  entry: { badge: Badge; awardedAt?: string | null } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** This badge is the one currently worn beside the member's name. */
  featured?: boolean;
  /** Signed-in member id; the wear action only exists for them. */
  viewerId?: string | null;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [worn, setWorn] = useState(featured);

  // The parent may change the featured badge while this is closed; re-sync on
  // open without an effect (derived state reset is the cheapest correct fix).
  const [seen, setSeen] = useState(featured);
  if (seen !== featured) {
    setSeen(featured);
    setWorn(featured);
  }

  if (!entry) return null;
  const { badge, awardedAt } = entry;
  const tone = RARITY_TONE[badge.rarity] ?? RARITY_TONE.common;
  const earned = earnedLabel(awardedAt);

  const toggleFeatured = async () => {
    if (!viewerId || saving) return;
    setSaving(true);
    try {
      const next = worn ? null : badge.slug;
      await setFeaturedBadge(viewerId, next);
      setWorn(!worn);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["profile"] }),
        qc.invalidateQueries({ queryKey: ["profile-preview"] }),
        qc.invalidateQueries({ queryKey: ["profile-card"] }),
        qc.invalidateQueries({ queryKey: ["featured-badge"] }),
      ]);
      toast.success(next ? `${badge.name} is now beside your name` : "Featured badge cleared");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update your featured badge");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="popout-card w-[calc(100vw-1.5rem)] max-w-[380px] gap-0 overflow-hidden rounded-2xl border-white/[0.08] bg-[#111214] p-0">
        <DialogTitle className="sr-only">{badge.name}</DialogTitle>
        <DialogDescription className="sr-only">
          {badge.name}, a {tone.label.toLowerCase()} badge.
        </DialogDescription>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-36 opacity-70"
          style={{
            background: `radial-gradient(90% 140% at 50% -20%, ${tone.color}3d 0%, transparent 72%)`,
          }}
        />

        <div className="relative flex flex-col items-center px-5 pb-5 pt-7 text-center">
          <div
            className="relative grid h-[104px] w-[104px] place-items-center rounded-[28px] border"
            style={{
              borderColor: `${tone.color}4d`,
              background: `radial-gradient(circle at 50% 20%, ${tone.color}26, rgba(9,10,12,0.9) 70%)`,
              boxShadow: `0 18px 44px -26px ${tone.color}`,
            }}
          >
            <BadgeMark slug={badge.slug} size={72} title={badge.name} />
          </div>

          <h2 className="mt-4 font-display text-xl font-bold tracking-tight text-[#f4f1e7]">
            {badge.name}
          </h2>
          <span
            className="mt-1.5 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{
              borderColor: `${tone.color}40`,
              color: tone.color,
              background: `${tone.color}14`,
            }}
          >
            <Sparkles className="h-2.5 w-2.5" />
            {tone.label}
          </span>

          {badge.description && (
            <p className="mt-3 text-[13px] leading-relaxed text-[#b9b5ab]">{badge.description}</p>
          )}

          <div className="mt-4 w-full divide-y divide-white/[0.06] rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 text-left text-[12px]">
            <div className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-[#8e8b83]">Earned</span>
              <span className="font-semibold text-[#f2efe6]">{earned ?? "In your collection"}</span>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-[#8e8b83]">Shown on profile</span>
              <span className="inline-flex items-center gap-1 font-semibold text-[#f2efe6]">
                <ShieldCheck className="h-3 w-3 text-[#c9ff3d]" /> Showcase
              </span>
            </div>
          </div>

          {viewerId && (
            <Button
              type="button"
              onClick={() => void toggleFeatured()}
              disabled={saving}
              className={cn(
                "mt-4 h-10 w-full gap-2 text-[13px] font-bold",
                worn
                  ? "bg-white/[0.08] text-[#f2efe6] hover:bg-white/[0.12]"
                  : "bg-[#c9ff3d] text-[#0b0b0c] hover:bg-[#d6ff6b]",
              )}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : worn ? (
                <Check className="h-4 w-4" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {worn ? "Worn beside your name" : "Wear beside your name"}
            </Button>
          )}

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-lg text-[12px] font-semibold text-[#8e8b83] transition-colors hover:bg-white/[0.05] hover:text-[#f2efe6]"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
