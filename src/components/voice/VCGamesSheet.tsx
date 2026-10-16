import { useState, useEffect, useRef } from "react";
import { Gamepad2, Trophy, X, Play, RotateCcw, Users, Bot as BotIcon, Crown, Zap, ExternalLink, ChevronLeft } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type GameType = "tictactoe" | "rps" | "wouldyourather" | "trivia";

type GameState = {
  type: GameType | null;
  active: boolean;
  hostId: string | null;
  players: string[];
  turn: string | null;
  board?: any;
  scores: Record<string, number>;
  winner: string | null;
  history: Array<{ game: string; winner: string; timestamp: number }>;
};

type ExternalGame = {
  id: string;
  name: string;
  icon: string;
  url: string;
  players: string;
  description: string;
  color: string;
  borderColor: string;
};

const MINI_GAMES = [
  {
    id: "tictactoe" as GameType,
    name: "Tic-Tac-Toe",
    icon: "⭕",
    emoji: "❌",
    minPlayers: 2,
    description: "Classic X's and O's",
    color: "from-blue-500/20 to-cyan-500/20",
    borderColor: "border-blue-400/30",
  },
  {
    id: "rps" as GameType,
    name: "Rock Paper Scissors",
    icon: "✊",
    emoji: "✋",
    minPlayers: 2,
    description: "Best of 3 rounds",
    color: "from-purple-500/20 to-pink-500/20",
    borderColor: "border-purple-400/30",
  },
  {
    id: "wouldyourather" as GameType,
    name: "Would You Rather",
    icon: "🤔",
    emoji: "💭",
    minPlayers: 2,
    description: "Tough choices ahead",
    color: "from-orange-500/20 to-yellow-500/20",
    borderColor: "border-orange-400/30",
  },
  {
    id: "trivia" as GameType,
    name: "Quick Trivia",
    icon: "🧠",
    emoji: "❓",
    minPlayers: 2,
    description: "Test your knowledge",
    color: "from-green-500/20 to-emerald-500/20",
    borderColor: "border-green-400/30",
  },
];

const EXTERNAL_GAMES: ExternalGame[] = [
  {
    id: "chess",
    name: "Chess",
    icon: "♟️",
    url: "https://lichess.org/",
    players: "2",
    description: "Play chess online — create a game and share the link",
    color: "from-slate-500/20 to-gray-500/20",
    borderColor: "border-slate-400/30",
  },
  {
    id: "checkers",
    name: "Checkers",
    icon: "🎯",
    url: "https://www.247checkers.com/",
    players: "2",
    description: "Classic checkers game",
    color: "from-red-500/20 to-orange-500/20",
    borderColor: "border-red-400/30",
  },
  {
    id: "codenames",
    name: "Codenames",
    icon: "🔤",
    url: "https://codenames.game/",
    players: "4-8",
    description: "Word-based party game — create a room and share",
    color: "from-indigo-500/20 to-blue-500/20",
    borderColor: "border-indigo-400/30",
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
  },
  {
    id: "skribbl",
    name: "Draw & Guess",
    icon: "🎨",
    url: "https://skribbl.io/",
    players: "2+",
    description: "Draw and guess together on skribbl.io",
    color: "from-yellow-500/20 to-amber-500/20",
    borderColor: "border-yellow-400/30",
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
  },
  {
    id: "jackbox",
    name: "Party Games",
    icon: "🎉",
    url: "https://jackbox.tv/",
    players: "2-8",
    description: "Jackbox party packs — host reads the room code off their game",
    color: "from-violet-500/20 to-purple-500/20",
    borderColor: "border-violet-400/30",
  },
  {
    id: "draw-party",
    name: "Draw Party",
    icon: "🖌️",
    url: "/embed/draw-party",
    players: "2-8",
    description: "Native draw & guess — Classic, Speed & Sandbox modes with live reactions",
    color: "from-lime-500/20 to-green-500/20",
    borderColor: "border-lime-400/30",
  },
];

export function VCGamesSheet({
  open,
  onOpenChange,
  channelId,
  participants,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
  participants: Array<{ user_id: string; user?: { username?: string; display_name?: string } }>;
}) {
  const { user } = useAuth();
  const [view, setView] = useState<"menu" | "mini-game">("menu");
  const [gameState, setGameState] = useState<GameState>({
    type: null,
    active: false,
    hostId: null,
    players: [],
    turn: null,
    scores: {},
    winner: null,
    history: [],
  });
  const [selectedGame, setSelectedGame] = useState<GameType | null>(null);
  const [tttBoard, setTttBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [rpsChoice, setRpsChoice] = useState<string | null>(null);
  const [rpsRound, setRpsRound] = useState(0);
  const [wyrQuestion, setWyrQuestion] = useState<{ a: string; b: string } | null>(null);
  const [triviaQuestion, setTriviaQuestion] = useState<{
    question: string;
    options: string[];
    correct: number;
  } | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const isHost = gameState.hostId === user?.id;
  const isPlaying = gameState.players.includes(user?.id || "");
  const myTurn = gameState.turn === user?.id;
  const canStart = participants.length >= 1;
  const otherPlayers = participants.filter((p) => p.user_id !== user?.id);

  // Sync game state via realtime
  useEffect(() => {
    if (!open || !channelId || !user) return;

    const channel = supabase.channel(`vc-game:${channelId}`);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "game-state" }, ({ payload }) => {
        setGameState(payload.state);
        // Sync specific game data
        if (payload.tttBoard) setTttBoard(payload.tttBoard);
        if (payload.wyr) setWyrQuestion(payload.wyr);
        if (payload.trivia) setTriviaQuestion(payload.trivia);
        if (payload.rpsRound !== undefined) setRpsRound(payload.rpsRound);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [open, channelId, user]);

  const broadcastState = (state: GameState, extra?: any) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: "broadcast",
      event: "game-state",
      payload: { state, ...extra },
    });
  };

  const startGame = () => {
    if (!selectedGame || !user) return;

    const players =
      otherPlayers.length === 0
        ? [user.id, "bot"]
        : [user.id, ...otherPlayers.slice(0, 1).map((p) => p.user_id)];

    const newState: GameState = {
      type: selectedGame,
      active: true,
      hostId: user.id,
      players,
      turn: players[0],
      scores: players.reduce((acc, id) => ({ ...acc, [id]: 0 }), {}),
      winner: null,
      history: gameState.history,
    };

    setGameState(newState);
    setView("mini-game");

    // Initialize game-specific state
    if (selectedGame === "tictactoe") {
      const board = Array(9).fill(null);
      setTttBoard(board);
      broadcastState(newState, { tttBoard: board });
    } else if (selectedGame === "wouldyourather") {
      const question = generateWYRQuestion();
      setWyrQuestion(question);
      broadcastState(newState, { wyr: question });
    } else if (selectedGame === "trivia") {
      const question = generateTriviaQuestion();
      setTriviaQuestion(question);
      broadcastState(newState, { trivia: question });
    } else if (selectedGame === "rps") {
      setRpsRound(1);
      broadcastState(newState, { rpsRound: 1 });
    }

    toast.success(`Starting ${MINI_GAMES.find(g => g.id === selectedGame)?.name}!`);
  };

  const handleTTTMove = (index: number) => {
    if (!myTurn || tttBoard[index] || gameState.winner) return;

    const symbol = gameState.players.indexOf(user!.id) === 0 ? "X" : "O";
    const newBoard = [...tttBoard];
    newBoard[index] = symbol;
    setTttBoard(newBoard);

    const winner = checkTTTWinner(newBoard);
    const nextPlayer = gameState.players.find((p) => p !== user!.id) || null;

    const newState: GameState = {
      ...gameState,
      turn: winner || !newBoard.includes(null) ? null : nextPlayer,
      winner: winner || (!newBoard.includes(null) ? "draw" : null),
      scores: winner
        ? { ...gameState.scores, [user!.id]: (gameState.scores[user!.id] || 0) + 1 }
        : gameState.scores,
    };

    setGameState(newState);
    broadcastState(newState, { tttBoard: newBoard });

    if (winner === user!.id) {
      toast.success("You won! 🎉");
      setTimeout(() => awardGameBadge(user!.id), 1000);
      recordWin(user!.id, "Tic-Tac-Toe");
    } else if (!newBoard.includes(null)) {
      toast.info("It's a draw!");
    }
  };

  const checkTTTWinner = (board: (string | null)[]): string | null => {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];

    for (const [a, b, c] of lines) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a] === "X" ? gameState.players[0] : gameState.players[1];
      }
    }
    return null;
  };

  const handleRPSChoice = (choice: string) => {
    if (!myTurn) return;
    setRpsChoice(choice);

    // In a real implementation, both players would submit choices
    // For now, simulate opponent choice
    const opponentChoice = ["rock", "paper", "scissors"][Math.floor(Math.random() * 3)];
    const result = determineRPSWinner(choice, opponentChoice);

    setTimeout(() => {
      if (result === "win") {
        toast.success(`You won! ${choice} beats ${opponentChoice}`);
        const newScores = {
          ...gameState.scores,
          [user!.id]: (gameState.scores[user!.id] || 0) + 1,
        };
        setGameState({ ...gameState, scores: newScores });
      } else if (result === "lose") {
        toast.error(`You lost! ${opponentChoice} beats ${choice}`);
      } else {
        toast.info("It's a tie!");
      }

      if (rpsRound >= 3) {
        const myScore = gameState.scores[user!.id] || 0;
        const winner = myScore >= 2 ? user!.id : "opponent";
        setGameState({ ...gameState, winner });
        if (winner === user!.id) {
          setTimeout(() => awardGameBadge(user!.id), 1000);
          recordWin(user!.id, "Rock Paper Scissors");
        }
      } else {
        setRpsRound(rpsRound + 1);
        setRpsChoice(null);
      }
    }, 1500);
  };

  const determineRPSWinner = (choice1: string, choice2: string): "win" | "lose" | "tie" => {
    if (choice1 === choice2) return "tie";
    if (
      (choice1 === "rock" && choice2 === "scissors") ||
      (choice1 === "paper" && choice2 === "rock") ||
      (choice1 === "scissors" && choice2 === "paper")
    ) {
      return "win";
    }
    return "lose";
  };

  const generateWYRQuestion = () => {
    const questions = [
      { a: "Have super speed", b: "Have the ability to fly" },
      { a: "Always be 10 minutes late", b: "Always be 20 minutes early" },
      { a: "Live in the past", b: "Live in the future" },
      { a: "Never eat pizza again", b: "Never eat burgers again" },
      { a: "Be able to talk to animals", b: "Be able to speak all languages" },
      { a: "Read minds", b: "See the future" },
      { a: "Always have to sing instead of speak", b: "Always have to dance instead of walk" },
      { a: "Have unlimited money", b: "Have unlimited time" },
    ];
    return questions[Math.floor(Math.random() * questions.length)];
  };

  const generateTriviaQuestion = () => {
    const questions = [
      {
        question: "What is the capital of France?",
        options: ["London", "Berlin", "Paris", "Madrid"],
        correct: 2,
      },
      {
        question: "Which planet is known as the Red Planet?",
        options: ["Venus", "Mars", "Jupiter", "Saturn"],
        correct: 1,
      },
      {
        question: "What is 2 + 2?",
        options: ["3", "4", "5", "6"],
        correct: 1,
      },
      {
        question: "Who painted the Mona Lisa?",
        options: ["Van Gogh", "Picasso", "Da Vinci", "Monet"],
        correct: 2,
      },
      {
        question: "What year did World War 2 end?",
        options: ["1943", "1944", "1945", "1946"],
        correct: 2,
      },
      {
        question: "How many continents are there?",
        options: ["5", "6", "7", "8"],
        correct: 2,
      },
    ];
    return questions[Math.floor(Math.random() * questions.length)];
  };

  const handleTriviaAnswer = (index: number) => {
    if (!triviaQuestion || gameState.winner) return;

    const correct = index === triviaQuestion.correct;
    if (correct) {
      toast.success("Correct! 🎉");
      const newScores = {
        ...gameState.scores,
        [user!.id]: (gameState.scores[user!.id] || 0) + 1,
      };
      setGameState({ ...gameState, scores: newScores, winner: user!.id });
      setTimeout(() => awardGameBadge(user!.id), 1000);
      recordWin(user!.id, "Quick Trivia");
    } else {
      toast.error("Wrong answer!");
      setGameState({ ...gameState, winner: "opponent" });
    }
  };

  const awardGameBadge = async (userId: string) => {
    try {
      // Check if user already has the badge
      const { data: existing } = await supabase
        .from("user_badges")
        .select("id")
        .eq("user_id", userId)
        .eq("badge_id", "game-night")
        .maybeSingle();

      if (!existing) {
        await supabase.from("user_badges").insert({
          user_id: userId,
          badge_id: "game-night",
          earned_at: new Date().toISOString(),
        });
        toast.success("🏆 Earned: Game Night badge!");
      }
    } catch (e) {
      console.debug("Badge award:", e);
    }
  };

  const recordWin = (userId: string, gameName: string) => {
    const newHistory = [
      ...gameState.history,
      { game: gameName, winner: userId, timestamp: Date.now() },
    ];
    setGameState({ ...gameState, history: newHistory });
  };

  const resetGame = () => {
    setGameState({
      type: null,
      active: false,
      hostId: null,
      players: [],
      turn: null,
      scores: {},
      winner: null,
      history: gameState.history,
    });
    setSelectedGame(null);
    setTttBoard(Array(9).fill(null));
    setRpsChoice(null);
    setRpsRound(0);
    setWyrQuestion(null);
    setTriviaQuestion(null);
    setView("menu");
  };

  const openExternalGame = (game: ExternalGame) => {
    window.open(game.url, "_blank", "noopener,noreferrer");
    toast.success(`Opening ${game.name}...`);
  };

  const totalGamesPlayed = gameState.history.length;
  const myWins = gameState.history.filter((h) => h.winner === user?.id).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="border-white/10 bg-[#0b0714] rounded-t-3xl max-h-[85dvh] overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
      >
        <SheetHeader className="text-left pt-2 pb-4">
          <SheetTitle className="font-display text-2xl flex items-center gap-2">
            {view === "mini-game" && (
              <Button
                size="icon"
                variant="ghost"
                onClick={resetGame}
                className="h-8 w-8 -ml-2"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            <Gamepad2 className="h-6 w-6 text-primary" />
            Games
          </SheetTitle>
        </SheetHeader>

        {view === "menu" ? (
          <>
            {/* Stats Bar */}
            {totalGamesPlayed > 0 && (
              <div className="mb-4 flex gap-2">
                <div className="flex-1 rounded-xl border border-primary/30 bg-primary/5 p-3 text-center">
                  <p className="text-2xl font-bold text-primary">{myWins}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Wins</p>
                </div>
                <div className="flex-1 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
                  <p className="text-2xl font-bold">{totalGamesPlayed}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Played</p>
                </div>
                <div className="flex-1 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
                  <p className="text-2xl font-bold">
                    {totalGamesPlayed > 0 ? Math.round((myWins / totalGamesPlayed) * 100) : 0}%
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Win Rate</p>
                </div>
              </div>
            )}

            {/* Player Info */}
            <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">
                  {otherPlayers.length === 0 ? (
                    <>
                      <BotIcon className="inline h-3.5 w-3.5 mr-1" />
                      You'll play against a bot
                    </>
                  ) : (
                    <>
                      <Crown className="inline h-3.5 w-3.5 mr-1 text-primary" />
                      {participants.length} players in channel
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Quick Mini Games */}
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Quick Games
              </p>
              <div className="grid grid-cols-2 gap-3">
                {MINI_GAMES.map((game) => (
                  <button
                    key={game.id}
                    onClick={() => setSelectedGame(game.id)}
                    className={`relative flex flex-col items-center gap-3 rounded-2xl border p-5 transition-all ${
                      selectedGame === game.id
                        ? `${game.borderColor} bg-gradient-to-br ${game.color} ring-2 ring-primary/20`
                        : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                    }`}
                  >
                    {selectedGame === game.id && (
                      <div className="absolute top-2 right-2">
                        <Zap className="h-4 w-4 text-primary fill-primary" />
                      </div>
                    )}
                    <span className="text-4xl">{game.icon}</span>
                    <div className="text-center">
                      <p className="text-sm font-bold">{game.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{game.description}</p>
                    </div>
                  </button>
                ))}
              </div>

              {selectedGame && (
                <Button
                  onClick={startGame}
                  disabled={!canStart}
                  className="w-full h-14 mt-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground gap-2 text-base font-bold shadow-lg shadow-primary/20"
                >
                  <Play className="h-5 w-5" />
                  Start {MINI_GAMES.find((g) => g.id === selectedGame)?.name}
                </Button>
              )}
            </div>

            {/* External Games */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                More Games
              </p>
              <div className="grid grid-cols-2 gap-3">
                {EXTERNAL_GAMES.map((game) => (
                  <button
                    key={game.id}
                    onClick={() => openExternalGame(game)}
                    className={`relative flex flex-col items-center gap-3 rounded-2xl border ${game.borderColor} bg-gradient-to-br ${game.color} p-5 transition-all hover:ring-2 hover:ring-primary/20 active:scale-[0.98]`}
                  >
                    <div className="absolute top-2 right-2">
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <span className="text-4xl">{game.icon}</span>
                    <div className="text-center">
                      <p className="text-sm font-bold">{game.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{game.players} players</p>
                      <p className="text-xs text-muted-foreground mt-1">{game.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Active Mini Game */}
            <div className="mb-4">
              {/* Game Header */}
              <div className="flex items-center justify-between mb-4 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-4">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">
                    {MINI_GAMES.find((g) => g.id === gameState.type)?.icon}
                  </span>
                  <div>
                    <p className="text-sm font-bold">
                      {MINI_GAMES.find((g) => g.id === gameState.type)?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {gameState.winner
                        ? gameState.winner === "draw"
                          ? "It's a draw!"
                          : gameState.winner === user?.id
                            ? "You won! 🎉"
                            : "You lost!"
                        : myTurn
                          ? "Your turn"
                          : "Opponent's turn"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">{gameState.scores[user!.id] || 0}</p>
                  <p className="text-xs text-muted-foreground">Your Score</p>
                </div>
              </div>

              {/* Game Board */}
              {gameState.type === "tictactoe" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3 mx-auto max-w-xs">
                    {tttBoard.map((cell, index) => (
                      <button
                        key={index}
                        onClick={() => handleTTTMove(index)}
                        disabled={!myTurn || !!cell || !!gameState.winner}
                        className="aspect-square rounded-2xl border-2 border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] text-4xl font-bold transition-all hover:border-primary/50 hover:from-primary/10 hover:to-primary/5 disabled:opacity-50 disabled:hover:border-white/10 active:scale-95"
                      >
                        {cell}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {gameState.type === "rps" && (
                <div className="space-y-4">
                  <div className="text-center mb-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-sm font-semibold">Round {rpsRound} of 3</p>
                  </div>
                  <div className="flex justify-center gap-3">
                    {[
                      { choice: "rock", icon: "✊" },
                      { choice: "paper", icon: "✋" },
                      { choice: "scissors", icon: "✌️" },
                    ].map(({ choice, icon }) => (
                      <button
                        key={choice}
                        onClick={() => handleRPSChoice(choice)}
                        disabled={!!rpsChoice}
                        className={`flex flex-col items-center gap-3 rounded-2xl border-2 p-5 transition-all ${
                          rpsChoice === choice
                            ? "border-primary bg-gradient-to-br from-primary/20 to-primary/10 ring-2 ring-primary/30"
                            : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]"
                        } disabled:opacity-50 active:scale-95`}
                      >
                        <span className="text-5xl">{icon}</span>
                        <span className="text-sm font-bold capitalize">{choice}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {gameState.type === "wouldyourather" && wyrQuestion && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
                    <p className="text-sm font-semibold mb-3">Would you rather...</p>
                  </div>
                  <button className="w-full rounded-2xl border-2 border-blue-400/30 bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-5 text-left transition-all hover:border-blue-400/50 hover:from-blue-500/15 hover:to-blue-500/10 active:scale-[0.98]">
                    <span className="text-3xl mr-3">🅰️</span>
                    <span className="text-base font-semibold">{wyrQuestion.a}</span>
                  </button>
                  <button className="w-full rounded-2xl border-2 border-purple-400/30 bg-gradient-to-br from-purple-500/10 to-purple-500/5 p-5 text-left transition-all hover:border-purple-400/50 hover:from-purple-500/15 hover:to-purple-500/10 active:scale-[0.98]">
                    <span className="text-3xl mr-3">🅱️</span>
                    <span className="text-base font-semibold">{wyrQuestion.b}</span>
                  </button>
                </div>
              )}

              {gameState.type === "trivia" && triviaQuestion && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-5">
                    <p className="text-base font-bold text-center">{triviaQuestion.question}</p>
                  </div>
                  <div className="space-y-2">
                    {triviaQuestion.options.map((option, index) => (
                      <button
                        key={index}
                        onClick={() => handleTriviaAnswer(index)}
                        disabled={!!gameState.winner}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left text-sm font-medium hover:border-primary/50 hover:bg-primary/5 transition-all disabled:opacity-50 active:scale-[0.98]"
                      >
                        <span className="font-bold text-primary mr-3">
                          {["A", "B", "C", "D"][index]}
                        </span>
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {gameState.winner && (
                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={resetGame}
                    variant="outline"
                    className="flex-1 h-12 gap-2 border-white/10"
                  >
                    <X className="h-4 w-4" />
                    End Game
                  </Button>
                  <Button onClick={startGame} className="flex-1 h-12 gap-2 bg-primary">
                    <RotateCcw className="h-4 w-4" />
                    Rematch
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
