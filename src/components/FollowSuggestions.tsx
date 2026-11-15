import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAvatarPalette } from "@/components/ui/avatar";
import { normalizeAvatarUrl } from "@/lib/default-avatars";
import { formatNumber } from "@/lib/formatters";
import { Check, UserPlus, Users } from "lucide-react";
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
 * The people-card from the feed reference: one calm dark panel, a people mark
 * and title, then roomy rows with a circular face, the name, one handle line
 * (`@name · N rizz`) and a solid lime Follow control.
 *
 * The old panel was a compact square-avatar list. This keeps the same data and
 * follow mutation, but gives the suggestion section enough presence to read as
 * a deliberate card instead of a strip of utility rows. Shared interests stay
 * as a quiet lime tail so the suggestions still explain why they are here.
 */
export function FollowSuggestions() {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [followed, setFollowed] = useState<string[]>([]);

  const { data } = useQuery({
    queryKey: ["follow-suggestions", user?.id, profile?.interests.join(",")],
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
      className="mb-3 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#141416]"
    >
      <div className="flex items-center gap-3 px-4 pb-2 pt-4">
        <Users
          className="h-[22px] w-[22px] shrink-0 text-[#f2efe6]"
          strokeWidth={1.8}
          aria-hidden="true"
        />
        <h3
          id="suggested-for-you-heading"
          className="min-w-0 flex-1 truncate font-display text-[18px] font-bold leading-tight tracking-[-0.02em] text-[#f2efe6]"
        >
          {t("suggested_for_you")}
        </h3>
      </div>

      <div className="px-2 pb-2.5 pt-1.5">
        {data.map((p) => {
          const initial = (p.display_name || p.username || "?").charAt(0).toUpperCase();
          const seed = p.username || p.display_name || p.id;
          const palette = getAvatarPalette(seed);
          const shared = p.sharedInterests.slice(0, 2);
          const pending = followMut.isPending && followMut.variables === p.id;
          const isFollowed = followed.includes(p.id);

          return (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-white/[0.035]"
            >
              <Link
                to="/u/$username"
                params={{ username: p.username ?? "" }}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9ff3d]/60"
              >
                {/* A circle for the photo or the palette initial, so the row
                    keeps one silhouette whether the member has uploaded a face
                    or is still new. */}
                <span
                  className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full ring-1 ring-white/[0.08]"
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
                    <span className="text-[18px] font-semibold" style={{ color: palette.text }}>
                      {initial}
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold leading-tight text-[#f2efe6]">
                    {p.display_name || p.username}
                  </span>
                  <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[12px] leading-none">
                    <span className="truncate text-[#938d84]">@{p.username}</span>
                    <span aria-hidden className="shrink-0 text-[#5f5b56]">
                      ·
                    </span>
                    <span className="shrink-0 tabular-nums text-[#938d84]">
                      {formatNumber(p.rizz_score)} rizz
                    </span>
                    {shared.length > 0 && (
                      <>
                        <span aria-hidden className="shrink-0 text-[#5f5b56]">
                          ·
                        </span>
                        <span className="truncate text-[#c9ff3d]/70">{shared.join(" / ")}</span>
                      </>
                    )}
                  </span>
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
                className={
                  isFollowed
                    ? "inline-flex h-11 min-w-[100px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#c9ff3d]/30 bg-[#c9ff3d]/10 px-3.5 text-[13px] font-semibold text-[#c9ff3d] disabled:opacity-100"
                    : "inline-flex h-11 min-w-[100px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#c9ff3d] px-3.5 text-[13px] font-semibold text-[#0b0b0c] transition-colors hover:bg-[#d6ff62] active:bg-[#bdf22e] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9ff3d]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141416]"
                }
              >
                {isFollowed ? (
                  <Check className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
                ) : (
                  <UserPlus className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
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
