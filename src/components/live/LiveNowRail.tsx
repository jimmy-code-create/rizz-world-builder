/**
 * Live rooms are only useful if people can find them.
 *
 * This rail is the smallest honest discovery surface: one query against the
 * rooms the app already polls, no new table, and it renders nothing at all when
 * nobody is live. Tapping a card goes straight into the room route.
 *
 * Demo lives sit after the real ones (and keep the rail alive when nobody is on
 * air). They are local fixtures, never database rows, and open a local stage
 * instead of joining a call — see demo-lives.ts.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchLiveRooms } from "@/lib/voice";
import { UserAvatar } from "@/components/ui/avatar";
import { RizzLiveIcon } from "@/components/live/RizzLiveIcon";
import { DemoLiveStage } from "@/components/live/DemoLiveStage";
import { DEMO_LIVES, formatViewers, type DemoLive } from "@/components/live/demo-lives";

type LiveRoomRow = {
  id: string;
  title: string | null;
  is_live: boolean;
  host?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

export function LiveNowRail({ className = "" }: { className?: string }) {
  const [demo, setDemo] = useState<DemoLive | null>(null);

  const query = useQuery({
    queryKey: ["live-now-rail"],
    queryFn: fetchLiveRooms,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const rooms = ((query.data ?? []) as unknown as LiveRoomRow[]).filter((room) => room.is_live);
  if (!rooms.length && !DEMO_LIVES.length) return null;

  return (
    <section aria-label="Live now" className={`mb-3 ${className}`}>
      <div className="mb-2 flex items-center gap-1.5">
        <RizzLiveIcon className="h-4 w-4 text-primary" />
        <h2 className="font-display text-sm font-semibold text-foreground">Live now</h2>
        {rooms.length > 0 && (
          <span className="rounded-full border border-[#ff5d68]/30 bg-[#ff5d68]/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#ff5d68]">
            {rooms.length} on air
          </span>
        )}
        {DEMO_LIVES.length > 0 && (
          <span className="rounded-full border border-white/15 bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground">
            Demo
          </span>
        )}
      </div>
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {rooms.slice(0, 8).map((room) => (
          <Link
            key={room.id}
            to="/live/$roomId"
            params={{ roomId: room.id }}
            className="group flex min-h-[52px] w-[224px] shrink-0 items-center gap-2.5 rounded-xl border border-white/10 bg-card px-2.5 py-2 transition-colors hover:border-[#ff5d68]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            <span className="relative shrink-0">
              <UserAvatar
                src={room.host?.avatar_url ?? undefined}
                fallback={room.host?.display_name || room.host?.username || "Live"}
                size="sm"
              />
              <span
                aria-hidden="true"
                className="live-dot absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 ring-2 ring-card"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-foreground">
                {room.title || "Live room"}
              </span>
              <span className="block truncate text-[10px] text-muted-foreground">
                @{room.host?.username ?? "host"} is live
              </span>
            </span>
            <span className="shrink-0 rounded-md border border-[#ff5d68]/40 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-[#ff5d68]">
              Live
            </span>
          </Link>
        ))}

        {DEMO_LIVES.map((live) => (
          <button
            key={live.id}
            type="button"
            onClick={() => setDemo(live)}
            className="group flex min-h-[52px] w-[224px] shrink-0 items-center gap-2.5 rounded-xl border border-white/10 bg-card px-2.5 py-2 text-left transition-[border-color,transform] duration-150 hover:border-primary/40 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            <span
              aria-hidden="true"
              className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-[10px] text-[15px] ring-1 ring-white/15"
              style={{
                background: `radial-gradient(120% 120% at 30% 0%, ${live.stageTint}55, transparent 70%), #101014`,
              }}
            >
              {live.posterGlyph}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-foreground">
                {live.title}
              </span>
              <span className="block truncate text-[10px] text-muted-foreground">
                @{live.handle} · {live.gameLabel} · {formatViewers(live.viewers)} watching
              </span>
            </span>
            <span className="shrink-0 rounded-md border border-white/20 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-muted-foreground">
              Demo
            </span>
          </button>
        ))}
      </div>

      {demo && <DemoLiveStage live={demo} onClose={() => setDemo(null)} />}
    </section>
  );
}
