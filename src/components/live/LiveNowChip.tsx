import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLiveAndVibing, type LivePerson } from "@/lib/live-and-vibing";

/**
 * The Live discovery chip.
 *
 * It only exists when a host is actually on air. Tapping it opens the
 * full-screen Live browser, where every live host is one tap away from their
 * audience viewer.
 *
 * `variant="video"` swaps the card surface for the over-video recipe so the
 * chip reads on top of a reel without a blur halo.
 */

export const OPEN_LIVE_STUDIO_EVENT = "rizz:open-live-studio";

type ChipVariant = "surface" | "video";

function initials(person: LivePerson) {
  return (person.username || person.name || "?").charAt(0).toUpperCase();
}

export function LiveNowChip({
  className = "",
  variant = "surface",
  onOpen,
}: {
  className?: string;
  variant?: ChipVariant;
  onOpen: () => void;
}) {
  const { data } = useLiveAndVibing();

  const hosts = useMemo(() => {
    const seen = new Map<string, LivePerson>();
    for (const stream of data.streams) seen.set(stream.host.id, stream.host);
    return [...seen.values()];
  }, [data.streams]);

  if (!hosts.length) return null;

  const count = hosts.length;
  const faces = hosts.slice(0, 3);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Live and vibing, ${count} ${count === 1 ? "person" : "people"}`}
      className={`live-chip ${variant === "video" ? "live-chip--video" : ""} ${className}`}
    >
      <span className="live-chip__dot" aria-hidden="true" />
      <span className="live-chip__label text-[12px] font-semibold leading-none">Live</span>
      <span className="live-chip__faces flex items-center pl-0.5" aria-hidden="true">
        {faces.map((person) => (
          <Avatar
            key={person.id}
            className={`-ml-1.5 h-5 w-5 border-0 ring-2 first:ml-0 ${
              variant === "video" ? "ring-black/60" : "ring-card"
            }`}
          >
            <AvatarImage src={person.avatarUrl ?? undefined} alt="" />
            <AvatarFallback className="bg-[#2c2d35] text-[8px] font-semibold text-[#f2efe6]">
              {initials(person)}
            </AvatarFallback>
          </Avatar>
        ))}
      </span>
      <span className="live-chip__count text-[12px] font-semibold leading-none">{count}</span>
    </button>
  );
}
