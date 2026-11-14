/**
 * Demo lives.
 *
 * These are not database rooms and they never touch Supabase: they are a small,
 * fixed cast of personas "streaming" a game, so the live surfaces can be walked
 * through — the viewer stage, the screen-share frame, the chat — without waiting
 * for a real host to go on air. Everything is local, so a demo costs no
 * bandwidth and cannot be mistaken for a real broadcast: every card and the
 * stage itself carry a DEMO label.
 */

export type DemoGame = "minecraft" | "bgmi" | "gta";

export type DemoLive = {
  id: string;
  /** Persona. */
  name: string;
  handle: string;
  /** Two-letter tile shown when there is no picture. */
  initials: string;
  avatarTint: string;
  game: DemoGame;
  gameLabel: string;
  title: string;
  viewers: number;
  /** How long the persona has been on air, in seconds. */
  startedSecondsAgo: number;
  tags: string[];
  /** Lines the chat cycles through while the stage is open. */
  chat: { user: string; text: string; tint: string }[];
  /** Faint scan effect colour for the screen-share frame. */
  stageTint: string;
  posterGlyph: string;
};

export const DEMO_LIVES: DemoLive[] = [
  {
    id: "demo-minecraft",
    name: "Nova",
    handle: "nova.plays",
    initials: "N",
    avatarTint: "#4ade80",
    game: "minecraft",
    gameLabel: "Minecraft",
    title: "Building a floating island 🌴 — survival day 12",
    viewers: 214,
    startedSecondsAgo: 62 * 60 + 18,
    tags: ["minecraft", "build", "chill"],
    stageTint: "#33d17a",
    posterGlyph: "⛏",
    chat: [
      { user: "kayefande", text: "that island is insane 😭", tint: "#c9ff3d" },
      { user: "arjun.gg", text: "how many stacks of dirt is that", tint: "#8ab4ff" },
      { user: "mia", text: "the waterfall timing tho 🔥", tint: "#ff9ecb" },
      { user: "zed.gta", text: "drop the seed pls", tint: "#ffd166" },
      { user: "newaccount", text: "chat is moving fast lol", tint: "#9ae6b4" },
    ],
  },
  {
    id: "demo-bgmi",
    name: "Arjun",
    handle: "arjun.gg",
    initials: "A",
    avatarTint: "#ffd166",
    game: "bgmi",
    gameLabel: "BGMI",
    title: "Squad push to Conqueror — ranked grind, no mic rage",
    viewers: 486,
    startedSecondsAgo: 96 * 60 + 41,
    tags: ["bgmi", "ranked", "squad"],
    stageTint: "#ffb020",
    posterGlyph: "🎯",
    chat: [
      { user: "nova.plays", text: "third zone read was clean", tint: "#4ade80" },
      { user: "satan1", text: "how are you still alive there", tint: "#ff8a8a" },
      { user: "higan", text: "push push push", tint: "#a5b4fc" },
      { user: "rizz", text: "that spray control is not human", tint: "#c9ff3d" },
      { user: "mia", text: "GG go next", tint: "#ff9ecb" },
    ],
  },
  {
    id: "demo-gta",
    name: "Zed",
    handle: "zed.gta",
    initials: "Z",
    avatarTint: "#c084fc",
    game: "gta",
    gameLabel: "GTA V",
    title: "Cayo Perico heist, no deaths, one life run",
    viewers: 132,
    startedSecondsAgo: 27 * 60 + 5,
    tags: ["gta", "heist", "speedrun"],
    stageTint: "#a855f7",
    posterGlyph: "🚗",
    chat: [
      { user: "kayefande", text: "the stealth entry every time 😮‍💨", tint: "#c9ff3d" },
      { user: "arjun.gg", text: "you left the guard alive??", tint: "#ffd166" },
      { user: "mia", text: "timer stress is real", tint: "#ff9ecb" },
      { user: "nova.plays", text: "clean exit", tint: "#4ade80" },
      { user: "zed.gta", text: "one more run then I sleep", tint: "#c084fc" },
    ],
  },
];

/** mm:ss (or h:mm:ss once it passes an hour). */
export function formatLiveClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

export function formatViewers(count: number) {
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10_000 ? 0 : 1)}k`;
  return String(count);
}
