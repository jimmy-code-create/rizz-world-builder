export type GameCategory =
  | "action"
  | "open-world"
  | "two-player"
  | "party"
  | "creative"
  | "puzzle";

export type GameEntry = {
  id: string;
  name: string;
  /** Emoji used only if the real icon fails to load. */
  emoji: string;
  /** Real game icon (image URL). */
  icon: string;
  /** Real cover art shown on the card (image URL, may be empty). */
  cover: string;
  url: string;
  players: string;
  description: string;
  category: GameCategory;
};

export type GameBotState = {
  activeGame: GameEntry | null;
  isPlaying: boolean;
  isPaused: boolean;
  launchedAt: number | null;
  /** Host user id. Every user may host their own session. */
  launchedBy: string | null;
  hostName: string | null;
  sessionId: string | null;
  /** Optional room / team code the host copied from the game. */
  roomCode: string | null;
  /** Optional full invite link — viewers open it instead of the base game URL. */
  joinUrl: string | null;
};

export const GAME_BOT_CHANNEL = (channelId: string) => `vc-game-bot:${channelId}`;

/** Real site icon at a usable size (Google's favicon proxy keeps it honest). */
const fav = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

/**
 * Ready-made games only — every entry is a third-party game that is verified
 * to allow embedding (no X-Frame-Options / frame-ancestors), so it launches in
 * the RIZZ browser like a Discord activity. Games play inside a voice call:
 * GAME BOT hosts the session, the overlay shows it to everyone, and pause /
 * resume stay in sync.
 *
 * Icons and covers are the games' own artwork (og:image / touch icon / site
 * favicon), so the shelf looks like the real thing.
 */
export const GAME_LIBRARY: GameEntry[] = [
  // ── Action / shooters ────────────────────────────────────────────────────
  {
    id: "poxel-io",
    name: "Poxel.io",
    emoji: "🔫",
    icon: fav("poxel.io"),
    cover: "https://poxel.io/background-og.webp",
    url: "https://poxel.io/",
    players: "1+",
    description: "Blocky pixel FPS — drop into online battles instantly",
    category: "action",
  },
  {
    id: "krunker",
    name: "Krunker.io",
    emoji: "🎯",
    icon: fav("krunker.io"),
    cover: "https://assets.krunker.io/promo/og_1200x630.jpg",
    url: "https://krunker.io/",
    players: "1+",
    description: "High-speed multiplayer FPS with movement tricks",
    category: "action",
  },
  {
    id: "shellshock",
    name: "Shell Shockers",
    emoji: "🥚",
    icon: fav("shellshock.io"),
    cover: "https://www.shellshock.io/img/previewImage_shellShockers.webp",
    url: "https://shellshock.io/",
    players: "1+",
    description: "Egg FPS — scramble friends across 3D arenas",
    category: "action",
  },
  {
    id: "diep",
    name: "Diep.io",
    emoji: "💠",
    icon: fav("diep.io"),
    cover: "",
    url: "https://diep.io/",
    players: "1+",
    description: "Become a tank, smash shapes, rule the arena",
    category: "action",
  },
  {
    id: "zombs-royale",
    name: "Zombs Royale",
    emoji: "💣",
    icon: fav("zombsroyale.io"),
    cover: "",
    url: "https://zombsroyale.io/",
    players: "1+",
    description: "2D battle royale — drop in, loot up, survive",
    category: "action",
  },
  {
    id: "venge",
    name: "Venge.io",
    emoji: "🛡️",
    icon: fav("venge.io"),
    cover: "https://venge.io/thumbnail.jpg",
    url: "https://venge.io/",
    players: "1+",
    description: "FPS with abilities — dashes, turrets and fast rounds",
    category: "action",
  },
  {
    id: "ev-io",
    name: "Ev.io",
    emoji: "🤖",
    icon: fav("ev.io"),
    cover: "https://ev.io/themes/ev/images/ev-io-og-image.png",
    url: "https://ev.io/",
    players: "1+",
    description: "Halo-style FPS — wall-runs, double jumps, huge maps",
    category: "action",
  },
  {
    id: "kirka",
    name: "Kirka.io",
    emoji: "🐾",
    icon: fav("kirka.io"),
    cover: "",
    url: "https://kirka.io/",
    players: "1+",
    description: "Voxel FPS — blocky guns, custom skins, big maps",
    category: "action",
  },

  // ── Open world ───────────────────────────────────────────────────────────
  {
    id: "minecraft-classic",
    name: "Minecraft Classic",
    emoji: "⛏️",
    icon: fav("classic.minecraft.net"),
    cover: "",
    url: "https://classic.minecraft.net/",
    players: "1+",
    description: "The original voxel world — build anywhere, free",
    category: "open-world",
  },
  {
    id: "miniblox",
    name: "Miniblox",
    emoji: "🟫",
    icon: fav("miniblox.io"),
    cover: "https://miniblox.io/images/titlescreen/default.png",
    url: "https://miniblox.io/",
    players: "1+",
    description: "Minecraft-style sandbox — servers, cities, quests",
    category: "open-world",
  },
  {
    id: "bloxd",
    name: "Bloxd.io",
    emoji: "🧱",
    icon: fav("bloxd.io"),
    cover: "https://bloxd.io/textures/miscImages/bloxd_io_free_online_games.jpg",
    url: "https://bloxd.io/",
    players: "1+",
    description: "Open voxel worlds — parkour, PvP, survival, you build it",
    category: "open-world",
  },
  {
    id: "voxiom",
    name: "Voxiom.io",
    emoji: "🌋",
    icon: "https://voxiom.io/package/bda3e44e5e8a5d549cde.png",
    cover: "",
    url: "https://voxiom.io/",
    players: "1+",
    description: "Voxel FPS — mine, build and fight in open battle worlds",
    category: "open-world",
  },

  // ── 2 Player ─────────────────────────────────────────────────────────────
  {
    id: "chess",
    name: "Chess",
    emoji: "♟️",
    icon: fav("playpager.com"),
    cover: "",
    url: "https://playpager.com/embed/chess/index.html",
    players: "2",
    description: "Classic chess — play together on one board",
    category: "two-player",
  },
  {
    id: "checkers",
    name: "Checkers",
    emoji: "⚪",
    icon: fav("playpager.com"),
    cover: "",
    url: "https://playpager.com/embed/checkers/index.html",
    players: "2",
    description: "Classic checkers — jumps, kings, instant rematches",
    category: "two-player",
  },
  {
    id: "smash-karts",
    name: "Smash Karts",
    emoji: "🏎️",
    icon: "https://smashkarts.io/images/icon-144.png",
    cover: "https://smashkarts.io/images/icon-512.png",
    url: "https://smashkarts.io/",
    players: "2-6",
    description: "Kart battle arena — drive, drift, dodge rockets",
    category: "two-player",
  },
  {
    id: "basketball-stars",
    name: "Basketball Stars",
    emoji: "🏀",
    icon: fav("basketballstars.io"),
    cover: "",
    url: "https://basketballstars.io/",
    players: "2",
    description: "1v1 street hoops — dunks, blocks and three-pointers",
    category: "two-player",
  },
  {
    id: "8-ball",
    name: "8 Ball Pool",
    emoji: "🎱",
    icon: fav("crazygames.com"),
    cover:
      "https://imgs.crazygames.com/8-ball-billiards-classic_16x9/20231108025958/8-ball-billiards-classic_16x9-cover?metadata=none&quality=100&width=1200&height=630&fit=crop",
    url: "https://www.crazygames.com/embed/8-ball-billiards-classic",
    players: "2",
    description: "Classic billiards — call your shots, sink the 8",
    category: "two-player",
  },

  // ── Party ────────────────────────────────────────────────────────────────
  {
    id: "skribbl",
    name: "Skribbl.io",
    emoji: "🎨",
    icon: "https://skribbl.io/favicon.png",
    cover: "https://skribbl.io/img/thumbnail.png",
    url: "https://skribbl.io/",
    players: "2-12",
    description: "Draw and guess together — make a private room",
    category: "party",
  },
  {
    id: "gartic-phone",
    name: "Gartic Phone",
    emoji: "📱",
    icon: fav("garticphone.com"),
    cover: "https://garticphone.com/images/thumb.png",
    url: "https://garticphone.com/",
    players: "4-30",
    description: "The telephone game with drawings — chaos guaranteed",
    category: "party",
  },

  // ── Creative ─────────────────────────────────────────────────────────────
  {
    id: "pixelcanvas",
    name: "PixelCanvas",
    emoji: "🟩",
    icon: fav("pixelcanvas.io"),
    cover: "https://pixelcanvas.io/og/@0,9984,0.png",
    url: "https://pixelcanvas.io/",
    players: "1+",
    description: "Paint pixels on a shared infinite canvas",
    category: "creative",
  },
  {
    id: "pixelwar",
    name: "PixelWar",
    emoji: "🎇",
    icon: "https://pixelwar.io/public/apple-touch-icon.png",
    cover: "https://pixelwar.io/public/og-cover.png",
    url: "https://pixelwar.io/",
    players: "1+",
    description: "Team pixel battles on a live world canvas",
    category: "creative",
  },

  // ── Puzzle ───────────────────────────────────────────────────────────────
  {
    id: "2048",
    name: "2048",
    emoji: "🔢",
    icon: "https://gabrielecirulli.github.io/2048/meta/apple-touch-icon.png",
    cover: "https://gabrielecirulli.github.io/2048/meta/og_image.png",
    url: "https://gabrielecirulli.github.io/2048/",
    players: "1",
    description: "Merge tiles to 2048 — chain combos for the best score",
    category: "puzzle",
  },
];

export const GAME_CATEGORIES: Array<{ id: "all" | GameCategory; name: string; icon: string }> = [
  { id: "all", name: "All Games", icon: "🎮" },
  { id: "action", name: "Action", icon: "⚡" },
  { id: "open-world", name: "Open World", icon: "🌍" },
  { id: "two-player", name: "2 Player", icon: "⚔️" },
  { id: "party", name: "Party", icon: "🎉" },
  { id: "creative", name: "Creative", icon: "🎨" },
  { id: "puzzle", name: "Puzzle", icon: "🧩" },
];
