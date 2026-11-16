import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAvatarPalette } from "@/components/ui/avatar";
import { normalizeAvatarUrl } from "@/lib/default-avatars";
import { formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Check, Loader2, UserPlus, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toast";

type Suggestion = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  paw_balance: number;
  rizz_score: number;
  interests: string[] | null;
  sharedInterests: string[];
};

/**
 * Activities get a colour each, because a list of suggestions is only as useful
 * as the reason behind each one. Matching "Music" twice should look like the
 * same thing twice, and a reader should be able to scan the column for the one
 * activity they care about instead of reading every handle line.
 *
 * These are literal class strings rather than computed hues: Tailwind only ships
 * classes it can see in the source, and a `hue-${n}` template would render grey.
 */
const ACTIVITY_STYLES: Record<string, string> = {
  music: "border-[#f0a6ff]/35 bg-[#f0a6ff]/12 text-[#f0b8ff]",
  study: "border-[#9fc8ff]/35 bg-[#9fc8ff]/12 text-[#a9ceff]",
  gaming: "border-[#c9a6ff]/35 bg-[#c9a6ff]/12 text-[#d0b0ff]",
  games: "border-[#c9a6ff]/35 bg-[#c9a6ff]/12 text-[#d0b0ff]",
  art: "border-[#ffc48a]/35 bg-[#ffc48a]/12 text-[#ffcb96]",
  sports: "border-[#8ff0c0]/35 bg-[#8ff0c0]/12 text-[#9bf3c7]",
  movies: "border-[#ffb3c1]/35 bg-[#ffb3c1]/12 text-[#ffbcc9]",
  travel: "border-[#9ff0e6]/35 bg-[#9ff0e6]/12 text-[#a9f2e9]",
  food: "border-[#ffd28a]/35 bg-[#ffd28a]/12 text-[#ffd99a]",
  tech: "border-[#a6d4ff]/35 bg-[#a6d4ff]/12 text-[#b0daff]",
};
const ACTIVITY_FALLBACK = [
  "border-[#c9ff3d]/35 bg-[#c9ff3d]/12 text-[#d4ff6a]",
  "border-[#ffc48a]/35 bg-[#ffc48a]/12 text-[#ffcb96]",
  "border-[#9fc8ff]/35 bg-[#9fc8ff]/12 text-[#a9ceff]",
  "border-[#f0a6ff]/35 bg-[#f0a6ff]/12 text-[#f0b8ff]",
  "border-[#8ff0c0]/35 bg-[#8ff0c0]/12 text-[#9bf3c7]",
];

/** Same activity, same colour, every session. */
function activityClass(activity: string) {
  const key = activity.trim().toLowerCase();
  const known = ACTIVITY_STYLES[key] ?? ACTIVITY_STYLES[key.split(/\s+/)[0] ?? ""];
  if (known) return known;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return ACTIVITY_FALLBACK[Math.abs(hash) % ACTIVITY_FALLBACK.length];
}

/**
 * The people-card from the feed reference: one calm dark panel, a people mark
 * and title, then roomy rows with a circular face, the name, one handle line
 * (`@name · N rizz`) and a solid lime Follow control.
 *
 * The panel sits inside a slowly sweeping border — a 12s gradient turn, not a
 * strobe — which is what makes the section read as a distinct box instead of
 * another slice of the feed. Rows are divided by a hairline so each person is
 * one boxed entry, and the reason they were suggested is drawn as coloured
 * activity chips: matching interests share a colour, so the column can be
 * scanned by activity rather than read line by line.
 */
export function FollowSuggestions() {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [followed, setFollowed] = useState<string[]>([]);

  const { data } = useQuery({
    queryKey: ["follow-suggestions", user?.id, (profile?.interests ?? []).join(",")],
    enabled: !!user,
    queryFn: async () => {
      const { data: following } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user!.id);
      const excludeIds = [user!.id, ...(following ?? []).map((r: any) => r.following_id)];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, paw_balance, rizz_score, interests")
        .not("id", "in", `(${excludeIds.join(",")})`)
        .order("rizz_score", { ascending: false })
        .not("username", "is", null)
        .limit(40);
      const interests = new Set((profile?.interests ?? []).map((item) => item.toLowerCase()));
      return (profs ?? [])
        .map((person) => {
          const sharedInterests = (person.interests ?? []).filter((interest: string) =>
            interests.has(interest.toLowerCase()),
          );
          return { ...person, sharedInterests, interestScore: sharedInterests.length };
        })
        .sort(
          (left, right) =>
            right.interestScore - left.interestScore ||
            Number(right.rizz_score ?? 0) - Number(left.rizz_score ?? 0) ||
            Number(right.paw_balance ?? 0) - Number(left.paw_balance ?? 0),
        )
        .slice(0, 5) as Suggestion[];
    },
    staleTime: 60_000,
  });

  const followMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: user!.id, following_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["follow-suggestions"] });
      toast.success("Following ✨");
    },
    onError: (error: Error, id: string) => {
      setFollowed((current) => current.filter((value) => value !== id));
      toast.error(error.message);
    },
  });

  if (!data || data.length === 0) return null;

  return (
    <section
      data-focus-hide
      aria-labelledby="suggested-for-you-heading"
      className="suggest-frame mb-3 rounded-[26px]"
    >
      <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#141416]">
        <div className="flex items-center gap-2.5 px-4 pb-2.5 pt-3.5">
          <Users
            className="h-[18px] w-[18px] shrink-0 text-[#f2efe6]"
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <h3
            id="suggested-for-you-heading"
            className="min-w-0 flex-1 truncate font-display text-[15px] font-bold leading-tight tracking-[-0.015em] text-[#f2efe6]"
          >
            {t("suggested_for_you")}
          </h3>
        </div>

        <div className="px-2 pb-2">
          {data.map((p, index) => {
            const initial = (p.display_name || p.username || "?").charAt(0).toUpperCase();
            const seed = p.username || p.display_name || p.id;
            const palette = getAvatarPalette(seed);
            const shared = (p.sharedInterests ?? []).slice(0, 2);
            const pending = followMut.isPending && followMut.variables === p.id;
            const isFollowed = followed.includes(p.id);

            return (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-3 px-2 py-2.5 transition-colors hover:bg-white/[0.035]",
                  // A hairline between entries: each person is its own box, and
                  // the line is the seam rather than a heavy card border.
                  index > 0 && "border-t border-white/[0.07]",
                )}
              >
                <Link
                  to="/u/$username"
                  params={{ username: p.username ?? "" }}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9ff3d]/60"
                >
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full ring-1 ring-white/[0.08]"
                    style={{ background: p.avatar_url ? "#141418" : palette.bg }}
                    aria-hidden={p.avatar_url ? undefined : true}
                  >
                    {normalizeAvatarUrl(p.avatar_url) ? (
                      <img
                        src={normalizeAvatarUrl(p.avatar_url) ?? undefined}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-[15px] font-semibold" style={{ color: palette.text }}>
                        {initial}
                      </span>
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold leading-tight text-[#f2efe6]">
                      {p.display_name || p.username}
                    </span>
                    <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[11.5px] leading-none">
                      <span className="truncate text-[#938d84]">@{p.username}</span>
                      <span aria-hidden className="shrink-0 text-[#5f5b56]">
                        ·
                      </span>
                      <span className="shrink-0 tabular-nums text-[#938d84]">
                        {formatNumber(p.rizz_score)} rizz
                      </span>
                    </span>
                    {shared.length > 0 && (
                      <span
                        className="mt-1.5 flex flex-wrap items-center gap-1"
                        aria-label={shared.join(" / ")}
                      >
                        {shared.map((activity) => (
                          <span
                            key={activity}
                            className={cn(
                              "rounded-full border px-1.5 py-[2px] text-[9.5px] font-bold uppercase leading-none tracking-[0.04em]",
                              activityClass(activity),
                            )}
                          >
                            {activity}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setFollowed((current) => [...current, p.id]);
                    followMut.mutate(p.id);
                  }}
                  disabled={pending || isFollowed}
                  aria-label={isFollowed ? `Following @${p.username}` : `Follow @${p.username}`}
                  aria-busy={pending || undefined}
                  className={
                    isFollowed
                      ? "relative inline-flex h-9 min-w-[88px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#c9ff3d]/30 bg-[#c9ff3d]/10 px-3 text-[12px] font-bold text-[#c9ff3d] after:absolute after:-inset-y-1 after:inset-x-0 after:content-[''] disabled:opacity-100"
                      : "relative inline-flex h-9 min-w-[88px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#c9ff3d] px-3 text-[12px] font-bold text-[#0b0b0c] transition-colors after:absolute after:-inset-y-1 after:inset-x-0 after:content-[''] hover:bg-[#d6ff62] active:bg-[#bdf22e] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9ff3d]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141416]"
                  }
                >
                  {isFollowed ? (
                    <Check className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
                  ) : pending ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      strokeWidth={2.2}
                      aria-hidden="true"
                    />
                  ) : (
                    <UserPlus className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                  )}
                  {isFollowed ? "Following" : "Follow"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
