export type GameCategory = "action" | "two-player" | "party" | "creative" | "puzzle";

export type GameEntry = {
  id: string;
  name: string;
  icon: string;
  url: string;
  players: string;
  description: string;
  color: string;
  borderColor: string;
  category: GameCategory;
};

export type GameBotState = {
  activeGame: GameEntry | null;
  isPlaying: boolean;
  isPaused: boolean;
  launchedAt: number | null;
  launchedBy: string | null;
};

export const GAME_BOT_CHANNEL = (channelId: string) => `vc-game-bot:${channelId}`;

/**
 * Ready-made games only — every entry is a third-party game that is verified
 * to allow embedding (no X-Frame-Options / frame-ancestors), so they launch in
 * the RIZZ browser like a Discord activity. CrazyGames `/embed/` titles and
 * PlayPager `/embed/` boards are officially embeddable; the bare .io domains
 * listed here were header-checked too.
 */
export const GAME_LIBRARY: GameEntry[] = [
  // Action / shooters
  {
    id: "poxel-io",
    name: "Poxel.io",
    icon: "🔫",
    url: "https://www.crazygames.com/embed/poxel-io",
    players: "1+",
    description: "Fast-paced online FPS with blocky pixel battles",
    color: "from-orange-500/20 to-red-500/20",
    borderColor: "border-orange-400/30",
    category: "action",
  },
  {
    id: "krunker",
    name: "Krunker.io",
    icon: "🎯",
    url: "https://krunker.io/",
    players: "1+",
    description: "Fast-paced multiplayer FPS shooter",
    color: "from-amber-500/20 to-orange-500/20",
    borderColor: "border-amber-400/30",
    category: "action",
  },
  {
    id: "shellshock",
    name: "Shell Shockers",
    icon: "🥚",
    url: "https://shellshock.io/",
    players: "1+",
    description: "Egg-based multiplayer FPS",
    color: "from-yellow-500/20 to-orange-500/20",
    borderColor: "border-yellow-400/30",
    category: "action",
  },
  {
    id: "slither-io",
    name: "Slither.io",
    icon: "🐍",
    url: "https://slither.io/",
    players: "1+",
    description: "Snake battle royale",
    color: "from-green-500/20 to-lime-500/20",
    borderColor: "border-green-400/30",
    category: "action",
  },
  {
    id: "ovo",
    name: "OvO",
    icon: "🏃",
    url: "https://www.crazygames.com/embed/ovo",
    players: "1",
    description: "Parkour platformer with slick wall jumps",
    color: "from-sky-500/20 to-blue-500/20",
    borderColor: "border-sky-400/30",
    category: "action",
  },

  // 2-player head-to-head
  {
    id: "chess",
    name: "Chess",
    icon: "♟️",
    url: "https://playpager.com/embed/chess/index.html",
    players: "2",
    description: "Classic chess board — play together on one board",
    color: "from-slate-500/20 to-gray-500/20",
    borderColor: "border-slate-400/30",
    category: "two-player",
  },
  {
    id: "checkers",
    name: "Checkers",
    icon: "⚪",
    url: "https://playpager.com/embed/checkers/index.html",
    players: "2",
    description: "Classic checkers board game",
    color: "from-red-500/20 to-orange-500/20",
    borderColor: "border-red-400/30",
    category: "two-player",
  },
  {
    id: "smash-karts",
    name: "Smash Karts",
    icon: "🏎️",
    url: "https://www.crazygames.com/embed/smash-karts",
    players: "2-6",
    description: "Kart battle arena — race and shoot together",
    color: "from-violet-500/20 to-purple-500/20",
    borderColor: "border-violet-400/30",
    category: "two-player",
  },
  {
    id: "basketball-stars",
    name: "Basketball Stars",
    icon: "🏀",
    url: "https://www.crazygames.com/embed/basketball-stars",
    players: "2",
    description: "1v1 street basketball with trick shots",
    color: "from-orange-500/20 to-amber-500/20",
    borderColor: "border-orange-400/30",
    category: "two-player",
  },
  {
    id: "8-ball-pool",
    name: "8 Ball Pool",
    icon: "🎱",
    url: "https://www.crazygames.com/embed/8-ball-billiards-classic",
    players: "2",
    description: "Classic billiards — take turns sinking shots",
    color: "from-emerald-500/20 to-teal-500/20",
    borderColor: "border-emerald-400/30",
    category: "two-player",
  },

  // Party
  {
    id: "skribbl",
    name: "Skribbl.io",
    icon: "🎨",
    url: "https://skribbl.io/",
    players: "2-12",
    description: "Draw and guess together — create a private room",
    color: "from-yellow-500/20 to-amber-500/20",
    borderColor: "border-yellow-400/30",
    category: "party",
  },
  {
    id: "gartic-phone",
    name: "Gartic Phone",
    icon: "📱",
    url: "https://garticphone.com/",
    players: "4-30",
    description: "Drawing telephone game — create a room to play",
    color: "from-pink-500/20 to-rose-500/20",
    borderColor: "border-pink-400/30",
    category: "party",
  },

  // Creative / pixel
  {
    id: "pixelcanvas",
    name: "PixelCanvas",
    icon: "🟩",
    url: "https://pixelcanvas.io/",
    players: "1+",
    description: "Place pixels on a shared infinite canvas with everyone online",
    color: "from-lime-500/20 to-green-500/20",
    borderColor: "border-lime-400/30",
    category: "creative",
  },
  {
    id: "pixelwar",
    name: "PixelWar",
    icon: "🎇",
    url: "https://pixelwar.io/",
    players: "1+",
    description: "Team pixel-art battles on a live canvas",
    color: "from-fuchsia-500/20 to-pink-500/20",
    borderColor: "border-fuchsia-400/30",
    category: "creative",
  },
  {
    id: "miniblox",
    name: "Miniblox",
    icon: "🟫",
    url: "https://www.crazygames.com/embed/miniblox",
    players: "1+",
    description: "Minecraft-style sandbox — build and explore together",
    color: "from-emerald-500/20 to-green-500/20",
    borderColor: "border-emerald-400/30",
    category: "creative",
  },

  // Puzzle
  {
    id: "2048",
    name: "2048",
    icon: "🔢",
    url: "https://gabrielecirulli.github.io/2048/",
    players: "1",
    description: "Merge the tiles — solo number puzzle",
    color: "from-cyan-500/20 to-teal-500/20",
    borderColor: "border-cyan-400/30",
    category: "puzzle",
  },
];

export const GAME_CATEGORIES: Array<{ id: "all" | GameCategory; name: string; icon: string }> = [
  { id: "all", name: "All Games", icon: "🎮" },
  { id: "action", name: "Action", icon: "⚡" },
  { id: "two-player", name: "2 Player", icon: "⚔️" },
  { id: "party", name: "Party", icon: "🎉" },
  { id: "creative", name: "Creative", icon: "🎨" },
  { id: "puzzle", name: "Puzzle", icon: "🧩" },
];
