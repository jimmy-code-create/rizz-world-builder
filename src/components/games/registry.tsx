import type { ComponentType } from "react";
import { BreakoutGame } from "@/components/games/breakout";
import { CheckersGame } from "@/components/games/checkers";
import { ChessGame } from "@/components/games/chess";
import { ConnectFourGame } from "@/components/games/connect-four";
import { MemoryMatchGame } from "@/components/games/memory-match";
import { MinesweeperGame } from "@/components/games/minesweeper";
import { NeonSnake } from "@/components/games/neon-snake";
import { PixelArena } from "@/components/games/pixel-arena";
import { PixelRally } from "@/components/games/pixel-rally";
import { ReactionRushGame } from "@/components/games/reaction-rush";
import { ReversiGame } from "@/components/games/reversi";
import { SpaceShooterGame } from "@/components/games/space-shooter";
import { SudokuGame } from "@/components/games/sudoku";
import { TicTacToeGame } from "@/components/games/tic-tac-toe";
import { Twenty48Game } from "@/components/games/twenty48";
import type { BuiltinGameId } from "@/lib/builtin-games";

export type BuiltinGameProps = {
  /** How many people are in the voice room — scales difficulty and bot count. */
  players?: number;
  /** True when the surface fills the screen, so in-game hints can hide. */
  fullscreen?: boolean;
};

/**
 * The one place a game id becomes a component. Keeping it separate from
 * `@/lib/builtin-games` means the registry metadata (used by the hub, the shell
 * and the realtime layer) never drags React components into a plain module.
 */
export const BUILTIN_COMPONENTS: Record<BuiltinGameId, ComponentType<BuiltinGameProps>> = {
  breakout: BreakoutGame,
  "neon-void": SpaceShooterGame,
  "reaction-rush": ReactionRushGame,
  chess: ChessGame,
  checkers: CheckersGame,
  "connect-four": ConnectFourGame,
  "tic-tac-toe": TicTacToeGame,
  reversi: ReversiGame,
  "2048": Twenty48Game,
  minesweeper: MinesweeperGame,
  sudoku: SudokuGame,
  "memory-match": MemoryMatchGame,
  "pixel-arena": PixelArena,
  "neon-snake": NeonSnake,
  "pixel-rally": PixelRally,
};

export function BuiltinSurface({
  id,
  players = 1,
  fullscreen = false,
}: {
  id: string;
  players?: number;
  fullscreen?: boolean;
}) {
  const Game = BUILTIN_COMPONENTS[id as BuiltinGameId];
  if (!Game) {
    return (
      <div className="grid h-full w-full place-items-center p-6 text-center text-sm text-muted-foreground">
        That game is not bundled in this build.
      </div>
    );
  }
  return <Game players={players} fullscreen={fullscreen} />;
}
