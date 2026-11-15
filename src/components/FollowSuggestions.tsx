import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAvatarPalette } from "@/components/ui/avatar";
import { normalizeAvatarUrl } from "@/lib/default-avatars";
import { ArrowLeft, ArrowRight, Check, Plus } from "lucide-react";
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

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function FollowSuggestions() {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const rail = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

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
        .slice(0, 8) as Suggestion[];
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

  // The arrows only exist when there is somewhere to go: both ends disable.
  const measure = useCallback(() => {
    const node = rail.current;
    if (!node) return;
    setEdges({
      left: node.scrollLeft > 4,
      right: node.scrollLeft + node.clientWidth < node.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    measure();
    const node = rail.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [measure, data?.length]);

  const nudge = (direction: -1 | 1) => {
    const node = rail.current;
    if (!node) return;
    const card = node.querySelector<HTMLElement>("[data-suggestion-card]");
    const step = card ? card.offsetWidth + 12 : node.clientWidth * 0.8;
    node.scrollBy({
      left: direction * step,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  if (!data || data.length === 0) return null;

  return (
    <section
      data-focus-hide
      aria-labelledby="suggested-for-you-heading"
      className="mb-4 overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#0e0e11] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#c9ff3d]" />
          <h3
            id="suggested-for-you-heading"
            className="truncate font-display text-[15px] font-bold tracking-[-0.01em] text-zinc-100"
          >
            {t("suggested_for_you")}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="mr-1 font-mono text-[11px] tabular-nums tracking-[0.12em] text-zinc-500">
            {String(data.length).padStart(2, "0")}
          </span>
          <button
            type="button"
            onClick={() => nudge(-1)}
            disabled={!edges.left}
            aria-label="Previous suggestions"
            className="grid h-11 w-11 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-100 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9ff3d]/60"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => nudge(1)}
            disabled={!edges.right}
            aria-label="More suggestions"
            className="grid h-11 w-11 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-100 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9ff3d]/60"
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        ref={rail}
        onScroll={measure}
        role="list"
        aria-label={t("suggested_for_you")}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {data.map((p) => {
          const initial = (p.display_name || p.username || "?").charAt(0).toUpperCase();
          const seed = p.username || p.display_name || p.id;
          const palette = getAvatarPalette(seed);
          const shared = p.sharedInterests.slice(0, 2);
          const following = followMut.isPending && followMut.variables === p.id;
          return (
            <article
              key={p.id}
              data-suggestion-card
              role="listitem"
              className="flex w-[172px] shrink-0 snap-start flex-col items-center gap-2 rounded-[14px] border border-white/[0.07] bg-white/[0.02] px-3 py-4"
            >
              <span
                className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full ring-1 ring-white/10"
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
                  <span className="text-[22px] font-semibold" style={{ color: palette.text }}>
                    {initial}
                  </span>
                )}
              </span>
              <Link
                to="/u/$username"
                params={{ username: p.username ?? "" }}
                className="w-full text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9ff3d]/60"
              >
                <p className="truncate text-[13.5px] font-semibold leading-tight text-zinc-100">
                  {p.display_name || p.username}
                </p>
                <p className="mt-0.5 truncate text-[11.5px] text-zinc-500">@{p.username}</p>
              </Link>
              <p className="line-clamp-1 h-[13px] w-full text-center text-[10.5px] text-[#c9ff3d]/70">
                {shared.length > 0 ? shared.join(" / ") : "\u00a0"}
              </p>
              <button
                type="button"
                onClick={() => followMut.mutate(p.id)}
                disabled={followMut.isPending}
                aria-label={`Follow @${p.username}`}
                className="mt-0.5 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full border border-white/25 px-3 text-[12.5px] font-semibold text-zinc-100 transition-colors hover:border-[#c9ff3d]/50 hover:bg-[#c9ff3d]/10 hover:text-[#c9ff3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9ff3d]/60 disabled:opacity-40"
              >
                {following ? (
                  <Check className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
                ) : (
                  <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
                )}
                {following ? "Following" : "Follow"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
