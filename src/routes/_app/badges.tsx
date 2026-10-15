import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n, tf } from "@/lib/i18n";
import { fetchAllBadges, fetchUserBadges, type Badge } from "@/lib/badges";
import { BadgeChip } from "@/components/BadgeChip";
import { Award, Lock, Sparkles, CheckCircle2, Search, Trophy, ShieldCheck, Share2 } from "lucide-react";
import { formatNumber } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/badges")({
  head: () => ({ meta: [{ title: "Badges · RIZZ" }] }),
  component: BadgesPage,
});

type FilterTab = "all" | "unlocked" | "locked" | "legendary" | "epic" | "rare" | "common";

export function BadgesPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const all = useQuery({ queryKey: ["badges-all"], queryFn: fetchAllBadges });
  const mine = useQuery({
    queryKey: ["badges-mine", user?.id],
    queryFn: () => fetchUserBadges(user!.id),
    enabled: !!user,
  });

  const owned = useMemo(() => new Set((mine.data ?? []).map((b) => b.id)), [mine.data]);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  const totalCount = all.data?.length ?? 0;
  const ownedCount = mine.data?.length ?? 0;
  const progressPct = totalCount > 0 ? Math.round((ownedCount / totalCount) * 100) : 0;

  // Active badge defaulting to first in list or selected
  const active = selectedBadge ?? all.data?.[0] ?? null;
  const isActiveOwned = active ? owned.has(active.id) : false;

  const filteredBadges = useMemo(() => {
    return (all.data ?? []).filter((b) => {
      const matchesSearch =
        !search.trim() ||
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        b.description.toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;

      const isOwned = owned.has(b.id);
      if (filter === "unlocked") return isOwned;
      if (filter === "locked") return !isOwned;
      if (filter === "legendary") return b.rarity === "legendary" || b.rarity === "mythic";
      if (filter === "epic") return b.rarity === "epic";
      if (filter === "rare") return b.rarity === "rare";
      if (filter === "common") return b.rarity === "common";
      return true;
    });
  }, [all.data, owned, filter, search]);

  const copyBadgeLink = () => {
    if (typeof window !== "undefined" && active) {
      navigator.clipboard.writeText(`${window.location.origin}/badges`);
      toast.success("Badge showcase link copied");
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Page Header with Collection Metrics */}
      <div className="glass rounded-3xl p-6 border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
              <Award className="h-7 w-7 text-primary" /> {t("badge_showcase")}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {t("badge_showcase_desc")}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
            <div className="text-right">
              <div className="text-sm font-bold font-mono text-foreground">
                {ownedCount} / {totalCount}
              </div>
              <div className="text-[11px] text-muted-foreground font-medium">{t("collected")}</div>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 grid place-items-center text-primary font-bold text-xs">
              {progressPct}%
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <Progress value={progressPct} className="h-2 bg-white/5" />
          <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
            <span>{t("novice_collector")}</span>
            <span>{ownedCount >= 10 ? t("master_achiever") : tf("needed_for_master", { count: 10 })}</span>
          </div>
        </div>
      </div>

      {/* Dynamic Multi-Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Center Grid (col-span-8 or full width on small screens) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Controls bar: search + category filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("search_badges")}
                className="pl-9 h-10 rounded-xl bg-white/[0.03] border-white/10 text-xs"
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none" role="tablist">
              {(
                [
                  ["all", t("filter_all")],
                  ["unlocked", t("filter_unlocked")],
                  ["locked", t("filter_locked")],
                  ["legendary", t("filter_legendary")],
                  ["epic", t("filter_epic")],
                  ["rare", t("filter_rare")],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  aria-pressed={filter === id}
                  className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition border ${
                    filter === id
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Badges Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {all.isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="glass rounded-2xl p-4 border border-white/5 h-40 animate-pulse" />
              ))}

            {filteredBadges.map((b) => {
              const hasIt = owned.has(b.id);
              const isSelected = active?.id === b.id;

              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBadge(b)}
                  className={`glass rounded-2xl p-4 border text-center flex flex-col items-center justify-between transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    isSelected
                      ? "border-primary bg-primary/[0.08] shadow-[0_0_16px_rgba(200,255,61,0.18)]"
                      : hasIt
                        ? "border-white/10 hover:border-white/20 hover:bg-white/[0.04]"
                        : "border-white/5 opacity-55 hover:opacity-80 hover:border-white/15 hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center justify-center pt-2">
                    {hasIt ? (
                      <BadgeChip badge={b} size="lg" />
                    ) : (
                      <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="my-2 min-w-0 w-full">
                    <h3 className="font-display font-bold text-xs truncate text-foreground">{b.name}</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{b.description}</p>
                  </div>
                  <span
                    className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: `${b.color}22`, color: b.color }}
                  >
                    {t(`rarity_${b.rarity}`)}
                  </span>
                </button>
              );
            })}
          </div>

          {!all.isLoading && filteredBadges.length === 0 && (
            <div className="glass rounded-2xl p-8 border border-white/5 text-center text-xs text-muted-foreground">
              {t("no_badges_match")}
            </div>
          )}
        </div>

        {/* Right Pane: Dynamic Badge Inspector on Wide Screens */}
        <aside className="lg:col-span-5 xl:col-span-4 sticky top-6 space-y-4">
          {active ? (
            <div className="glass-strong rounded-3xl p-6 border border-white/10 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  <span className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground">
                    Badge Inspector
                  </span>
                </div>
                <span
                  className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full border"
                  style={{
                    backgroundColor: `${active.color}18`,
                    color: active.color,
                    borderColor: `${active.color}35`,
                  }}
                >
                  {active.rarity}
                </span>
              </div>

              {/* Big Badge Icon Display */}
              <div className="flex flex-col items-center text-center py-4 space-y-3">
                <div className="scale-125 my-2">
                  {isActiveOwned ? (
                    <BadgeChip badge={active} size="lg" />
                  ) : (
                    <div className="h-14 w-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shadow-lg">
                      <Lock className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-foreground">{active.name}</h2>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">{active.description}</p>
                </div>
              </div>

              {/* Unlock Status Card */}
              <div
                className={`rounded-2xl p-4 border flex items-center gap-3 ${
                  isActiveOwned
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-white/10 bg-white/[0.02] text-muted-foreground"
                }`}
              >
                {isActiveOwned ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                ) : (
                  <Lock className="h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">
                    {isActiveOwned ? t("unlocked_owned") : t("locked_achiever")}
                  </p>
                  <p className="text-[11px] leading-snug">
                    {isActiveOwned
                      ? t("unlocked_owned_desc")
                      : t("locked_desc")}
                  </p>
                </div>
              </div>

              {/* Rarity & Stats */}
              <div className="space-y-2 pt-2 border-t border-white/10 text-xs">
                <div className="flex justify-between py-1 text-muted-foreground">
                  <span>{t("badge_tier")}</span>
                  <span className="capitalize font-medium text-foreground">{active.rarity}</span>
                </div>
                <div className="flex justify-between py-1 text-muted-foreground">
                  <span>{t("slug_key")}</span>
                  <span className="font-mono text-[11px] text-foreground">#{active.slug}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={copyBadgeLink}
                  className="w-full gap-2 border-white/10 bg-white/[0.04] text-xs h-10 hover:bg-white/[0.08]"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  {t("share")}
                </Button>
                {isActiveOwned && (
                  <Button
                    type="button"
                    onClick={() => toast.success("Badge equipped to profile header!")}
                    className="w-full gap-2 bg-primary text-primary-foreground text-xs h-10 font-semibold"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {t("feature_badge")}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="glass rounded-3xl p-6 border border-white/10 text-center text-xs text-muted-foreground">
              {t("select_badge")}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
