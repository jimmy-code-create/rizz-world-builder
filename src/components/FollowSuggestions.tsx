import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAvatarPalette } from "@/components/ui/avatar";
import { normalizeAvatarUrl } from "@/lib/default-avatars";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toast";

export function FollowSuggestions() {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();

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
        .slice(0, 5);
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
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data || data.length === 0) return null;

  return (
    <div
      data-focus-hide
      className="mb-4 overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#0e0e11] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#c9ff3d]" />
          <h3 className="truncate font-display text-[15px] font-bold tracking-[-0.01em] text-zinc-100">
            {t("suggested_for_you")}
          </h3>
        </div>
        <span className="shrink-0 font-mono text-[11px] tabular-nums tracking-[0.12em] text-zinc-500">
          {String(data.length).padStart(2, "0")}
        </span>
      </div>

      <div className="divide-y divide-white/[0.05]">
        {data.map((p: any) => {
          const initial = (p.display_name || p.username || "?").charAt(0).toUpperCase();
          const seed = p.username || p.display_name || p.id;
          const palette = getAvatarPalette(seed);
          const shared = (p.sharedInterests ?? []).slice(0, 2);
          return (
            <div
              key={p.id}
              className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.025]"
            >
              {/* Square avatar, as the panel has always drawn them: the initials
                  tile sits in the same 56px box as a photo so rows never jump. */}
              <span
                className="relative grid h-[52px] w-[52px] shrink-0 place-items-center overflow-hidden rounded-[15px] ring-1 ring-white/10"
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
                  <span className="text-[19px] font-semibold" style={{ color: palette.text }}>
                    {initial}
                  </span>
                )}
              </span>
              <Link to="/u/$username" params={{ username: p.username }} className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold leading-tight text-zinc-100">
                  {p.display_name || p.username}
                </p>
                <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[12px]">
                  <span className="shrink-0 text-zinc-500">@{p.username}</span>
                  {shared.length > 0 && (
                    <>
                      <span aria-hidden className="text-zinc-700">
                        ·
                      </span>
                      <span className="truncate text-[#c9ff3d]/70">{shared.join(" / ")}</span>
                    </>
                  )}
                </div>
              </Link>
              <button
                type="button"
                onClick={() => followMut.mutate(p.id)}
                disabled={followMut.isPending}
                aria-label={`Follow @${p.username}`}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-white/25 px-3.5 text-[12.5px] font-semibold text-zinc-100 transition-colors hover:border-[#c9ff3d]/50 hover:bg-[#c9ff3d]/10 hover:text-[#c9ff3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9ff3d]/60 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
                Follow
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
