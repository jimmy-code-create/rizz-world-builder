import { useQuery } from "@tanstack/react-query";
import { fetchLiveRooms } from "@/lib/voice";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/**
 * A live room is only worth a chip when one exists. This is the compact
 * discovery surface for Feed and Reels; tapping it opens the same Live Studio
 * the old Live button opened.
 */

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

export const OPEN_LIVE_STUDIO_EVENT = "rizz:open-live-studio";

export function LiveNowChip({ className = "" }: { className?: string }) {
  const query = useQuery({
    queryKey: ["live-now-chip"],
    queryFn: fetchLiveRooms,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const rooms = ((query.data ?? []) as unknown as LiveRoomRow[]).filter((room) => room.is_live);
  if (!rooms.length) return null;

  const hosts = rooms.slice(0, 3).map((room) => room.host);

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_LIVE_STUDIO_EVENT))}
      aria-label={`${rooms.length} ${rooms.length === 1 ? "person is" : "people are"} live. Open live studio`}
      className={`live-chip ${className}`}
    >
      <span className="live-chip__dot" aria-hidden="true" />
      <span className="text-[12px] font-semibold leading-none text-foreground">Live</span>
      <span className="flex items-center pl-0.5" aria-hidden="true">
        {hosts.map((host, index) => (
          <Avatar
            key={`${host?.username ?? "host"}-${index}`}
            className="-ml-1.5 h-5 w-5 border-0 ring-2 ring-card first:ml-0"
          >
            <AvatarImage src={host?.avatar_url ?? undefined} alt="" />
            <AvatarFallback className="bg-[#2c2d35] text-[8px] font-semibold text-[#f2efe6]">
              {(host?.username ?? "?").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ))}
      </span>
      <span className="text-[12px] font-semibold leading-none text-muted-foreground" aria-hidden="true">
        {rooms.length}
      </span>
    </button>
  );
}
