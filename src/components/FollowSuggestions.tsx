import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { InteractiveAvatar } from "@/components/ui/avatar";
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
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#c9ff3d]" />
          <h3 className="truncate font-display text-[14px] font-bold tracking-[-0.01em] text-zinc-100">
            {t("suggested_for_you")}
          </h3>
        </div>
        <span className="shrink-0 font-mono text-[10px] tabular-nums tracking-[0.12em] text-zinc-600">
          {String(data.length).padStart(2, "0")}
        </span>
      </div>

      <div className="divide-y divide-white/[0.045] px-2 py-1">
        {data.map((p: any) => {
          const initial = (p.display_name || p.username || "?").charAt(0).toUpperCase();
          const shared = (p.sharedInterests ?? []).slice(0, 2);
          return (
            <div
              key={p.id}
              className="group flex items-center gap-2.5 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.025]"
            >
              <InteractiveAvatar
                src={p.avatar_url}
                fallback={initial}
                size={36}
                userId={p.id}
                username={p.username}
                className="ring-1 ring-white/10"
              />
              <Link to="/u/$username" params={{ username: p.username }} className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-zinc-100">
                  {p.display_name || p.username}
                </p>
                <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px]">
                  <span className="truncate text-zinc-500">@{p.username}</span>
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
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-white/10 px-2.5 text-[11px] font-semibold text-zinc-300 transition-colors hover:border-[#c9ff3d]/40 hover:bg-[#c9ff3d]/10 hover:text-[#c9ff3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9ff3d]/60 disabled:opacity-40"
              >
                <Plus className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />
                Follow
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
