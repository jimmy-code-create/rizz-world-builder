/**
 * Games that ship *inside* RIZZ.
 *
 * Everything here runs in the app's own page — canvas, no iframe, no account,
 * no lobby, no install. That is what makes "tap and you are playing" possible:
 * an external .io site can refuse to be framed and needs its own sign-up, while
 * a first-party game starts the moment it mounts and survives being drawn as a
 * layer behind the voice controls.
 *
 * Art direction is per-game (each game owns an accent), but the metadata drives
 * every surface: the hub cards, the activity shelf, the in-call overlay chrome.
 */
export type BuiltinGameId =
  | "pixel-arena"
  | "neon-snake"
  | "pixel-rally"
  | "breakout"
  | "neon-void"
  | "reaction-rush"
  | "chess"
  | "checkers"
  | "connect-four"
  | "tic-tac-toe"
  | "reversi"
  | "2048"
  | "minesweeper"
  | "sudoku"
  | "memory-match";

export type BuiltinGame = {
  id: BuiltinGameId;
  name: string;
  icon: string;
  /** One line for a card. */
  tagline: string;
  /** Shorter badge line: what you actually do. */
  hook: string;
  players: string;
  category: "arcade" | "party" | "solo" | "board" | "puzzle";
  /** Flat accent for card art, HUD chips and canvas art. */
  accent: string;
  controls: { keys: string; touch: string };
  howTo: string[];
  /** Everything below is met by every entry; kept per-game so a card can list it. */
  instant: true;
};

export const BUILTIN_GAMES: BuiltinGame[] = [
  {
    id: "pixel-arena",
    name: "Pixel Arena",
    icon: ":cat_hype:",
    tagline: "Grow the biggest blob in a pixel .io arena.",
    hook: "Eat pixels, dodge giants, top the board",
    players: "1 + bots",
    category: "arcade",
    accent: "#c9ff3d",
    controls: { keys: "WASD / arrows / move the mouse", touch: "Drag anywhere to steer" },
    howTo: [
      "Steer with your mouse, WASD or a finger drag.",
      "Small dots make you bigger. Bigger blobs eat smaller ones.",
      "Get eaten and you respawn instantly — your best run stays on screen.",
    ],
    instant: true,
  },
  {
    id: "neon-snake",
    name: "Neon Snake",
    icon: ":cat_cool:",
    tagline: "Classic snake with rival snakes and no walls to hide behind.",
    hook: "Last snake alive picks the next round",
    players: "1 + bots",
    category: "arcade",
    accent: "#5ad8ff",
    controls: { keys: "Arrows / WASD to turn", touch: "Swipe to turn" },
    howTo: [
      "Eat the pulsing food to grow a segment.",
      "Walls and every snake body are lethal — including your own tail.",
      "The arena speeds up as the round goes on. Survive it.",
    ],
    instant: true,
  },
  {
    id: "breakout",
    name: "Breakout",
    icon: ":cat_gg:",
    tagline: "Smash every brick without dropping the ball.",
    hook: "Edge hits angle the ball — never the middle",
    players: "1",
    category: "arcade",
    accent: "#b6f36b",
    controls: { keys: "Arrows / A · D · tap to launch", touch: "Drag anywhere to steer" },
    howTo: [
      "Drag (or use the arrow keys) to slide the paddle.",
      "Where you hit decides the angle: edges throw the ball wide.",
      "Clear the wall to advance — you have three balls.",
    ],
    instant: true,
  },
  {
    id: "neon-void",
    name: "Neon Void",
    icon: ":cat_sus:",
    tagline: "A vertical shooter with waves that never stop coming.",
    hook: "Hold to fire · waves speed up on score",
    players: "1",
    category: "arcade",
    accent: "#5ad8ff",
    controls: { keys: "Drag / arrows to fly · space to fire", touch: "Drag to fly, hold to fire" },
    howTo: [
      "Drag anywhere to fly the ship; holding fires automatically.",
      "Every 120 points starts a faster, denser wave.",
      "Pink enemies take two hits. Three lives, then it is over.",
    ],
    instant: true,
  },
  {
    id: "reaction-rush",
    name: "Reaction Rush",
    icon: ":cat_wow:",
    tagline: "Thirty seconds, one lit tile, fastest taps win.",
    hook: "Streaks multiply — but so does the pressure",
    players: "1+",
    category: "arcade",
    accent: "#ffb347",
    controls: { keys: "Just tap", touch: "Tap the lit tile" },
    howTo: [
      "A tile lights up — tap it before it times out.",
      "Faster taps score more, and streaks add a bonus.",
      "Ignore a tile or tap a dark one and the streak resets.",
    ],
    instant: true,
  },
  {
    id: "chess",
    name: "Chess",
    icon: ":cat_think:",
    tagline: "Full-rules chess against a real search engine.",
    hook: "Castling, en passant and promotion all work",
    players: "1",
    category: "board",
    accent: "#f4f1e7",
    controls: { keys: "Tap a piece, then a highlighted square", touch: "Tap to move" },
    howTo: [
      "You play White: tap a piece, then one of its highlighted squares.",
      "Every rule is implemented — castling, en passant, promotion, checkmate.",
      "The engine searches three plies, so think a move ahead of it.",
    ],
    instant: true,
  },
  {
    id: "checkers",
    name: "Checkers",
    icon: ":cat_lol:",
    tagline: "American draughts against a chain-hunting computer.",
    hook: "Captures are mandatory — longest chain wins",
    players: "1",
    category: "board",
    accent: "#ff8fab",
    controls: { keys: "Tap a red piece, then its landing square", touch: "Tap to move" },
    howTo: [
      "Men move forward one diagonal; kings move both ways.",
      "If a capture exists you must take it, and you must take the most.",
      "Reach the far rank to crown a king.",
    ],
    instant: true,
  },
  {
    id: "connect-four",
    name: "Connect Four",
    icon: ":cat_cool:",
    tagline: "Drop discs and connect four before the engine does.",
    hook: "Engine wins when it can and blocks when it must",
    players: "1",
    category: "board",
    accent: "#c9ff3d",
    controls: { keys: "Tap a column", touch: "Tap a column" },
    howTo: [
      "Tap a column to drop your disc into the lowest free slot.",
      "The engine searches four plies and always takes a win it can see.",
      "Own the centre column — most threats run through it.",
    ],
    instant: true,
  },
  {
    id: "tic-tac-toe",
    name: "Tic-Tac-Toe",
    icon: ":cat_wave:",
    tagline: "Three in a row — against an opponent that cannot lose.",
    hook: "Perfect play, so a draw is the real win",
    players: "1-2",
    category: "board",
    accent: "#7dd3fc",
    controls: { keys: "Tap a square", touch: "Tap a square" },
    howTo: [
      "Tap a square; the engine replies instantly from a full game tree.",
      "It never blunders — a draw is the best available result.",
      "Switch sides any time to see it from the other seat.",
    ],
    instant: true,
  },
  {
    id: "reversi",
    name: "Reversi",
    icon: ":cat_love:",
    tagline: "Sandwich discs, own the corners, flip the board.",
    hook: "Corners can never be flipped — aim for them",
    players: "1",
    category: "board",
    accent: "#b6f36b",
    controls: { keys: "Tap a highlighted square", touch: "Tap to place" },
    howTo: [
      "Legal squares are dotted: placing there flips every disc you sandwich.",
      "Passes happen automatically when you have no legal move.",
      "Corners are permanent — they decide the game.",
    ],
    instant: true,
  },
  {
    id: "2048",
    name: "2048",
    icon: ":cat_hype:",
    tagline: "Slide, merge, repeat — reach the 2048 tile.",
    hook: "Arrows or a swipe, tiles merge once per slide",
    players: "1",
    category: "puzzle",
    accent: "#ffb347",
    controls: { keys: "Arrows / WASD", touch: "Swipe the board" },
    howTo: [
      "Swipe or use the arrows; equal tiles merge into their sum.",
      "A merged tile cannot merge again in the same slide.",
      "Keep the biggest tile in a corner and the board never locks.",
    ],
    instant: true,
  },
  {
    id: "minesweeper",
    name: "Minesweeper",
    icon: ":cat_gg:",
    tagline: "Three sizes of minefield, first click always safe.",
    hook: "Flag mode for touch, right-click on desktop",
    players: "1",
    category: "puzzle",
    accent: "#ff5d5d",
    controls: {
      keys: "Tap to open · right-click to flag",
      touch: "Tap to open, flag mode to mark",
    },
    howTo: [
      "The numbers count mines in the eight surrounding cells.",
      "An empty cell opens its whole neighbourhood at once.",
      "Your first tap is never a mine — the board is placed around it.",
    ],
    instant: true,
  },
  {
    id: "sudoku",
    name: "Sudoku",
    icon: ":cat_music:",
    tagline: "Generated puzzles with exactly one solution.",
    hook: "Unique-solution puzzles, plus a hint when stuck",
    players: "1",
    category: "puzzle",
    accent: "#5ad8ff",
    controls: { keys: "Tap a cell, then a number", touch: "Cell then number pad" },
    howTo: [
      "Every row, column and 3×3 box needs 1-9 exactly once.",
      "Puzzles are dug from a solved grid and kept only with one solution.",
      "Clashing cells turn red; Hint fills the next certain cell.",
    ],
    instant: true,
  },
  {
    id: "memory-match",
    name: "Memory Match",
    icon: ":cat_sleep:",
    tagline: "Find the cat-emoji pairs before your memory gives out.",
    hook: "6, 8 or 12 pairs of the app's own cats",
    players: "1+",
    category: "puzzle",
    accent: "#ff6b9d",
    controls: { keys: "Tap two cards", touch: "Tap two cards" },
    howTo: [
      "Flip two cards a turn; matching pairs stay face up.",
      "Six pairs is a warm-up, twelve is the full cat set.",
      "Moves and time are both tracked, so racing a friend is easy.",
    ],
    instant: true,
  },
  {
    id: "pixel-rally",
    name: "Pixel Rally",
    icon: ":cat_gg:",
    tagline: "Two paddles, one ball, first to seven.",
    hook: "Solo vs CPU or two players on one screen",
    players: "1-2",
    category: "party",
    accent: "#ffb347",
    controls: { keys: "Drag / arrows · P2 uses A + D", touch: "Drag your half of the screen" },
    howTo: [
      "Drag on your half to move your paddle.",
      "Two-player mode: the bottom player drags (or uses the arrow keys), the top player uses A and D.",
      "The ball speeds up with every hit — first to 7 points wins.",
    ],
    instant: true,
  },
];

export function getBuiltinGame(id: string): BuiltinGame | null {
  return BUILTIN_GAMES.find((game) => game.id === id) ?? null;
}

export function isBuiltinGameId(id: string): boolean {
  return BUILTIN_GAMES.some((game) => game.id === id);
}
