/**
 * The live room's settings live in `voice_rooms.topic`, which is already a
 * free-form text column. That keeps old rooms readable (no topic, or the old
 * literal "live", falls back to the defaults) and lets the studio ship without
 * a schema change. The prefix makes the value self-describing in the database.
 */
export const LIVE_TOPIC_PREFIX = "rizz-live:v1:";

export type LiveMode = "camera" | "screen" | "both";

/** A synthesized bed, not a track: no files to load and no licensing. */
export type LiveSoundBed = "off" | "night" | "soft" | "hype";

export type LiveChatScope = "everyone" | "stage";

export type LiveSettings = {
  /** What the host is sharing when the room opens. */
  mode: LiveMode;
  /** A quiet pad every viewer hears locally; each device plays its own copy. */
  soundBed: LiveSoundBed;
  /** Everyone can chat, or only the host and people brought on stage. */
  chatAudience: LiveChatScope;
  /** Whether the audience can ask to come on live. */
  requests: boolean;
  /** Start with the mic closed; the host opens it when they are ready. */
  startMuted: boolean;
};

export const LIVE_DEFAULT_SETTINGS: LiveSettings = {
  mode: "camera",
  soundBed: "off",
  chatAudience: "everyone",
  requests: true,
  startMuted: true,
};

export const LIVE_MODE_OPTIONS: ReadonlyArray<{
  id: LiveMode;
  label: string;
  blurb: string;
}> = [
  {
    id: "camera",
    label: "Camera live",
    blurb: "Face to face. Your camera stays off until you turn it on.",
  },
  {
    id: "screen",
    label: "Screen live",
    blurb: "Share a game, a watch party or your whole screen.",
  },
  {
    id: "both",
    label: "Camera + screen",
    blurb: "Show your face in a corner while the screen leads.",
  },
];

export const LIVE_SOUND_BEDS: ReadonlyArray<{
  id: LiveSoundBed;
  label: string;
  blurb: string;
}> = [
  { id: "off", label: "No bed", blurb: "Just the room." },
  { id: "night", label: "Night drive", blurb: "Slow, low and glossy." },
  { id: "soft", label: "Soft focus", blurb: "Warm and close." },
  { id: "hype", label: "Afterglow", blurb: "A little pulse for a party." },
];

const MODES = new Set<LiveMode>(LIVE_MODE_OPTIONS.map((option) => option.id));
const SOUND_BEDS = new Set<LiveSoundBed>(LIVE_SOUND_BEDS.map((option) => option.id));
const CHAT_SCOPES = new Set<LiveChatScope>(["everyone", "stage"]);

export function encodeLiveSettings(settings: LiveSettings): string {
  return `${LIVE_TOPIC_PREFIX}${JSON.stringify(settings)}`;
}

export function parseLiveSettings(topic: string | null | undefined): LiveSettings {
  if (!topic?.startsWith(LIVE_TOPIC_PREFIX)) return { ...LIVE_DEFAULT_SETTINGS };
  try {
    const raw = JSON.parse(topic.slice(LIVE_TOPIC_PREFIX.length)) as Partial<LiveSettings>;
    return {
      mode: raw.mode && MODES.has(raw.mode) ? raw.mode : LIVE_DEFAULT_SETTINGS.mode,
      soundBed:
        raw.soundBed && SOUND_BEDS.has(raw.soundBed)
          ? raw.soundBed
          : LIVE_DEFAULT_SETTINGS.soundBed,
      chatAudience:
        raw.chatAudience && CHAT_SCOPES.has(raw.chatAudience)
          ? raw.chatAudience
          : LIVE_DEFAULT_SETTINGS.chatAudience,
      requests:
        typeof raw.requests === "boolean" ? raw.requests : LIVE_DEFAULT_SETTINGS.requests,
      startMuted:
        typeof raw.startMuted === "boolean"
          ? raw.startMuted
          : LIVE_DEFAULT_SETTINGS.startMuted,
    };
  } catch {
    return { ...LIVE_DEFAULT_SETTINGS };
  }
}

export function liveModeLabel(mode: LiveMode): string {
  return LIVE_MODE_OPTIONS.find((option) => option.id === mode)?.label ?? "Camera live";
}

export function liveSoundBedLabel(bed: LiveSoundBed): string {
  return LIVE_SOUND_BEDS.find((option) => option.id === bed)?.label ?? "No bed";
}
