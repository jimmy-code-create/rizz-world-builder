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
  music: "border-[#f0a6ff]/30 bg-[#f0a6ff]/10 text-[#f0b8ff]",
  study: "border-[#9fc8ff]/30 bg-[#9fc8ff]/10 text-[#a9ceff]",
  gaming: "border-[#c9a6ff]/30 bg-[#c9a6ff]/10 text-[#d0b0ff]",
  games: "border-[#c9a6ff]/30 bg-[#c9a6ff]/10 text-[#d0b0ff]",
  art: "border-[#ffc48a]/30 bg-[#ffc48a]/10 text-[#ffcb96]",
  sports: "border-[#8ff0c0]/30 bg-[#8ff0c0]/10 text-[#9bf3c7]",
  movies: "border-[#ffb3c1]/30 bg-[#ffb3c1]/10 text-[#ffbcc9]",
  travel: "border-[#9ff0e6]/30 bg-[#9ff0e6]/10 text-[#a9f2e9]",
  food: "border-[#ffd28a]/30 bg-[#ffd28a]/10 text-[#ffd99a]",
  tech: "border-[#a6d4ff]/30 bg-[#a6d4ff]/10 text-[#b0daff]",
};
const ACTIVITY_FALLBACK = [
  "border-[#c9ff3d]/30 bg-[#c9ff3d]/10 text-[#d4ff6a]",
  "border-[#ffc48a]/30 bg-[#ffc48a]/10 text-[#ffcb96]",
  "border-[#9fc8ff]/30 bg-[#9fc8ff]/10 text-[#a9ceff]",
  "border-[#f0a6ff]/30 bg-[#f0a6ff]/10 text-[#f0b8ff]",
  "border-[#8ff0c0]/30 bg-[#8ff0c0]/10 text-[#9bf3c7]",
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
 * People worth following, drawn as one of the app's own cards.
 *
 * The previous version was a compressed utility list — 28px faces and 10px
 * uppercase type — which read as an afterthought next to the posts around it.
 * This one borrows the vocabulary the rest of the app already uses: a `bg-card`
 * panel on the app's border colour, a Bricolage heading beside a lime-tinted
 * icon tile, 36px faces, and pill buttons in the brand signal instead of
 * square-cornered controls.
 *
 * The structure is deliberately the same as every other card in the feed: a
 * header row, then one entry per person separated by a hairline. Each person
 * carries the reason they were suggested — matching interests, coloured by
 * activity so the column can be scanned rather than read.
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
      className="mb-3 overflow-hidden rounded-2xl border border-border bg-card"
    >
      <div className="flex items-center gap-2.5 px-3.5 pb-2.5 pt-3">
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary"
          aria-hidden="true"
        >
          <Users className="h-[15px] w-[15px]" strokeWidth={2.2} />
        </span>
        <h3
          id="suggested-for-you-heading"
          className="min-w-0 flex-1 truncate font-display text-[13.5px] font-semibold leading-none tracking-[-0.01em] text-foreground"
        >
          {t("suggested_for_you")}
        </h3>
        <span
          className="shrink-0 rounded-full border border-border/70 px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums text-muted-foreground"
          aria-hidden="true"
        >
          {data.length}
        </span>
      </div>

      <div>
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
                "flex items-center gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-white/[0.035]",
                // A hairline seam rather than a boxed card per person: the
                // panel is already the frame.
                index > 0 && "border-t border-border/60",
              )}
            >
              <Link
                to="/u/$username"
                params={{ username: p.username ?? "" }}
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full ring-1 ring-white/10"
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
                    <span className="text-[13px] font-semibold" style={{ color: palette.text }}>
                      {initial}
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold leading-tight text-foreground">
                    {p.display_name || p.username}
                  </span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] leading-none">
                    <span className="truncate text-muted-foreground">@{p.username}</span>
                    <span aria-hidden className="shrink-0 text-muted-foreground/50">
                      ·
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
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
                            "rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-[0.06em]",
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
                    ? "relative inline-flex h-[30px] min-w-[74px] shrink-0 items-center justify-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 text-[11.5px] font-bold text-primary after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-[''] disabled:opacity-100"
                    : "relative inline-flex h-[30px] min-w-[74px] shrink-0 items-center justify-center gap-1 rounded-full bg-primary px-3 text-[11.5px] font-bold text-primary-foreground transition-colors after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-[''] hover:brightness-105 active:brightness-95 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                }
              >
                {isFollowed ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden="true" />
                ) : pending ? (
                  <Loader2
                    className="h-3.5 w-3.5 animate-spin"
                    strokeWidth={2.2}
                    aria-hidden="true"
                  />
                ) : (
                  <UserPlus className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
                )}
                {isFollowed ? "Following" : "Follow"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
