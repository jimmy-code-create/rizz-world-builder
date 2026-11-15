import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAvatarPalette } from "@/components/ui/avatar";
import { normalizeAvatarUrl } from "@/lib/default-avatars";
import { Check, Plus } from "lucide-react";
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
  interests: string[] | null;
  sharedInterests: string[];
};

/**
 * A quiet people row, not a wall of outlined cards.
 *
 * The old panel worked because it read like a list: one square avatar, the name,
 * one muted line for the handle and shared interests, and a compact Follow pill.
 * Keeping the lime for the shared interests and the followed state means the
 * section still belongs to RIZZ without turning every edge neon.
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
        .select("id, username, display_name, avatar_url, paw_balance, accent_color, interests")
        .not("id", "in", `(${excludeIds.join(",")})`)
        .order("paw_balance", { ascending: false })
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
        .sort((left, right) => right.interestScore - left.interestScore || right.paw_balance - left.paw_balance)
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
      className="mb-3 overflow-hidden rounded-[16px] border border-white/[0.06] bg-[#0b0b0c]"
    >
      <div className="flex items-center gap-2 px-3.5 py-3">
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#c9ff3d]" />
        <h3
          id="suggested-for-you-heading"
          className="min-w-0 flex-1 truncate font-display text-[14px] font-bold tracking-[-0.01em] text-zinc-100"
        >
          {t("suggested_for_you")}
        </h3>
        <span className="shrink-0 font-mono text-[10px] tabular-nums tracking-[0.12em] text-zinc-600">
          {String(data.length).padStart(2, "0")}
        </span>
      </div>

      <div className="divide-y divide-white/[0.05]">
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
              className="flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-white/[0.02]"
            >
              <Link
                to="/u/$username"
                params={{ username: p.username ?? "" }}
                className="flex min-w-0 flex-1 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9ff3d]/60"
              >
                {/* One square tile, drawn at the same size for a photo or a
                    palette initial, so a list of mixed avatars never jumps. */}
                <span
                  className="grid h-[46px] w-[46px] shrink-0 place-items-center overflow-hidden rounded-[13px] ring-1 ring-white/[0.08]"
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
                    <span className="text-[17px] font-semibold" style={{ color: palette.text }}>
                      {initial}
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold leading-tight text-zinc-100">
                    {p.display_name || p.username}
                  </span>
                  <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[11.5px] leading-none">
                    <span className="truncate text-zinc-500">@{p.username}</span>
                    {shared.length > 0 && (
                      <>
                        <span aria-hidden className="text-zinc-700">
                          ·
                        </span>
                        <span className="truncate text-[#c9ff3d]/65">{shared.join(" / ")}</span>
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
                    ? "inline-flex h-10 shrink-0 items-center gap-1 rounded-full border border-[#c9ff3d]/35 px-3 text-[12px] font-semibold text-[#c9ff3d] disabled:opacity-100"
                    : "inline-flex h-10 shrink-0 items-center gap-1 rounded-full border border-white/[0.16] px-3 text-[12px] font-semibold text-zinc-200 transition-colors hover:border-[#c9ff3d]/45 hover:bg-[#c9ff3d]/[0.06] hover:text-[#c9ff3d] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9ff3d]/60"
                }
              >
                {isFollowed ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
                ) : (
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
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
