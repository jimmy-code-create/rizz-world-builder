import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllBadges, fetchUserBadgesWithDates, type Badge } from "@/lib/badges";
import { BADGE_SET, canonicalFor, TIER_LABEL } from "@/lib/badge-set";
import { useI18n, tf } from "@/lib/i18n";
import { BadgeChip } from "@/components/BadgeChip";
import { BadgeIcon } from "@/components/BadgeIcon";
import { buildBadgeSharePng, shareBadgePng } from "@/lib/badge-share";
import { Award, Lock, Sparkles, CheckCircle2, Search, Trophy, ShieldCheck, Share2 } from "lucide-react";
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

  // Admin-only award tool (best-effort gate; RLS "admins grant badges"
  // is the real enforcement). Lets the team grant any of the 5 badges —
  // including to yourself for testing — without touching the database.
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
  const [grantSlug, setGrantSlug] = useState(BADGE_SET[0].slug);
  const [grantUser, setGrantUser] = useState("");
  const [granting, setGranting] = useState(false);

  const awardBadge = async () => {
    const handle = grantUser.trim().replace(/^@/, "");
    if (!handle || granting) return;
    setGranting(true);
    try {
      const badgeRow = (all.data ?? []).find((b) => b.slug === grantSlug);
      if (!badgeRow) throw new Error("That badge isn't in the database yet — apply the badge migration first.");
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
      if ((target as { id: string }).id === user?.id) {
        void qc.invalidateQueries({ queryKey: ["badges-mine", user?.id] });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't award that badge");
    } finally {
      setGranting(false);
    }
  };

  const owned = useMemo(() => new Set((mine.data ?? []).map((r) => r.badge.id)), [mine.data]);
  const awardedAtFor = useMemo(
    () => new Map((mine.data ?? []).map((r) => [r.badge.slug, r.awardedAt])),
    [mine.data],
  );
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  const totalCount = all.data?.length ?? 0;
  const ownedCount = mine.data?.length ?? 0;
  const progressPct = totalCount > 0 ? Math.round((ownedCount / totalCount) * 100) : 0;

  // Rarity breakdown for the header strip: how many of each tier you hold.
  const rarityRows = useMemo(() => {
    const tiers = ["mythic", "legendary", "epic", "rare", "common"] as const;
    return tiers
      .map((tier) => {
        const rows = (all.data ?? []).filter((b) => b.rarity === tier);
        return {
          tier,
          owned: rows.filter((b) => owned.has(b.id)).length,
          total: rows.length,
          color: rows[0]?.color ?? "#a1a1aa",
        };
      })
      .filter((row) => row.total > 0);
  }, [all.data, owned]);

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
        displayName: profile?.display_name || profile?.username || "RIZZ member",
        username: profile?.username || "member",
        avatarUrl: profile?.avatar_url ?? null,
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
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />

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
                {formatNumber(ownedCount)} <span className="text-muted-foreground">/ {formatNumber(totalCount)}</span>
              </div>
              <div className="text-[11px] font-medium text-muted-foreground">{t("collected")}</div>
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
            <span>{ownedCount >= 10 ? t("master_achiever") : tf("needed_for_master", { count: 10 })}</span>
          </div>
        </div>

        {/* Rarity strip: one dot per badge you own, out of that tier's total. */}
        {rarityRows.length > 0 && (
          <div className="relative flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.07] pt-4">
            {rarityRows.map((row) => (
              <div key={row.tier} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color, boxShadow: `0 0 10px ${row.color}88` }} aria-hidden="true" />
                <span className="font-mono text-xs font-bold text-foreground">
                  {row.owned}<span className="text-muted-foreground">/{row.total}</span>
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{row.tier}</span>
              </div>
            ))}
          </div>
        )}
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
                  aria-pressed={isSelected}
                  className={`group glass relative flex flex-col items-center justify-between overflow-hidden rounded-2xl border p-4 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    isSelected
                      ? "border-primary bg-primary/[0.08] shadow-[0_0_20px_rgba(200,255,61,0.18)]"
                      : hasIt
                        ? "border-white/10 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.04]"
                        : "border-dashed border-white/10 opacity-70 hover:border-white/25 hover:bg-white/[0.03] hover:opacity-100"
                  }`}
                >
                  {/* Tier glow blooms on hover — the tile's only colour until you own it. */}
                  <span
                    className="pointer-events-none absolute inset-x-6 -top-12 h-24 rounded-full opacity-0 blur-2xl transition-opacity group-hover:opacity-100"
                    style={{ background: `${b.color}33` }}
                    aria-hidden="true"
                  />
                  <div className="relative flex h-20 items-center justify-center">
                    {hasIt ? (
                      <BadgeChip badge={b} size="lg" />
                    ) : (
                      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="relative my-2 min-w-0 w-full">
                    <h3 className="truncate font-display text-xs font-bold text-foreground">{b.name}</h3>
                    <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-muted-foreground">{b.description}</p>
                  </div>
                  <span
                    className="relative rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
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

              {/* Art panel: the badge sits on a tier-tinted plinth with its glow. */}
              <div
                className="relative grid place-items-center overflow-hidden rounded-2xl border border-white/10 py-7"
                style={{ background: `radial-gradient(120% 90% at 50% 0%, ${active.color}1f, rgba(255,255,255,0.02) 70%)` }}
              >
                <span
                  className="pointer-events-none absolute -bottom-16 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full blur-3xl"
                  style={{ background: `${active.color}33` }}
                  aria-hidden="true"
                />
                <div className="relative flex flex-col items-center gap-3 text-center">
                  {isActiveOwned ? (
                    <span data-badge-art className="inline-flex scale-125">
                      <BadgeChip badge={active} size="lg" />
                    </span>
                  ) : (
                    <div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-black/30 shadow-lg">
                      <Lock className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="px-4">
                    <h2 className="font-display text-lg font-bold text-foreground">{active.name}</h2>
                    <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">{active.description}</p>
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
                  <p className={`text-[11px] leading-snug ${isActiveOwned ? "text-emerald-200/90" : "text-muted-foreground"}`}>
                    {isActiveOwned
                      ? t("unlocked_owned_desc")
                      : t("locked_desc")}
                  </p>
                </div>
              </div>

              {/* Rarity & stats */}
              <div className="space-y-1 border-t border-white/10 pt-3 text-xs">
                <div className="flex items-center justify-between py-1 text-muted-foreground">
                  <span>{t("badge_tier")}</span>
                  <span className="flex items-center gap-1.5 font-medium capitalize text-foreground">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: active.color }} aria-hidden="true" />
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
                      {new Date(awardedAtFor.get(active.slug)!).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="pt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={sharing}
                  onClick={() => void handleShare()}
                  className="w-full gap-2 border-white/10 bg-white/[0.04] text-xs h-10 hover:bg-white/[0.08] disabled:opacity-60"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  {sharing ? t("making_image") : t("share")}
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

      {adminCheck.data === true && (
        <div className="glass rounded-3xl p-5 border border-white/10 space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A8A8E]">Admin</p>
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
              <div
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                style={{ boxShadow: `0 0 24px ${glow}22` }}
              >
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-[#1c1c1f]">
                  <BadgeIcon icon={dbRow?.icon ?? entry.icon} glow={glow} size={30} />
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
            {BADGE_SET.map((entry) => {
              const selected = grantSlug === entry.slug;
              return (
                <button
                  key={entry.slug}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setGrantSlug(entry.slug)}
                  className={`min-h-[44px] rounded-full border px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d] ${
                    selected
                      ? "border-[#c8ff3d] bg-[#c8ff3d]/15 text-[#c8ff3d]"
                      : "border-[#2a2a2e] text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {entry.name}
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
