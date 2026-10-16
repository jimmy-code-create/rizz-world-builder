import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Gamepad2, Users, Trophy, ExternalLink, Share2, Plus, Search as SearchIcon, Filter } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toast";

type Game = {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  url: string;
  players: string;
  category: string;
  featured?: boolean;
};

// Expanded game library with more games
const AVAILABLE_GAMES: Game[] = [
  // FPS & Action
  {
    id: "krunker",
    name: "Krunker.io",
    description: "Fast-paced 3D browser FPS game with multiple game modes",
    thumbnail: "https://krunker.io/img/krunker-icon.png",
    url: "https://krunker.io",
    players: "1-8",
    category: "FPS",
    featured: true,
  },
  {
    id: "shellshock",
    name: "Shell Shockers",
    description: "Multiplayer FPS egg shooter game",
    thumbnail: "https://shellshock.io/img/icon-192.png",
    url: "https://shellshock.io",
    players: "1-16",
    category: "FPS",
  },
  {
    id: "venge",
    name: "Venge.io",
    description: "Fast-paced multiplayer FPS with unique maps",
    thumbnail: "https://venge.io/favicon-96x96.png",
    url: "https://venge.io",
    players: "1-12",
    category: "FPS",
  },
  
  // Party & Drawing
  {
    id: "skribbl",
    name: "Skribbl.io",
    description: "Multiplayer drawing and guessing game",
    thumbnail: "https://skribbl.io/res/logo.gif",
    url: "https://skribbl.io",
    players: "2-12",
    category: "Party",
    featured: true,
  },
  {
    id: "gartic",
    name: "Gartic Phone",
    description: "Telephone game with drawings",
    thumbnail: "https://garticphone.com/images/logo.png",
    url: "https://garticphone.com",
    players: "4-30",
    category: "Party",
  },
  {
    id: "drawbattle",
    name: "Draw Battle",
    description: "Real-time drawing battle game",
    thumbnail: "https://drawbattle.io/img/icon-192.png",
    url: "https://drawbattle.io",
    players: "2-10",
    category: "Party",
  },
  
  // IO Games
  {
    id: "slither",
    name: "Slither.io",
    description: "Multiplayer snake game - eat to grow bigger",
    thumbnail: "https://slither.io/img/icon-192.png",
    url: "https://slither.io",
    players: "1-500",
    category: "Casual",
    featured: true,
  },
  {
    id: "agar",
    name: "Agar.io",
    description: "Eat cells to grow bigger in this classic .io game",
    thumbnail: "https://agar.io/img/icon-192.png",
    url: "https://agar.io",
    players: "1-200",
    category: "Casual",
  },
  {
    id: "diep",
    name: "Diep.io",
    description: "Tank shooter with upgrades and evolution",
    thumbnail: "https://diep.io/favicon.ico",
    url: "https://diep.io",
    players: "1-100",
    category: "Casual",
  },
  {
    id: "moomoo",
    name: "Moomoo.io",
    description: "Build and survive in this multiplayer game",
    thumbnail: "https://moomoo.io/img/favicon/favicon-96x96.png",
    url: "https://moomoo.io",
    players: "1-50",
    category: "Casual",
  },
  {
    id: "zombs",
    name: "Zombs.io",
    description: "Build base and fight zombies",
    thumbnail: "https://zombs.io/img/favicon/favicon-96x96.png",
    url: "https://zombs.io",
    players: "1-100",
    category: "Casual",
  },
  
  // Strategy & Board
  {
    id: "chess",
    name: "Chess",
    description: "Play chess online against players worldwide",
    thumbnail: "https://images.chesscomfiles.com/uploads/v1/images_users/tiny_mce/SamCopeland/phpmeXx6V.png",
    url: "https://www.chess.com/play/online",
    players: "2",
    category: "Strategy",
    featured: true,
  },
  {
    id: "checkers",
    name: "Checkers",
    description: "Classic checkers game online",
    thumbnail: "https://www.247checkers.org/images/icon-192.png",
    url: "https://www.247checkers.org",
    players: "2",
    category: "Strategy",
  },
  {
    id: "go",
    name: "Go (Baduk)",
    description: "Ancient strategy board game",
    thumbnail: "https://online-go.com/android-chrome-192x192.png",
    url: "https://online-go.com",
    players: "2",
    category: "Strategy",
  },
  
  // Puzzle
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
    id: "2048",
    name: "2048",
    description: "Slide and merge numbers to reach 2048",
    thumbnail: "https://play2048.co/favicon.ico",
    url: "https://play2048.co",
    players: "1",
    category: "Puzzle",
  },
  {
    id: "sudoku",
    name: "Sudoku",
    description: "Classic number puzzle game",
    thumbnail: "https://sudoku.com/favicon.ico",
    url: "https://sudoku.com",
    players: "1",
    category: "Puzzle",
  },
  
  // Racing & Sports
  {
    id: "drift",
    name: "Drift Hunters",
    description: "3D drifting racing game",
    thumbnail: "https://drifthunters.io/favicon.ico",
    url: "https://drifthunters.io",
    players: "1",
    category: "Racing",
  },
  {
    id: "basketball",
    name: "Basketball Stars",
    description: "Multiplayer basketball game",
    thumbnail: "https://basketballstars.io/favicon.ico",
    url: "https://basketballstars.io",
    players: "1-2",
    category: "Sports",
  },
  {
    id: "football",
    name: "Football Legends",
    description: "Fast-paced football game",
    thumbnail: "https://www.footballlegends.org/favicon.ico",
    url: "https://www.footballlegends.org",
    players: "1-2",
    category: "Sports",
  },
  
  // Card Games
  {
    id: "uno",
    name: "UNO Online",
    description: "Play the classic card game online",
    thumbnail: "https://playuno.online/favicon.ico",
    url: "https://playuno.online",
    players: "2-4",
    category: "Cards",
  },
  {
    id: "poker",
    name: "Poker",
    description: "Texas Hold'em poker online",
    thumbnail: "https://www.pokernow.club/favicon.ico",
    url: "https://www.pokernow.club",
    players: "2-10",
    category: "Cards",
  },
];

const CATEGORIES = ["All", "FPS", "Party", "Casual", "Strategy", "Puzzle", "Racing", "Sports", "Cards"];

export function GameLauncher({ 
  open, 
  onOpenChange,
  channelId 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  channelId?: string;
}) {
  const { user, profile } = useAuth();
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [activeSession, setActiveSession] = useState<any>(null);

  // Filter games
  const filteredGames = AVAILABLE_GAMES.filter((game) => {
    const matchesCategory = selectedCategory === "All" || game.category === selectedCategory;
    const matchesSearch = searchQuery === "" || 
      game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredGames = filteredGames.filter(g => g.featured);
  const otherGames = filteredGames.filter(g => !g.featured);

  // Sync game session with channel
  useEffect(() => {
    if (!channelId || !user) return;
    
    const channel = supabase.channel(`game:${channelId}`);
    
    // Subscribe to game updates
    channel.on("broadcast", { event: "game-update" }, ({ payload }) => {
      if (payload.userId === user.id) return; // Ignore own updates
      
      setActiveSession(payload);
      
      if (payload.gameId && !isPlaying) {
        const game = AVAILABLE_GAMES.find(g => g.id === payload.gameId);
        if (game) {
          toast(`${payload.userName} started playing ${game.name}!`, {
            action: {
              label: "Join",
              onClick: () => handlePlayGame(game),
            },
          });
        }
      }
    });
    
    channel.subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, user, isPlaying]);

  // Broadcast game session
  const broadcastGameUpdate = (game: Game | null) => {
    if (!channelId || !user) return;
    
    supabase.channel(`game:${channelId}`).send({
      type: "broadcast",
      event: "game-update",
      payload: {
        userId: user.id,
        userName: profile?.display_name || profile?.username || user.email || "Player",
        gameId: game?.id || null,
        gameName: game?.name || null,
        timestamp: Date.now(),
      },
    });
  };

  const handlePlayGame = (game: Game) => {
    setSelectedGame(game);
    setIsPlaying(true);
    broadcastGameUpdate(game);
  };

  const handleBackToList = () => {
    setIsPlaying(false);
    setSelectedGame(null);
    broadcastGameUpdate(null);
  };

  const shareGameInvite = async () => {
    if (!selectedGame || !user) return;
    
    const inviteText = `🎮 Join me in ${selectedGame.name}! Click to play together.`;
    
    try {
      await navigator.clipboard.writeText(inviteText);
      toast.success("Game invite copied to clipboard!");
    } catch (e) {
      toast.error("Failed to copy invite");
    }
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
                {isPlaying && selectedGame ? selectedGame.name : channelId ? "Shared Games" : "Game Activities"}
              </SheetTitle>
            </div>
            <div className="flex items-center gap-2">
              {isPlaying ? (
                <>
                  <button
                    onClick={shareGameInvite}
                    className="h-9 px-3 rounded-full hover:bg-white/10 text-sm font-medium transition-colors flex items-center gap-1.5"
                  >
                    <Share2 className="h-4 w-4" />
                    Invite
                  </button>
                  <button
                    onClick={handleBackToList}
                    className="h-9 px-3 rounded-full hover:bg-white/10 text-sm font-medium transition-colors"
                  >
                    Back
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowSearch(!showSearch)}
                  className="h-9 w-9 rounded-full hover:bg-white/10 grid place-items-center transition-colors"
                >
                  <SearchIcon className="h-5 w-5" />
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

          {/* Search Bar */}
          {showSearch && !isPlaying && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 pb-2"
            >
              <Input
                placeholder="Search games..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white/5 border-white/10"
              />
            </motion.div>
          )}

          {/* Category Filter */}
          {!isPlaying && (
            <div className="px-4 pb-2 overflow-x-auto no-scrollbar">
              <div className="flex gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                      selectedCategory === cat
                        ? "bg-primary text-primary-foreground"
                        : "bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

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
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
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
                {/* Active Session Banner */}
                {activeSession && activeSession.gameId && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 p-4 rounded-2xl bg-primary/10 border border-primary/20"
                  >
                    <div className="flex items-start gap-3">
                      <Users className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">Active Session</h3>
                        <p className="text-sm text-muted-foreground">
                          {activeSession.userName} is playing {activeSession.gameName}
                        </p>
                      </div>
                      <Button
                        onClick={() => {
                          const game = AVAILABLE_GAMES.find(g => g.id === activeSession.gameId);
                          if (game) handlePlayGame(game);
                        }}
                        size="sm"
                        className="bg-primary hover:bg-primary/90"
                      >
                        Join
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* Info Banner */}
                {!activeSession?.gameId && channelId && (
                  <div className="mb-6 p-4 rounded-2xl bg-primary/10 border border-primary/20">
                    <div className="flex items-start gap-3">
                      <Gamepad2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">Voice Activities</h3>
                        <p className="text-sm text-muted-foreground">
                          Play games together with friends in this channel. Start a game to invite others!
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Featured Games */}
                {featuredGames.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-primary" />
                      Featured Games
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {featuredGames.map((game) => (
                        <GameCard key={game.id} game={game} onPlay={handlePlayGame} />
                      ))}
                    </div>
                  </div>
                )}

                {/* All Games */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                    {featuredGames.length > 0 ? "More Games" : "All Games"} ({otherGames.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {otherGames.map((game) => (
                      <GameCard key={game.id} game={game} onPlay={handlePlayGame} />
                    ))}
                  </div>
                </div>

                {/* No Results */}
                {filteredGames.length === 0 && (
                  <div className="text-center py-12">
                    <Gamepad2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-muted-foreground">No games found matching your search.</p>
                  </div>
                )}

                {/* Coming Soon Section */}
                <div className="mt-8 p-6 rounded-2xl bg-surface-2 border border-white/10 text-center">
                  <Trophy className="h-12 w-12 mx-auto mb-3 text-primary/60" />
                  <h3 className="font-semibold mb-2">Want More Games?</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    We're constantly adding new games and features. Suggest your favorites!
                  </p>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Request a Game
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function GameCard({ game, onPlay }: { game: Game; onPlay: (game: Game) => void }) {
  return (
    <motion.button
      onClick={() => onPlay(game)}
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
          <span>{game.players}</span>
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
  );
}
