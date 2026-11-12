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
      aria-label={`${count} ${count === 1 ? "person is" : "people are"} live. Open live`}
      className={`live-chip ${variant === "video" ? "live-chip--video" : ""} ${className}`}
    >
      <span className="live-chip__signal" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="live-chip__label">Live</span>
      <span className="live-chip__faces" aria-hidden="true">
        {faces.map((person) => (
          <Avatar
            key={person.id}
            className="live-chip__avatar -ml-1.5 h-5 w-5 border-0 first:ml-0"
          >
            <AvatarImage src={person.avatarUrl ?? undefined} alt="" />
            <AvatarFallback className="bg-[#2c2d35] text-[8px] font-semibold text-[#f2efe6]">
              {initials(person)}
            </AvatarFallback>
          </Avatar>
        ))}
      </span>
      <span className="live-chip__count" aria-hidden="true">
        {count}
      </span>
    </button>
  );
}
