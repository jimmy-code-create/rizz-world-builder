import { useState } from "react";
import { motion } from "framer-motion";
import { X, Gamepad2, Users, Trophy, ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

type Game = {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  url: string;
  players: string;
  category: string;
};

// Available games - you can add more games here
const AVAILABLE_GAMES: Game[] = [
  {
    id: "krunker",
    name: "Krunker.io",
    description: "Fast-paced 3D browser FPS game",
    thumbnail: "https://krunker.io/img/krunker-icon.png",
    url: "https://krunker.io",
    players: "1-8",
    category: "FPS",
  },
  {
    id: "skribbl",
    name: "Skribbl.io",
    description: "Multiplayer drawing and guessing game",
    thumbnail: "https://skribbl.io/res/logo.gif",
    url: "https://skribbl.io",
    players: "2-12",
    category: "Party",
  },
  {
    id: "slither",
    name: "Slither.io",
    description: "Multiplayer snake game",
    thumbnail: "https://slither.io/img/icon-192.png",
    url: "https://slither.io",
    players: "1-500",
    category: "Casual",
  },
  {
    id: "agar",
    name: "Agar.io",
    description: "Eat cells to grow bigger",
    thumbnail: "https://agar.io/img/icon-192.png",
    url: "https://agar.io",
    players: "1-200",
    category: "Casual",
  },
  {
    id: "tetris",
    name: "Tetris",
    description: "Classic block puzzle game",
    thumbnail: "https://tetris.com/favicon.ico",
    url: "https://tetris.com/play-tetris",
    players: "1",
    category: "Puzzle",
  },
  {
    id: "chess",
    name: "Chess",
    description: "Play chess online",
    thumbnail: "https://images.chesscomfiles.com/uploads/v1/images_users/tiny_mce/SamCopeland/phpmeXx6V.png",
    url: "https://www.chess.com/play/online",
    players: "2",
    category: "Strategy",
  },
];

export function GameLauncher({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayGame = (game: Game) => {
    setSelectedGame(game);
    setIsPlaying(true);
  };

  const handleBackToList = () => {
    setIsPlaying(false);
    setSelectedGame(null);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[90dvh] max-h-[900px] bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1e] border-t border-white/10 p-0"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between space-y-0 shrink-0">
            <div className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 text-primary" />
              <SheetTitle className="text-lg font-display">
                {isPlaying && selectedGame ? selectedGame.name : "Game Activities"}
              </SheetTitle>
            </div>
            <div className="flex items-center gap-2">
              {isPlaying && (
                <button
                  onClick={handleBackToList}
                  className="h-9 px-3 rounded-full hover:bg-white/10 text-sm font-medium transition-colors"
                >
                  Back
                </button>
              )}
              <button
                onClick={() => onOpenChange(false)}
                className="h-9 w-9 rounded-full hover:bg-white/10 grid place-items-center transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </SheetHeader>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {isPlaying && selectedGame ? (
              <motion.div
                key="game-iframe"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full w-full"
              >
                <iframe
                  src={selectedGame.url}
                  className="w-full h-full border-0"
                  title={selectedGame.name}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </motion.div>
            ) : (
              <motion.div
                key="game-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full overflow-y-auto px-4 pb-4"
              >
                {/* Info Banner */}
                <div className="mb-6 p-4 rounded-2xl bg-primary/10 border border-primary/20">
                  <div className="flex items-start gap-3">
                    <Gamepad2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">Voice Activities</h3>
                      <p className="text-sm text-muted-foreground">
                        Play games together with friends in voice channels. Choose a game below to start!
                      </p>
                    </div>
                  </div>
                </div>

                {/* Game Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {AVAILABLE_GAMES.map((game) => (
                    <motion.button
                      key={game.id}
                      onClick={() => handlePlayGame(game)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="group relative overflow-hidden rounded-2xl bg-surface-2 border border-white/10 hover:border-primary/40 transition-all p-4 text-left"
                    >
                      {/* Game Thumbnail */}
                      <div className="flex items-start gap-4 mb-3">
                        <div className="h-16 w-16 rounded-xl bg-surface-3 overflow-hidden shrink-0 flex items-center justify-center">
                          <img
                            src={game.thumbnail}
                            alt={game.name}
                            className="h-12 w-12 object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                              (e.target as HTMLImageElement).parentElement!.innerHTML = `<div class="h-12 w-12 rounded-lg bg-primary/20 grid place-items-center"><span class="text-2xl">${game.name[0]}</span></div>`;
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                            {game.name}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {game.description}
                          </p>
                        </div>
                      </div>

                      {/* Game Info */}
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          <span>{game.players} players</span>
                        </div>
                        <div className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                          {game.category}
                        </div>
                      </div>

                      {/* Play Button Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center">
                        <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-lg">
                          <ExternalLink className="h-5 w-5" />
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>

                {/* Coming Soon Section */}
                <div className="mt-8 p-6 rounded-2xl bg-surface-2 border border-white/10 text-center">
                  <Trophy className="h-12 w-12 mx-auto mb-3 text-primary/60" />
                  <h3 className="font-semibold mb-2">More Games Coming Soon!</h3>
                  <p className="text-sm text-muted-foreground">
                    We're adding more multiplayer games and activities. Stay tuned!
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
