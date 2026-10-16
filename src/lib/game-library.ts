export type GameCategory = "action" | "puzzle" | "party" | "strategy" | "creative";

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

export const GAME_LIBRARY: GameEntry[] = [
  {
    id: "chess",
    name: "Chess",
    icon: "♟️",
    url: "https://lichess.org/",
    players: "2",
    description: "Classic chess — create a game and share the link with your opponent",
    color: "from-slate-500/20 to-gray-500/20",
    borderColor: "border-slate-400/30",
    category: "strategy",
  },
  {
    id: "checkers",
    name: "Checkers",
    icon: "🎯",
    url: "https://www.247checkers.com/",
    players: "2",
    description: "Classic checkers board game",
    color: "from-red-500/20 to-orange-500/20",
    borderColor: "border-red-400/30",
    category: "strategy",
  },
  {
    id: "codenames",
    name: "Codenames",
    icon: "🔤",
    url: "https://codenames.game/",
    players: "4-8",
    description: "Word-based team party game — create a room and share",
    color: "from-indigo-500/20 to-blue-500/20",
    borderColor: "border-indigo-400/30",
    category: "party",
  },
  {
    id: "gartic-phone",
    name: "Gartic Phone",
    icon: "📱",
    url: "https://garticphone.com/",
    players: "4-30",
    description: "Telephone game with drawing — create a room to play",
    color: "from-pink-500/20 to-rose-500/20",
    borderColor: "border-pink-400/30",
    category: "party",
  },
  {
    id: "jackbox",
    name: "Jackbox Party",
    icon: "🎉",
    url: "https://jackbox.tv/",
    players: "2-8",
    description: "Jackbox party packs — host reads the room code off their game",
    color: "from-violet-500/20 to-purple-500/20",
    borderColor: "border-violet-400/30",
    category: "party",
  },
  {
    id: "skribbl",
    name: "Skribbl.io",
    icon: "🎨",
    url: "https://skribbl.io/",
    players: "2-12",
    description: "Draw and guess together on skribbl.io",
    color: "from-yellow-500/20 to-amber-500/20",
    borderColor: "border-yellow-400/30",
    category: "creative",
  },
  {
    id: "draw-party",
    name: "Draw Party",
    icon: "🖌️",
    url: "/games/draw-party",
    players: "2-8",
    description: "Native RIZZ draw & guess — Classic, Speed & Sandbox modes",
    color: "from-lime-500/20 to-green-500/20",
    borderColor: "border-lime-400/30",
    category: "creative",
  },
  {
    id: "2048",
    name: "2048",
    icon: "🔢",
    url: "https://gabrielecirulli.github.io/2048/",
    players: "1",
    description: "Solo number puzzle while you hang out",
    color: "from-cyan-500/20 to-teal-500/20",
    borderColor: "border-cyan-400/30",
    category: "puzzle",
  },
  {
    id: "agar-io",
    name: "Agar.io",
    icon: "⚪",
    url: "https://agar.io/",
    players: "1+",
    description: "Eat dots, grow bigger",
    color: "from-emerald-500/20 to-green-500/20",
    borderColor: "border-emerald-400/30",
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
    id: "krunker",
    name: "Krunker.io",
    icon: "🎯",
    url: "https://krunker.io/",
    players: "1+",
    description: "Fast-paced FPS shooter",
    color: "from-orange-500/20 to-red-500/20",
    borderColor: "border-orange-400/30",
    category: "action",
  },
  {
    id: "shellshock",
    name: "Shell Shockers",
    icon: "🥚",
    url: "https://shellshock.io/",
    players: "1+",
    description: "Egg-based FPS game",
    color: "from-yellow-500/20 to-orange-500/20",
    borderColor: "border-yellow-400/30",
    category: "action",
  },
];

export const GAME_CATEGORIES: Array<{ id: "all" | GameCategory; name: string; icon: string }> = [
  { id: "all", name: "All Games", icon: "🎮" },
  { id: "party", name: "Party", icon: "🎉" },
  { id: "strategy", name: "Strategy", icon: "♟️" },
  { id: "creative", name: "Creative", icon: "🎨" },
  { id: "puzzle", name: "Puzzle", icon: "🧩" },
  { id: "action", name: "Action", icon: "⚡" },
];
