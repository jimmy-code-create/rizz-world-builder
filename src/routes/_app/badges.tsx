import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllBadges, fetchUserBadgesWithDates, type Badge } from "@/lib/badges";
import { fetchBadgeProgress } from "@/lib/badge-progress";
import { awardRizz, RIZZ_RULES } from "@/lib/rizz";
import {
  BADGE_SET,
  LEGACY_BADGE_SET,
  badgeSymbolForSlug,
  canonicalFor,
  TIER_LABEL,
} from "@/lib/badge-set";
import { useI18n, tf } from "@/lib/i18n";
import { Badge as BadgeMark } from "@/components/Badge";
import { buildBadgeSharePng, shareBadgePng } from "@/lib/badge-share";
import { Award, Lock, CheckCircle2, Search, Trophy, Share2, Pin, ShieldCheck } from "lucide-react";
import { setFeaturedBadge, useFeaturedBadge } from "@/lib/featured-badge";
import { formatNumber } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/_app/badges")({
  head: () => ({ meta: [{ title: "Badges · RIZZ" }] }),
  component: BadgesPage,
});

type FilterTab = "all" | "unlocked" | "locked" | "legendary" | "epic" | "rare" | "common";

export function BadgesPage() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const { t } = useI18n();
  const all = useQuery({ queryKey: ["badges-all"], queryFn: fetchAllBadges });
  const mine = useQuery({
    queryKey: ["badges-mine", user?.id],
    queryFn: () => fetchUserBadgesWithDates(user!.id),
    enabled: !!user,
  });
  // How far along this member is for every badge that has a measurable rule.
  const progressQuery = useQuery({
    queryKey: ["badge-progress", user?.id],
    queryFn: () => fetchBadgeProgress(user!.id),
    enabled: !!user,
    staleTime: 60_000,
  });
  const progressMap = progressQuery.data;

  // Existing admin tooling stays database-backed during the visual catalog
  // rollout; actual awards still require the database's admin-only RLS policy.
  const adminCheck = useQuery({
    queryKey: ["am-admin", user?.id],
    enabled: !!user,
    staleTime: 300_000,
    queryFn: async (): Promise<boolean> => {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user!.id);
        if (error) throw error;
        return ((data ?? []) as Array<{ role: string }>).some((r) => r.role === "admin");
      } catch {
        return false;
      }
    },
  });
  const [grantSlug, setGrantSlug] = useState("founder");
  const [grantUser, setGrantUser] = useState("");
  const [granting, setGranting] = useState(false);

  const awardBadge = async () => {
    const handle = grantUser.trim().replace(/^@/, "");
    if (!handle || granting) return;
    setGranting(true);
    try {
      const badgeRow = (all.data ?? []).find((b) => b.slug === grantSlug);
      if (!badgeRow)
        throw new Error("That badge isn't in the database yet — apply the badge migration first.");
      // Handles are case-insensitive: "Jimmy" finds @jimmy.
      // Backslash-escape LIKE wildcards so "100%_real" still matches literally.
      const { data: target, error: lookupError } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", handle.replace(/([%_\\])/g, "\\$1"))
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (!target) throw new Error(`No account @${handle} found.`);
      const { error: insertError } = await supabase
        .from("user_badges")
        .insert({ user_id: (target as { id: string }).id, badge_id: badgeRow.id });
      if (insertError) throw insertError;
      toast.success(`Awarded ${badgeRow.name} to @${handle}`);
      setGrantUser("");
      // Earning a badge is worth rizz. The server awards it when the scoring
      // pipeline is live; until then the client can only credit itself.
      void awardRizz((target as { id: string }).id, RIZZ_RULES.badge_earned, "badge").catch(
        () => false,
      );
      if ((target as { id: string }).id === user?.id) {
        void qc.invalidateQueries({ queryKey: ["badges-mine", user?.id] });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't award that badge");
    } finally {
      setGranting(false);
    }
  };

  // The catalog is frontend metadata so the complete 12-badge collection stays
  // visible even before the backend seed is deployed. Ownership comes only from
  // real user_badges rows; a catalog entry is never treated as an earned award.
  const catalog = useMemo<Badge[]>(
    () =>
      BADGE_SET.map((entry) => {
        const stored = (all.data ?? []).find((row) => row.slug === entry.slug);
        return {
          id: stored?.id ?? `catalog:${entry.slug}`,
          slug: entry.slug,
          name: entry.name,
          description: entry.flavor,
          icon: stored?.icon ?? entry.icon,
          color: entry.glow,
          rarity: entry.tier,
        };
      }),
    [all.data],
  );
  const owned = useMemo(() => new Set((mine.data ?? []).map((r) => r.badge.slug)), [mine.data]);
  const awardedAtFor = useMemo(
    () => new Map((mine.data ?? []).map((r) => [r.badge.slug, r.awardedAt])),
    [mine.data],
  );
  const legacyEarned = useMemo(
    () =>
      (mine.data ?? []).filter((row) =>
        LEGACY_BADGE_SET.some((badge) => badge.slug === row.badge.slug),
      ),
    [mine.data],
  );
  // The badge worn beside this member's name (profiles.featured_badge).
  const featuredQ = useFeaturedBadge(user?.id);
  const featuredSlug = featuredQ.data?.slug ?? null;
  const [featuring, setFeaturing] = useState(false);

  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  const totalCount = BADGE_SET.length;
  const ownedCount = catalog.filter((badge) => owned.has(badge.slug)).length;
  const progressPct = totalCount > 0 ? Math.round((ownedCount / totalCount) * 100) : 0;

  // Rarity breakdown for the header strip: how many of each tier you hold.
  const rarityRows = useMemo(() => {
    const tiers = ["mythic", "legendary", "epic", "rare", "common"] as const;
    return tiers
      .map((tier) => {
        const rows = catalog.filter((b) => b.rarity === tier);
        return {
          tier,
          owned: rows.filter((b) => owned.has(b.slug)).length,
          total: rows.length,
          color: rows[0]?.color ?? "#a1a1aa",
        };
      })
      .filter((row) => row.total > 0);
  }, [catalog, owned]);

  // Active badge defaulting to first in the 12-badge collection or selection.
  const displayBadges = [...catalog, ...legacyEarned.map((row) => row.badge)];
  const active =
    displayBadges.find((badge) => badge.slug === selectedBadge?.slug) ?? catalog[0] ?? null;
  const isActiveOwned = active ? owned.has(active.slug) : false;
  const isActiveFeatured = !!active && featuredSlug === active.slug;
  const activeProgress = active ? (progressMap?.[active.slug] ?? null) : null;

  /** Wear / unwear a badge. One at a time, persisted on the profile. */
  const toggleFeatured = async () => {
    if (!active || !isActiveOwned || !user || featuring) return;
    setFeaturing(true);
    try {
      const next = isActiveFeatured ? null : active.slug;
      await setFeaturedBadge(user.id, next);
      await qc.invalidateQueries({ queryKey: ["featured-badge"] });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      await qc.invalidateQueries({ queryKey: ["profile-card"] });
      toast.success(next ? `${active.name} is now on your profile` : "Featured badge removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update your featured badge");
    } finally {
      setFeaturing(false);
    }
  };

  const filteredBadges = useMemo(() => {
    return catalog.filter((b) => {
      const matchesSearch =
        !search.trim() ||
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        b.description.toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;

      const isOwned = owned.has(b.slug);
      if (filter === "unlocked") return isOwned;
      if (filter === "locked") return !isOwned;
      if (filter === "legendary") return b.rarity === "legendary" || b.rarity === "mythic";
      if (filter === "epic") return b.rarity === "epic";
      if (filter === "rare") return b.rarity === "rare";
      if (filter === "common") return b.rarity === "common";
      return true;
    });
  }, [catalog, owned, filter, search]);

  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    if (!active || sharing) return;
    setSharing(true);
    try {
      const blob = await buildBadgeSharePng({
        badgeName: active.name,
        flavor: active.description,
        slug: active.slug,
        tier: active.rarity,
        glow: active.color,
        unlockedAt: isActiveOwned ? (awardedAtFor.get(active.slug) ?? null) : null,
        earned: isActiveOwned,
        displayName: profile?.display_name || profile?.username || "RIZZ member",
        username: profile?.username || "member",
        avatarUrl: profile?.avatar_url ?? null,
        symbol: badgeSymbolForSlug(active.slug),
      });
      const result = await shareBadgePng(blob, `rizz-badge-${active.slug}.png`);
      toast.success(result === "shared" ? "Badge shared" : "Badge image downloaded");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "Couldn't make the image");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header: collection metrics, progress and a rarity strip, so the page
          reads like a collector's shelf instead of a plain grid. */}
      <div className="glass relative space-y-5 overflow-hidden rounded-3xl border border-white/10 p-6">
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2.5 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              <span className="grid h-11 w-11 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                <Award className="h-6 w-6" />
              </span>
              {t("badge_showcase")}
            </h1>
            <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">
              {t("badge_showcase_desc")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 self-start sm:self-auto">
            <div className="text-right">
              <div className="font-mono text-base font-bold text-foreground">
                {user && mine.isLoading ? "—" : formatNumber(ownedCount)}{" "}
                <span className="text-muted-foreground">/ {formatNumber(totalCount)}</span>
              </div>
              <div className="text-[11px] font-medium text-muted-foreground">
                {user && mine.isLoading ? "Syncing collection…" : t("collected")}
              </div>
            </div>
            <div
              className="grid h-12 w-12 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-sm font-bold text-primary"
              aria-label={`${progressPct}% collected`}
            >
              {progressPct}%
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative space-y-1.5">
          <Progress value={progressPct} className="h-2 bg-white/5" />
          <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
            <span>{t("novice_collector")}</span>
            <span>
              {ownedCount >= totalCount
                ? t("master_achiever")
                : tf("needed_for_master", { count: totalCount - ownedCount })}
            </span>
          </div>
        </div>

        {/* Rarity strip: one dot per badge you own, out of that tier's total. */}
        {rarityRows.length > 0 && (
          <div className="relative flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.07] pt-4">
            {rarityRows.map((row) => (
              <div key={row.tier} className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: row.color }}
                  aria-hidden="true"
                />
                <span className="font-mono text-xs font-bold text-foreground">
                  {row.owned}
                  <span className="text-muted-foreground">/{row.total}</span>
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {row.tier}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {user && mine.isError && (
        <div
          role="status"
          className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-xs text-amber-100/80"
        >
          Your badge catalog is ready, but earned badges could not be loaded right now. Try again in
          a moment.
        </div>
      )}

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

            <div
              className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none"
              role="tablist"
            >
              {(
                [
                  ["all", t("filter_all")],
                  ["unlocked", t("filter_unlocked")],
                  ["locked", t("filter_locked")],
                  ["legendary", t("filter_legendary")],
                  ["epic", t("filter_epic")],
                  ["rare", t("filter_rare")],
                  ["common", t("filter_common")],
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
            {filteredBadges.map((b) => {
              const hasIt = owned.has(b.slug);
              const isSelected = active?.slug === b.slug;
              const progress = progressMap?.[b.slug] ?? null;

              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBadge(b)}
                  aria-pressed={isSelected}
                  className={`group glass relative flex flex-col items-center justify-between overflow-hidden rounded-2xl border p-4 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    isSelected
                      ? "border-primary bg-primary/[0.08]"
                      : hasIt
                        ? "border-white/10 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.04]"
                        : "border-dashed border-white/10 opacity-70 hover:border-white/25 hover:bg-white/[0.03] hover:opacity-100"
                  }`}
                >
                  <div className="relative flex h-24 items-center justify-center">
                    <span className="badge-display relative">
                      <BadgeMark slug={b.slug} size={96} locked={!hasIt} title={b.name} />
                      {!hasIt && (
                        <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border border-white/15 bg-[#101116] shadow-lg">
                          <Lock className="h-3.5 w-3.5 text-white/70" />
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="relative my-2 min-w-0 w-full">
                    <h3 className="truncate font-display text-xs font-bold text-foreground">
                      {b.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                      {b.description}
                    </p>
                    {progress && !hasIt && (
                      <div className="mt-2 w-full">
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${progress.pct}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[10px] font-semibold text-primary">
                          {progress.current} / {progress.target}
                          {progress.current < progress.target && (
                            <span className="font-normal text-muted-foreground">
                              {" · "}
                              {progress.target - progress.current} to go
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                  <span className="relative flex items-center gap-1">
                    {featuredSlug === b.slug && (
                      <span
                        className="flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary"
                        title="Worn on your profile"
                      >
                        <Pin className="h-2.5 w-2.5" /> Worn
                      </span>
                    )}
                    <span
                      className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                      style={{ background: `${b.color}22`, color: b.color }}
                    >
                      {t(`rarity_${b.rarity}`)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {filteredBadges.length === 0 && (
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

              {/* Art panel: the badge at full showcase size on its soft ring. */}
              <div className="relative grid place-items-center rounded-2xl border border-white/10 bg-white/[0.02] py-7">
                <div className="relative flex flex-col items-center gap-3 text-center">
                  <span className="badge-display relative">
                    <BadgeMark
                      slug={active.slug}
                      size={96}
                      locked={!isActiveOwned}
                      title={active.name}
                    />
                    {!isActiveOwned && (
                      <span className="absolute bottom-1 right-1 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-[#101116]">
                        <Lock className="h-4 w-4 text-white/80" />
                      </span>
                    )}
                  </span>
                  <div className="px-4">
                    <h2 className="font-display text-lg font-bold text-foreground">
                      {active.name}
                    </h2>
                    <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                      {active.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Unlock status / how to earn */}
              <div
                className={`flex items-center gap-3 rounded-2xl border p-4 ${
                  isActiveOwned
                    ? "border-emerald-500/25 bg-emerald-500/10"
                    : "border-white/10 bg-white/[0.02]"
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
                  {isActiveOwned ? (
                    <p className="text-[11px] leading-snug text-emerald-200/90">
                      {t("unlocked_owned_desc")}
                    </p>
                  ) : activeProgress ? (
                    <div className="mt-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-primary">
                          {activeProgress.current} / {activeProgress.target}
                        </span>
                        {activeProgress.current < activeProgress.target && (
                          <span className="text-muted-foreground">
                            {activeProgress.target - activeProgress.current} to go
                          </span>
                        )}
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${activeProgress.pct}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      {t("locked_desc")}
                    </p>
                  )}
                </div>
              </div>

              {/* Rarity & stats */}
              <div className="space-y-1 border-t border-white/10 pt-3 text-xs">
                <div className="flex items-center justify-between py-1 text-muted-foreground">
                  <span>{t("badge_tier")}</span>
                  <span className="flex items-center gap-1.5 font-medium capitalize text-foreground">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: active.color }}
                      aria-hidden="true"
                    />
                    {active.rarity}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 text-muted-foreground">
                  <span>{t("slug_key")}</span>
                  <span className="font-mono text-[11px] text-foreground">#{active.slug}</span>
                </div>
                {isActiveOwned && awardedAtFor.get(active.slug) && (
                  <div className="flex items-center justify-between py-1 text-muted-foreground">
                    <span>{t("earned")}</span>
                    <span className="text-foreground">
                      {new Date(awardedAtFor.get(active.slug)!).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
              </div>

              {/* Share previews (locked too), then wear / unwear the badge. */}
              <div className="space-y-2 pt-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={sharing}
                    onClick={() => void handleShare()}
                    className="h-11 w-full gap-2 border-white/10 bg-white/[0.04] text-xs hover:bg-white/[0.08] disabled:opacity-60"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    {sharing ? t("making_image") : t("share")}
                  </Button>
                  {isActiveOwned && (
                    <Button
                      type="button"
                      disabled={featuring}
                      onClick={() => void toggleFeatured()}
                      aria-pressed={isActiveFeatured}
                      className={
                        isActiveFeatured
                          ? "h-11 w-full gap-2 border border-primary/40 bg-primary/10 text-xs font-semibold text-primary hover:bg-primary/15"
                          : "h-11 w-full gap-2 bg-primary text-xs font-semibold text-primary-foreground"
                      }
                    >
                      {isActiveFeatured ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Worn · remove
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {featuring ? "Saving…" : t("feature_badge")}
                        </>
                      )}
                    </Button>
                  )}
                </div>
                <p className="flex items-start gap-1.5 text-[10.5px] leading-snug text-muted-foreground">
                  <Pin className="mt-0.5 h-3 w-3 shrink-0" />
                  {isActiveFeatured
                    ? `${active.name} sits beside your name on your profile and hover card.`
                    : isActiveOwned
                      ? "One badge at a time — it follows you across the app."
                      : "Earn this badge to wear it beside your name."}
                </p>
              </div>
            </div>
          ) : (
            <div className="glass rounded-3xl p-6 border border-white/10 text-center text-xs text-muted-foreground">
              {t("select_badge")}
            </div>
          )}
        </aside>
      </div>

      {legacyEarned.length > 0 && (
        <section
          className="glass rounded-3xl border border-white/10 p-5 sm:p-6"
          aria-labelledby="legacy-badges-title"
        >
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Archive
              </p>
              <h2
                id="legacy-badges-title"
                className="mt-1 font-display text-lg font-bold text-foreground"
              >
                Classic RIZZ badges
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Your original awards are kept and shareable.
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold text-muted-foreground">
              {legacyEarned.length} preserved
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {legacyEarned.map(({ badge }) => (
              <button
                key={badge.slug}
                type="button"
                onClick={() => setSelectedBadge(badge)}
                aria-label={`Share ${canonicalFor(badge.slug)?.name ?? badge.name}`}
                className="group flex min-h-12 items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-3 transition hover:border-white/20 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <BadgeMark slug={badge.slug} size={32} />
                <span className="text-left">
                  <span className="block text-xs font-semibold text-foreground">
                    {canonicalFor(badge.slug)?.name ?? badge.name}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    Earned{" "}
                    {awardedAtFor.get(badge.slug)
                      ? new Date(awardedAtFor.get(badge.slug)!).toLocaleDateString([], {
                          month: "short",
                          year: "numeric",
                        })
                      : "in the classic set"}
                  </span>
                </span>
                <Share2 className="ml-1 h-3.5 w-3.5 text-muted-foreground transition group-hover:text-primary" />
              </button>
            ))}
          </div>
        </section>
      )}

      {adminCheck.data === true && (
        <div className="glass rounded-3xl p-5 border border-white/10 space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A8A8E]">
              Admin
            </p>
            <h2 className="font-display text-base font-bold mt-0.5">Award a badge</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Type your own @handle to assign one to yourself.
            </p>
          </div>

          {(() => {
            const entry = canonicalFor(grantSlug) ?? BADGE_SET[0];
            const dbRow = (all.data ?? []).find((b) => b.slug === entry.slug);
            const glow = dbRow?.color ?? entry.glow;
            return (
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-[#1c1c1f]">
                  <BadgeMark slug={entry.slug} size={34} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#f2efe6]">
                    {dbRow?.name ?? entry.name}
                    <span
                      className="rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                      style={{ borderColor: `${glow}55`, color: glow }}
                    >
                      {TIER_LABEL[entry.tier]}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {dbRow?.description ?? entry.flavor}
                  </p>
                </div>
              </div>
            );
          })()}

          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Badge to award">
            {(all.data ?? []).map((dbBadge) => {
              const entry = canonicalFor(dbBadge.slug);
              const selected = grantSlug === dbBadge.slug;
              return (
                <button
                  key={dbBadge.slug}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setGrantSlug(dbBadge.slug)}
                  className={`min-h-[44px] rounded-full border px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d] ${
                    selected
                      ? "border-[#c8ff3d] bg-[#c8ff3d]/15 text-[#c8ff3d]"
                      : "border-[#2a2a2e] text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {entry?.name ?? dbBadge.name}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Input
              value={grantUser}
              onChange={(e) => setGrantUser(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void awardBadge();
                }
              }}
              placeholder="@username"
              aria-label="Username to award"
              maxLength={40}
              className="h-11 flex-1 rounded-full border-[#2a2a2e] bg-[#141416]"
            />
            <Button
              type="button"
              disabled={granting || !grantUser.trim()}
              onClick={() => void awardBadge()}
              className="h-11 rounded-full bg-[#c8ff3d] px-5 text-sm font-bold text-[#0b0b0c] hover:bg-[#c8ff3d]/90 disabled:opacity-50"
            >
              {granting ? "Awarding…" : "Award"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
