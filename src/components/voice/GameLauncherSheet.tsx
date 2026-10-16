import { useState, useRef, useEffect } from "react";
import { Gamepad2, Play, Pause, X, Maximize2, Minimize2, RotateCw, ExternalLink, Loader2, Zap } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";

type GameEntry = {
  id: string;
  name: string;
  icon: string;
  url: string;
  players: string;
  description: string;
  color: string;
  borderColor: string;
  category: "action" | "puzzle" | "party" | "strategy" | "creative";
};

type GameBotState = {
  activeGame: GameEntry | null;
  isPlaying: boolean;
  isPaused: boolean;
  isFullscreen: boolean;
  launchedAt: number | null;
  launchedBy: string | null;
};

const GAME_LIBRARY: GameEntry[] = [
  // Strategy Games
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
  // Party Games
  {
    id: "codenames",
    name: "Codenames",
    icon: "🔤",
    url: "https://codenames.game/",
    players: "4-8",
    description: "Word-based team party game",
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
    description: "Drawing telephone game",
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
    description: "Party game collections",
    color: "from-violet-500/20 to-purple-500/20",
    borderColor: "border-violet-400/30",
    category: "party",
  },
  // Creative Games
  {
    id: "skribbl",
    name: "Skribbl.io",
    icon: "🎨",
    url: "https://skribbl.io/",
    players: "2-12",
    description: "Draw and guess with friends",
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
    description: "Native RIZZ drawing game",
    color: "from-lime-500/20 to-green-500/20",
    borderColor: "border-lime-400/30",
    category: "creative",
  },
  // Puzzle Games
  {
    id: "2048",
    name: "2048",
    icon: "🔢",
    url: "https://gabrielecirulli.github.io/2048/",
    players: "1",
    description: "Number puzzle game",
    color: "from-cyan-500/20 to-teal-500/20",
    borderColor: "border-cyan-400/30",
    category: "puzzle",
  },
  // Action Games
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

const CATEGORIES = [
  { id: "all", name: "All Games", icon: "🎮" },
  { id: "party", name: "Party", icon: "🎉" },
  { id: "strategy", name: "Strategy", icon: "♟️" },
  { id: "creative", name: "Creative", icon: "🎨" },
  { id: "puzzle", name: "Puzzle", icon: "🧩" },
  { id: "action", name: "Action", icon: "⚡" },
];

export function GameLauncherSheet({
  open,
  onOpenChange,
  channelId,
  realmId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
  realmId: string;
}) {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [gameBotState, setGameBotState] = useState<GameBotState>({
    activeGame: null,
    isPlaying: false,
    isPaused: false,
    isFullscreen: false,
    launchedAt: null,
    launchedBy: null,
  });
  const [loading, setLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Sync game bot state via realtime
  useEffect(() => {
    if (!open || !channelId || !user) return;

    const channel = supabase.channel(`vc-game-bot:${channelId}`);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "game-bot-state" }, ({ payload }) => {
        if (payload.userId === user.id) return; // Ignore own updates
        setGameBotState(payload.state);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [open, channelId, user]);

  const broadcastState = (state: GameBotState) => {
    if (!channelRef.current || !user) return;
    channelRef.current.send({
      type: "broadcast",
      event: "game-bot-state",
      payload: { userId: user.id, state },
    });
  };

  const launchGame = (game: GameEntry) => {
    setLoading(true);
    
    const newState: GameBotState = {
      activeGame: game,
      isPlaying: true,
      isPaused: false,
      isFullscreen: false,
      launchedAt: Date.now(),
      launchedBy: user!.id,
    };

    setGameBotState(newState);
    broadcastState(newState);
    
    setTimeout(() => {
      setLoading(false);
      toast.success(`Launched ${game.name} in GAME BOT`);
    }, 1500);
  };

  const pauseGame = () => {
    const newState: GameBotState = {
      ...gameBotState,
      isPaused: true,
      isPlaying: false,
    };
    setGameBotState(newState);
    broadcastState(newState);
    toast.success("Game paused");
  };

  const resumeGame = () => {
    const newState: GameBotState = {
      ...gameBotState,
      isPaused: false,
      isPlaying: true,
    };
    setGameBotState(newState);
    broadcastState(newState);
    toast.success("Game resumed");
  };

  const toggleFullscreen = () => {
    const newState: GameBotState = {
      ...gameBotState,
      isFullscreen: !gameBotState.isFullscreen,
    };
    setGameBotState(newState);
    broadcastState(newState);
  };

  const reloadGame = () => {
    if (iframeRef.current) {
      iframeRef.current.src = gameBotState.activeGame!.url;
      toast.success("Game reloaded");
    }
  };

  const stopGame = () => {
    const newState: GameBotState = {
      activeGame: null,
      isPlaying: false,
      isPaused: false,
      isFullscreen: false,
      launchedAt: null,
      launchedBy: null,
    };
    setGameBotState(newState);
    broadcastState(newState);
    toast.success("Game stopped");
  };

  const openInNewTab = () => {
    if (gameBotState.activeGame) {
      window.open(gameBotState.activeGame.url, "_blank", "noopener,noreferrer");
      toast.success("Opened in new tab");
    }
  };

  const filteredGames = GAME_LIBRARY.filter((game) => {
    const matchesCategory = selectedCategory === "all" || game.category === selectedCategory;
    const matchesSearch = game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         game.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="border-white/10 bg-[#0b0714] rounded-t-3xl max-h-[85dvh] overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
      >
        <SheetHeader className="text-left pt-2 pb-4">
          <SheetTitle className="font-display text-2xl flex items-center gap-2">
            <Gamepad2 className="h-6 w-6 text-primary" />
            Game Launcher
          </SheetTitle>
        </SheetHeader>

        {/* Active Game Display */}
        {gameBotState.activeGame && (
          <div className="mb-4 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.12] to-primary/[0.05] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`h-14 w-14 rounded-xl border ${gameBotState.activeGame.borderColor} bg-gradient-to-br ${gameBotState.activeGame.color} grid place-items-center text-3xl`}>
                  {gameBotState.activeGame.icon}
                </div>
                <div>
                  <p className="text-sm font-bold">{gameBotState.activeGame.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {gameBotState.isPaused ? "⏸ Paused" : gameBotState.isPlaying ? "▶ Playing" : "Stopped"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {!gameBotState.isPlaying && !gameBotState.isPaused ? (
                  <Button
                    size="icon"
                    onClick={resumeGame}
                    className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                ) : gameBotState.isPaused ? (
                  <Button
                    size="icon"
                    onClick={resumeGame}
                    className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    onClick={pauseGame}
                    className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90"
                  >
                    <Pause className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Game Controls */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={toggleFullscreen}
                className="flex-1 h-9 gap-2 border-white/10 bg-white/5"
              >
                {gameBotState.isFullscreen ? (
                  <><Minimize2 className="h-3.5 w-3.5" /> Exit Fullscreen</>
                ) : (
                  <><Maximize2 className="h-3.5 w-3.5" /> Fullscreen</>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={reloadGame}
                className="flex-1 h-9 gap-2 border-white/10 bg-white/5"
              >
                <RotateCw className="h-3.5 w-3.5" /> Reload
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={openInNewTab}
                className="flex-1 h-9 gap-2 border-white/10 bg-white/5"
              >
                <ExternalLink className="h-3.5 w-3.5" /> New Tab
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={stopGame}
                className="h-9 gap-2 border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
              >
                <X className="h-3.5 w-3.5" /> Stop
              </Button>
            </div>

            {/* Game Preview */}
            {gameBotState.isPlaying && !gameBotState.isPaused && (
              <div className="mt-3 rounded-xl overflow-hidden border border-white/10 bg-black/40">
                <div className="relative" style={{ paddingBottom: "56.25%" }}>
                  {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-xs text-muted-foreground">Loading game...</p>
                      </div>
                    </div>
                  ) : (
                    <iframe
                      ref={iframeRef}
                      src={gameBotState.activeGame.url}
                      className="absolute inset-0 w-full h-full"
                      allow="fullscreen; clipboard-write; autoplay"
                      sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                      title={gameBotState.activeGame.name}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-4">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search games..."
            className="h-11 glass border-white/10"
          />
        </div>

        {/* Category Tabs */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === category.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-white/5 hover:bg-white/10 text-muted-foreground"
              }`}
            >
              <span className="mr-1.5">{category.icon}</span>
              {category.name}
            </button>
          ))}
        </div>

        {/* Game Grid */}
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {filteredGames.length} Games Available
          </p>
          <div className="grid grid-cols-2 gap-3">
            {filteredGames.map((game) => (
              <button
                key={game.id}
                onClick={() => launchGame(game)}
                disabled={loading || gameBotState.activeGame?.id === game.id}
                className={`relative flex flex-col items-start gap-3 rounded-2xl border ${game.borderColor} bg-gradient-to-br ${game.color} p-4 transition-all hover:ring-2 hover:ring-primary/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-left`}
              >
                {gameBotState.activeGame?.id === game.id && (
                  <div className="absolute top-2 right-2">
                    <Zap className="h-4 w-4 text-primary fill-primary animate-pulse" />
                  </div>
                )}
                <span className="text-4xl">{game.icon}</span>
                <div>
                  <p className="text-sm font-bold mb-0.5">{game.name}</p>
                  <p className="text-[10px] text-muted-foreground mb-1">{game.players} players</p>
                  <p className="text-xs text-muted-foreground/80 line-clamp-2">{game.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
