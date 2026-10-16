import { useState, useEffect, useRef } from "react";
import { Gamepad2, Trophy, X, Play, RotateCcw } from "lucide-react";
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
};

const GAMES = [
  {
    id: "tictactoe" as GameType,
    name: "Tic-Tac-Toe",
    icon: "⭕",
    minPlayers: 2,
    description: "Classic X's and O's",
  },
  {
    id: "rps" as GameType,
    name: "Rock Paper Scissors",
    icon: "✊",
    minPlayers: 2,
    description: "Best of 3 rounds",
  },
  {
    id: "wouldyourather" as GameType,
    name: "Would You Rather",
    icon: "🤔",
    minPlayers: 2,
    description: "Tough choices ahead",
  },
  {
    id: "trivia" as GameType,
    name: "Quick Trivia",
    icon: "🧠",
    minPlayers: 2,
    description: "Test your knowledge",
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
  const [gameState, setGameState] = useState<GameState>({
    type: null,
    active: false,
    hostId: null,
    players: [],
    turn: null,
    scores: {},
    winner: null,
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
  const canStart = participants.length >= 2 || participants.length === 1;

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

    const otherPlayers = participants.filter((p) => p.user_id !== user.id);
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
    };

    setGameState(newState);

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

    if (winner) {
      toast.success("You won!");
      setTimeout(() => awardGameBadge(user!.id), 1000);
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
    ];
    return questions[Math.floor(Math.random() * questions.length)];
  };

  const handleTriviaAnswer = (index: number) => {
    if (!triviaQuestion || gameState.winner) return;

    const correct = index === triviaQuestion.correct;
    if (correct) {
      toast.success("Correct!");
      const newScores = {
        ...gameState.scores,
        [user!.id]: (gameState.scores[user!.id] || 0) + 1,
      };
      setGameState({ ...gameState, scores: newScores, winner: user!.id });
      setTimeout(() => awardGameBadge(user!.id), 1000);
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

  const resetGame = () => {
    setGameState({
      type: null,
      active: false,
      hostId: null,
      players: [],
      turn: null,
      scores: {},
      winner: null,
    });
    setSelectedGame(null);
    setTttBoard(Array(9).fill(null));
    setRpsChoice(null);
    setRpsRound(0);
    setWyrQuestion(null);
    setTriviaQuestion(null);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="border-white/10 bg-[#0b0714] rounded-t-3xl max-h-[85dvh] overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
      >
        <SheetHeader className="text-left pt-2">
          <SheetTitle className="font-display text-xl flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-primary" />
            Games
          </SheetTitle>
        </SheetHeader>

        {!gameState.active ? (
          <>
            {/* Game Selection */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              {GAMES.map((game) => (
                <button
                  key={game.id}
                  onClick={() => setSelectedGame(game.id)}
                  className={`relative flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all ${
                    selectedGame === game.id
                      ? "border-primary bg-primary/10"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  <span className="text-3xl">{game.icon}</span>
                  <p className="text-sm font-semibold text-center">{game.name}</p>
                  <p className="text-xs text-muted-foreground text-center">{game.description}</p>
                </button>
              ))}
            </div>

            {selectedGame && (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <p className="text-xs text-muted-foreground">
                    {participants.length === 1
                      ? "You'll play against a bot"
                      : `${participants.length} players in channel`}
                  </p>
                </div>
                <Button
                  onClick={startGame}
                  disabled={!canStart}
                  className="w-full h-12 bg-primary text-primary-foreground gap-2"
                >
                  <Play className="h-4 w-4" />
                  Start Game
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Active Game */}
            <div className="mt-4">
              {/* Scoreboard */}
              <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-3 mb-4">
                {gameState.players.map((playerId) => (
                  <div key={playerId} className="text-center">
                    <p className="text-xs text-muted-foreground">
                      {playerId === user?.id
                        ? "You"
                        : playerId === "bot"
                          ? "Bot"
                          : "Opponent"}
                    </p>
                    <p className="text-2xl font-bold text-primary">{gameState.scores[playerId] || 0}</p>
                  </div>
                ))}
              </div>

              {/* Game Board */}
              {gameState.type === "tictactoe" && (
                <div className="space-y-4">
                  <p className="text-center text-sm text-muted-foreground">
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
                  <div className="grid grid-cols-3 gap-2 mx-auto max-w-xs">
                    {tttBoard.map((cell, index) => (
                      <button
                        key={index}
                        onClick={() => handleTTTMove(index)}
                        disabled={!myTurn || !!cell || !!gameState.winner}
                        className="aspect-square rounded-xl border-2 border-white/10 bg-white/[0.02] text-3xl font-bold transition-all hover:border-primary/50 disabled:opacity-50"
                      >
                        {cell}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {gameState.type === "rps" && (
                <div className="space-y-4">
                  <p className="text-center text-sm text-muted-foreground">Round {rpsRound} of 3</p>
                  <div className="flex justify-center gap-4">
                    {["rock", "paper", "scissors"].map((choice) => (
                      <button
                        key={choice}
                        onClick={() => handleRPSChoice(choice)}
                        disabled={!!rpsChoice}
                        className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all ${
                          rpsChoice === choice
                            ? "border-primary bg-primary/10"
                            : "border-white/10 bg-white/[0.02] hover:border-white/20"
                        }`}
                      >
                        <span className="text-4xl">
                          {choice === "rock" ? "✊" : choice === "paper" ? "✋" : "✌️"}
                        </span>
                        <span className="text-sm font-semibold capitalize">{choice}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {gameState.type === "trivia" && triviaQuestion && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <p className="text-sm font-semibold text-center">{triviaQuestion.question}</p>
                  </div>
                  <div className="space-y-2">
                    {triviaQuestion.options.map((option, index) => (
                      <button
                        key={index}
                        onClick={() => handleTriviaAnswer(index)}
                        disabled={!!gameState.winner}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left text-sm hover:border-primary/50 transition-all disabled:opacity-50"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {gameState.winner && (
                <div className="mt-4 flex gap-2">
                  {isHost && (
                    <Button
                      onClick={resetGame}
                      variant="outline"
                      className="flex-1 h-11 gap-2 border-white/10"
                    >
                      <X className="h-4 w-4" />
                      End Game
                    </Button>
                  )}
                  <Button onClick={startGame} className="flex-1 h-11 gap-2 bg-primary">
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
