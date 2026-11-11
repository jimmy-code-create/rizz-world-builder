import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLiveAndVibing, type LivePerson } from "@/lib/live-and-vibing";

/**
 * The Live / Vibing discovery chip.
 *
 * It only exists when there is somebody to find: a live stream, a voice call,
 * a watch party, or a friend with something to say. Tapping it opens the
 * "Live & vibing" sheet, which is why the caller owns the open state (Reels
 * needs to pause the reel while the sheet is up).
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

  const { livePeople, vibingPeople } = useMemo(() => {
    const live = new Map<string, LivePerson>();
    for (const stream of data.streams) live.set(stream.host.id, stream.host);
    for (const group of data.voiceGroups) {
      for (const person of group.people) live.set(person.id, person);
    }
    return { livePeople: [...live.values()], vibingPeople: data.vibing };
  }, [data]);

  const living = livePeople.length > 0;
  const people = living ? livePeople : vibingPeople;
  if (!people.length) return null;

  const label = living ? "Live" : "Vibing";
  const count = people.length;
  const faces = people.slice(0, 3);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Live and vibing, ${count} ${count === 1 ? "person" : "people"}`}
      className={`live-chip ${variant === "video" ? "live-chip--video" : ""} ${className}`}
    >
      <span className="live-chip__dot" aria-hidden="true" />
      <span className="live-chip__label text-[12px] font-semibold leading-none">{label}</span>
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
