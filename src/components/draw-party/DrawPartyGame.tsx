import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Brush,
  Copy,
  Crown,
  Download,
  Eraser,
  Lightbulb,
  Palette,
  Play,
  RefreshCw,
  RotateCcw,
  Timer,
  Trash2,
  Trophy,
  Undo2,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { makeRoomCode } from "@/lib/activities";
import { DRAW_WORDS, maskWord } from "./words";
import { makeId, useDrawRoom, type RoomEvent, type Stroke } from "./useDrawRoom";

const COLORS = ["#f4f1e7", "#c9ff3d", "#ff6a55", "#ff9ecb", "#6aa6ff", "#4ade80", "#facc15", "#22d3ee", "#a855f7", "#0a0a0b"];
const SIZES = [4, 8, 14];
const DURATIONS = [30, 60, 90];
const DEFAULT_DURATION = 75;
const TOTAL_ROUNDS = 4;
const SPEED_ROUNDS = 6;
const SPEED_DURATION = 30;
const SPEED_MULT = 2;
const HINT_EVERY_MS = 25000;
const REACT_EMOJIS = ["❤️", "😂", "😮", "👏", "🔥", "😭"];

type Mode = "classic" | "speed" | "sandbox";

const MODE_META: Record<Mode, { label: string; blurb: string }> = {
  classic: { label: "Classic", blurb: "4 rounds · your timer" },
  speed: { label: "Speed", blurb: "6 × 30s rounds · 2× points" },
  sandbox: { label: "Sandbox", blurb: "Free draw · no scoring" },
};

type FeedGuess = { type: "guess"; id: string; name: string; text: string; correct: boolean };
type FeedSystem = { type: "system"; id: string; text: string };
type FeedItem = FeedGuess | FeedSystem;
type Player = { id: string; name: string; score: number };

function loadName(): string {
  try {
    return localStorage.getItem("rizz-draw-name") ?? "";
  } catch {
    return "";
  }
}

function loadId(): string {
  try {
    const existing = localStorage.getItem("rizz-draw-id");
    if (existing) return existing;
    const next = makeId();
    localStorage.setItem("rizz-draw-id", next);
    return next;
  } catch {
    return makeId();
  }
}

function roomFromUrl(): string | null {
  try {
    const code = new URLSearchParams(window.location.search).get("room");
    return code?.trim().toUpperCase() || null;
  } catch {
    return null;
  }
}

function pickThree(exclude?: string | null): string[] {
  const pool = DRAW_WORDS.map((w) => w.trim()).filter(Boolean);
  const out: string[] = [];
  let guard = 0;
  while (out.length < 3 && guard < 200) {
    guard += 1;
    const w = pool[Math.floor(Math.random() * pool.length)];
    if (!w || out.includes(w)) continue;
    if (exclude && w.toLowerCase() === exclude.toLowerCase()) continue;
    out.push(w);
  }
  return out;
}

/** Deterministic hint: reveal one more letter every HINT_EVERY_MS, left to right. */
export function hintedMask(word: string, elapsedMs: number): string {
  const reveal = Math.floor(elapsedMs / HINT_EVERY_MS);
  let shown = 0;
  return word
    .split("")
    .map((ch) => {
      if (ch === " ") return " ";
      if (shown < reveal) {
        shown += 1;
        return ch;
      }
      return "_";
    })
    .join(" ");
}

export function DrawPartyGame({ compact = false }: { compact?: boolean } = {}) {
  const [userId] = useState(loadId);
  const [name, setName] = useState(loadName);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [eraser, setEraser] = useState(false);
  const [word, setWord] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [drawerName, setDrawerName] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(TOTAL_ROUNDS);
  const [durationS, setDurationS] = useState(DEFAULT_DURATION);
  const [roundStartedAt, setRoundStartedAt] = useState<number | null>(null);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [revealed, setRevealed] = useState<string | null>(null);
  const [guessInput, setGuessInput] = useState("");
  const [choosing, setChoosing] = useState(false);
  const [choices, setChoices] = useState<string[]>([]);
  const [customWord, setCustomWord] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [mode, setMode] = useState<Mode>("classic");
  const [mult, setMult] = useState(1);
  const [rematchVotes, setRematchVotes] = useState<Record<string, string>>({});
  const [reactions, setReactions] = useState<Array<{ id: string; emoji: string; x: number }>>([]);
  const [confetti, setConfetti] = useState<Array<{ id: string; x: number; color: string; delay: number }>>([]);
  const [replaying, setReplaying] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const currentStroke = useRef<Stroke | null>(null);
  const stateRef = useRef({ word, drawerId, drawerName, round, endsAt, roundStartedAt, players, totalRounds });
  stateRef.current = { word, drawerId, drawerName, round, endsAt, roundStartedAt, players, totalRounds };

  useEffect(() => {
    setRoomCode(roomFromUrl());
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);

  const timeLeft = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;
  const isDrawer = drawerId ? drawerId === userId : true;
  const inRound = word !== null && endsAt !== null && timeLeft > 0;
  const roundOver = word !== null && endsAt === null;

  const upsertPlayer = useCallback((id: string, pname: string, delta = 0) => {
    setPlayers((prev) => ({
      ...prev,
      [id]: { id, name: pname || "Someone", score: (prev[id]?.score ?? 0) + delta },
    }));
  }, []);

  const pushFeed = useCallback((item: FeedItem) => {
    setFeed((prev) => [...prev.slice(-59), item]);
  }, []);

  const showReaction = useCallback((emoji: string) => {
    const id = makeId();
    setReactions((prev) => [...prev.slice(-11), { id, emoji, x: 8 + Math.random() * 84 }]);
    window.setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2200);
  }, []);

  const handleEvent = useCallback(
    (ev: RoomEvent) => {
      switch (ev.kind) {
        case "stroke":
          setStrokes((prev) => (prev.some((s) => s.id === ev.stroke.id) ? prev : [...prev, ev.stroke]));
          break;
        case "clear":
          setStrokes([]);
          break;
        case "undo":
          setStrokes((prev) => prev.filter((s) => s.id !== ev.strokeId));
          break;
        case "guess": {
          const s = stateRef.current;
          const correct =
            !!s.word &&
            s.endsAt !== null &&
            Date.now() < s.endsAt &&
            ev.text.trim().toLowerCase() === s.word.trim().toLowerCase();
          pushFeed({ type: "guess", id: ev.id, name: ev.name, text: ev.text, correct });
          upsertPlayer(ev.id, ev.name);
          break;
        }
        case "round": {
          const rm = (ev.mode === "speed" || ev.mode === "sandbox" ? ev.mode : "classic") as Mode;
          const rTotal = ev.totalRounds ?? (rm === "speed" ? SPEED_ROUNDS : TOTAL_ROUNDS);
          const rDur = ev.durationS ?? (rm === "speed" ? SPEED_DURATION : DEFAULT_DURATION);
          setWord(rm === "sandbox" ? null : ev.word);
          setDrawerId(ev.drawerId);
          setDrawerName(ev.drawerName);
          setRound(ev.round);
          setEndsAt(rm === "sandbox" ? null : ev.endsAt);
          setTotalRounds(rTotal);
          setDurationS(rDur);
          setMode(rm);
          setMult(ev.mult ?? (rm === "speed" ? SPEED_MULT : 1));
          setRoundStartedAt(ev.endsAt - rDur * 1000);
          setRevealed(null);
          setGameOver(false);
          setRematchVotes({});
          setFeed([]);
          setStrokes([]);
          setChoosing(false);
          upsertPlayer(ev.drawerId, ev.drawerName);
          if (rm === "sandbox") {
            pushFeed({ type: "system", id: makeId(), text: `${ev.drawerName} opened the sandbox — free draw!` });
          }
          break;
        }
        case "correct":
          upsertPlayer(ev.userId, ev.name, ev.points);
          pushFeed({ type: "system", id: makeId(), text: `${ev.name} guessed it! +${ev.points}` });
          break;
        case "reveal":
          setRevealed(ev.word);
          setEndsAt(null);
          break;
        case "react":
          showReaction(ev.emoji);
          break;
        case "rematch": {
          setRematchVotes((prev) => {
            if (prev[ev.userId]) return prev;
            const next = { ...prev, [ev.userId]: ev.name };
            const voters = Object.keys(next).length;
            const needed = Math.max(2, Object.keys(stateRef.current.players).length);
            if (voters >= needed) {
              window.setTimeout(() => resetGame(true), 0);
            }
            return next;
          });
          break;
        }
        case "hello":
          upsertPlayer(ev.userId, ev.name);
          break;
      }
    },
    [pushFeed, showReaction, upsertPlayer],
  );

  const send = useDrawRoom(roomCode, handleEvent);

  useEffect(() => {
    if (!roomCode || !name.trim()) return;
    upsertPlayer(userId, name.trim());
    send({ kind: "hello", userId, name: name.trim() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#101012";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of [...strokes, ...(currentStroke.current ? [currentStroke.current] : [])]) {
      if (s.points.length === 0) continue;
      ctx.globalCompositeOperation = s.eraser ? "destination-out" : "source-over";
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size * dpr;
      ctx.beginPath();
      s.points.forEach((p, i) => {
        const x = p.x * canvas.width;
        const y = p.y * canvas.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      if (s.points.length === 1) {
        const p = s.points[0];
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(p.x * canvas.width, p.y * canvas.height, (s.size * dpr) / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }, [strokes]);

  useEffect(() => {
    paint();
  }, [paint, now]);

  useEffect(() => {
    const onResize = () => paint();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [paint]);

  const posFromEvent = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const canDraw = !word || !endsAt || (inRound && isDrawer);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!canDraw) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    currentStroke.current = {
      id: makeId(),
      color: eraser ? "#000000" : color,
      size: eraser ? size * 2.2 : size,
      eraser,
      points: [posFromEvent(e)],
    };
    paint();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!currentStroke.current) return;
    currentStroke.current.points.push(posFromEvent(e));
    paint();
  };

  const onPointerUp = () => {
    const finished = currentStroke.current;
    currentStroke.current = null;
    if (!finished) return;
    setStrokes((prev) => [...prev, finished]);
    send({ kind: "stroke", stroke: finished });
    paint();
  };

  const undo = () => {
    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      send({ kind: "undo", strokeId: last.id });
      return prev.slice(0, -1);
    });
  };

  const clear = () => {
    setStrokes([]);
    send({ kind: "clear" });
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) {
        toast.error("Couldn't save the drawing");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `draw-party-round-${Math.max(1, round)}.png`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("Drawing saved as PNG");
    }, "image/png");
  };

  const saveName = (v: string) => {
    setName(v);
    try {
      localStorage.setItem("rizz-draw-name", v);
    } catch {
      /* noop */
    }
  };

  const createRoom = () => {
    const code = makeRoomCode();
    const url = new URL(window.location.href);
    url.searchParams.set("room", code);
    window.history.replaceState(null, "", url.toString());
    setRoomCode(code);
    toast.success(`Room ${code} created — share the link`);
  };

  const copyInvite = async () => {
    const link = roomCode
      ? `${window.location.origin}${window.location.pathname}?room=${roomCode}`
      : window.location.href;
    try {
      await navigator.clipboard.writeText(
        roomCode ? `Join my Draw Party room ${roomCode}: ${link}` : link,
      );
      toast.success("Invite copied");
    } catch {
      toast.error("Couldn't copy the invite");
    }
  };

  const openPicker = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Pick a nickname first");
      return;
    }
    saveName(trimmed);
    upsertPlayer(userId, trimmed);
    if (mode === "speed") setDurationS(SPEED_DURATION);
    setChoices(pickThree(word));
    setCustomWord("");
    setChoosing(true);
  };

  const beginRound = (chosen: string, secs: number) => {
    const clean = chosen.trim().slice(0, 24);
    if (!clean) {
      toast.error("Pick a word first");
      return;
    }
    const trimmed = name.trim() || "Someone";
    const nextEnds = Date.now() + secs * 1000;
    const nextRound = round + 1;
    const m = mode;
    const mMult = m === "speed" ? SPEED_MULT : 1;
    const mTotal = m === "speed" ? SPEED_ROUNDS : TOTAL_ROUNDS;
    setWord(clean);
    setDrawerId(userId);
    setDrawerName(trimmed);
    setRound(nextRound);
    setDurationS(secs);
    setRoundStartedAt(Date.now());
    setEndsAt(nextEnds);
    setTotalRounds(mTotal);
    setMult(mMult);
    setRevealed(null);
    setGameOver(false);
    setRematchVotes({});
    setFeed([]);
    setStrokes([]);
    setChoosing(false);
    upsertPlayer(userId, trimmed);
    send({
      kind: "round",
      word: clean,
      drawerId: userId,
      drawerName: trimmed,
      round: nextRound,
      endsAt: nextEnds,
      totalRounds: mTotal,
      durationS: secs,
      mode: m,
      mult: mMult,
    });
    toast.success(`Round ${nextRound}/${mTotal} — you draw “${clean}”`);
  };

  const beginSandbox = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Pick a nickname first");
      return;
    }
    saveName(trimmed);
    upsertPlayer(userId, trimmed);
    setMode("sandbox");
    setMult(1);
    setWord(null);
    setDrawerId(userId);
    setDrawerName(trimmed);
    setRound(1);
    setTotalRounds(1);
    setEndsAt(null);
    setRoundStartedAt(null);
    setRevealed(null);
    setGameOver(false);
    setRematchVotes({});
    setFeed([]);
    setStrokes([]);
    setChoosing(false);
    send({
      kind: "round",
      word: "",
      drawerId: userId,
      drawerName: trimmed,
      round: 1,
      endsAt: Date.now(),
      totalRounds: 1,
      durationS: 0,
      mode: "sandbox",
      mult: 1,
    });
    toast.success("Sandbox open — everyone draws");
  };

  const endRound = useCallback(() => {
    const s = stateRef.current;
    if (!s.word) return;
    setRevealed(s.word);
    setEndsAt(null);
    send({ kind: "reveal", word: s.word });
    if (s.round >= s.totalRounds) setGameOver(true);
  }, [send]);

  useEffect(() => {
    if (word && endsAt && now >= endsAt) endRound();
  }, [word, endsAt, now, endRound]);

  const submitGuess = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = guessInput.trim();
    if (!text) return;
    const trimmed = name.trim() || "Someone";
    const id = makeId();
    const correct = !!word && inRound && !isDrawer && text.toLowerCase() === word.trim().toLowerCase();
    pushFeed({ type: "guess", id, name: trimmed, text, correct });
    send({ kind: "guess", id, name: trimmed, text, at: Date.now() });
    if (correct) {
      const points = (100 + timeLeft * 2) * mult;
      upsertPlayer(userId, trimmed, points);
      if (drawerId) upsertPlayer(drawerId, drawerName ?? "Drawer", 50 * mult);
      pushFeed({ type: "system", id: makeId(), text: `You guessed it! +${points}` });
      send({ kind: "correct", userId, name: trimmed, points });
      fireConfetti();
      toast.success(`Correct! +${points}`);
    }
    setGuessInput("");
  };

  const resetGame = (remote = false) => {
    setWord(null);
    setDrawerId(null);
    setDrawerName(null);
    setRound(0);
    setEndsAt(null);
    setRoundStartedAt(null);
    setRevealed(null);
    setFeed([]);
    setStrokes([]);
    setPlayers(remote ? {} : players);
    setGameOver(false);
    setChoosing(false);
    setRematchVotes({});
    setMode("classic");
    setMult(1);
    if (!remote) send({ kind: "clear" });
    paint();
  };

  const playAgain = () => resetGame(false);

  const voteRematch = () => {
    const trimmed = name.trim() || "Someone";
    setRematchVotes((prev) => {
      if (prev[userId]) return prev;
      const next = { ...prev, [userId]: trimmed };
      const needed = Math.max(2, Object.keys(stateRef.current.players).length);
      if (Object.keys(next).length >= needed) {
        window.setTimeout(() => resetGame(true), 0);
      }
      return next;
    });
    send({ kind: "rematch", userId, name: trimmed });
  };

  const sendReaction = (emoji: string) => {
    showReaction(emoji);
    send({ kind: "react", id: makeId(), name: name.trim() || "Someone", emoji });
  };

  const fireConfetti = useCallback(() => {
    const pieces = Array.from({ length: 36 }, () => ({
      id: makeId(),
      x: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * 0.35,
    }));
    setConfetti((prev) => [...prev.slice(-36), ...pieces]);
    window.setTimeout(() => {
      setConfetti((prev) => prev.filter((p) => !pieces.some((q) => p.id === q.id)));
    }, 2200);
  }, []);

  useEffect(() => {
    if (gameOver) fireConfetti();
  }, [gameOver, fireConfetti]);

  const replayDrawing = () => {
    const snapshot = [...strokes];
    if (snapshot.length === 0 || replaying) return;
    setReplaying(true);
    setStrokes([]);
    let i = 0;
    const step = () => {
      i += 1;
      setStrokes(snapshot.slice(0, i));
      if (i < snapshot.length) {
        window.setTimeout(step, 120);
      } else {
        window.setTimeout(() => setReplaying(false), 400);
      }
    };
    window.setTimeout(step, 150);
  };

  const sortedPlayers = useMemo(
    () => Object.values(players).sort((a, b) => b.score - a.score),
    [players],
  );
  const winner = gameOver ? sortedPlayers[0] ?? null : null;
  const sandboxOn = mode === "sandbox" && round > 0;

  const elapsed = roundStartedAt ? Math.max(0, now - roundStartedAt) : 0;
  const wordHint = !word
    ? null
    : isDrawer || revealed
      ? word
      : inRound
        ? hintedMask(word, elapsed)
        : maskWord(word);

  return (
    <div className={compact ? "w-full px-2 py-2" : "mx-auto w-full max-w-5xl px-3 py-3 sm:px-4"}>
      {!compact && (
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A8A8E]">
          Party game · nothing is saved
        </p>
      )}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <h1
          className={`font-display font-bold tracking-tight text-[#f2efe6] ${compact ? "text-lg" : "text-2xl"}`}
        >
          Draw Party
          {round > 0 && !sandboxOn && (
            <span className="ml-2 align-middle text-sm font-bold text-muted-foreground">
              Round {Math.min(round, totalRounds)}/{totalRounds}
            </span>
          )}
          <span className="ml-2 inline-flex -translate-y-0.5 items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {mode === "speed" ? <Zap className="h-3 w-3 text-[#c8ff3d]" /> : mode === "sandbox" ? <Palette className="h-3 w-3 text-[#c8ff3d]" /> : <Trophy className="h-3 w-3 text-[#c8ff3d]" />}
            {MODE_META[mode].label}
            {mult > 1 && <span className="text-[#c8ff3d]">· {mult}×</span>}
          </span>
        </h1>
        <div className="flex items-center gap-2">
          {roomCode ? (
            <span className="rounded-full border border-[#c8ff3d]/40 bg-[#c8ff3d]/10 px-3 py-1 font-mono text-xs font-bold tracking-widest text-[#c8ff3d]">
              ROOM {roomCode}
            </span>
          ) : (
            <span className="rounded-full border border-[#2E2E32] px-3 py-1 text-xs font-semibold text-muted-foreground">
              Solo / same-screen
            </span>
          )}
          <button
            type="button"
            onClick={roomCode ? copyInvite : createRoom}
            className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#2E2E32] px-4 text-xs font-bold text-[#f2efe6] transition-colors hover:border-[#c8ff3d]/50"
          >
            <Copy className="h-3.5 w-3.5" /> {roomCode ? "Copy invite" : "Create room"}
          </button>
        </div>
      </div>
      {!compact && (
        <p className="mt-1 text-sm text-muted-foreground">
          {sandboxOn
            ? "Sandbox is open — everyone draws together. No words, no timer, no scores."
            : "Whoever starts the round draws. Guessers get a free hint letter every 25 seconds. Most points wins."}
        </p>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 rounded-2xl border border-[#262629] bg-[#141416] p-3">
          {word && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-[#f2efe6] ${inRound && timeLeft <= 10 ? "animate-pulse bg-[#ff5d5d]/20 text-[#ff8a7a]" : "bg-white/5"}`}
              >
                <Timer className="h-3.5 w-3.5" /> {inRound ? `${timeLeft}s` : "Time!"}
              </span>
              <span
                className="rounded-full bg-white/5 px-3 py-1.5 font-mono text-sm font-bold tracking-widest text-[#f2efe6]"
                title={isDrawer || revealed ? word : `${word.length} letters`}
              >
                {wordHint}
              </span>
              <span className="text-xs text-muted-foreground">
                {inRound
                  ? isDrawer
                    ? `you draw`
                    : `${drawerName ?? "someone"} draws`
                  : revealed
                    ? `The word was “${revealed}”`
                    : ""}
              </span>
              {inRound && (
                <span className="ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                  <span
                    className="block h-full rounded-full bg-[#c8ff3d] transition-all"
                    style={{ width: `${(timeLeft / durationS) * 100}%` }}
                  />
                </span>
              )}
            </div>
          )}

          <div
            ref={wrapRef}
            className="relative h-[46dvh] min-h-[320px] w-full overflow-hidden rounded-xl border border-white/10 sm:h-[52dvh]"
          >
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full"
              style={{ touchAction: "none", cursor: canDraw ? "crosshair" : "default" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              aria-label="Drawing canvas"
            />
            {word && inRound && !isDrawer && (
              <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2">
                <p className="whitespace-nowrap rounded-full bg-black/70 px-4 py-1.5 text-xs font-semibold text-white">
                  {drawerName ?? "Someone"} is drawing — guess below
                </p>
              </div>
            )}
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              <style>{`@keyframes dp-float-up { 0% { opacity: 0; transform: translateY(12px) scale(0.7); } 15% { opacity: 1; } 100% { opacity: 0; transform: translateY(-90px) scale(1.25); } }
@keyframes dp-confetti-fall { 0% { opacity: 1; transform: translateY(-8px) rotate(0deg); } 100% { opacity: 0; transform: translateY(220px) rotate(540deg); } }`}</style>
              {reactions.map((r) => (
                <span
                  key={r.id}
                  className="absolute bottom-6 text-2xl"
                  style={{ left: `${r.x}%`, animation: "dp-float-up 2.2s ease-out forwards" }}
                >
                  {r.emoji}
                </span>
              ))}
              {confetti.map((p) => (
                <span
                  key={p.id}
                  className="absolute top-0 h-2 w-1.5 rounded-[1px]"
                  style={{
                    left: `${p.x}%`,
                    backgroundColor: p.color,
                    animation: `dp-confetti-fall 1.8s ease-in forwards`,
                    animationDelay: `${p.delay}s`,
                  }}
                />
              ))}
            </div>
            {gameOver && winner && (
              <div className="absolute inset-0 grid place-items-center bg-black/70 p-4 text-center">
                <div className="rounded-2xl border border-[#c8ff3d]/40 bg-[#141416] p-5">
                  <Trophy className="mx-auto h-8 w-8 text-[#c8ff3d]" />
                  <p className="mt-2 text-lg font-bold text-[#f2efe6]">{winner.name} wins!</p>
                  <p className="text-sm text-muted-foreground">{winner.score} points after {totalRounds} rounds</p>
                  {Object.keys(rematchVotes).length > 0 && (
                    <p className="mt-1 text-xs font-bold text-[#c8ff3d]">
                      Rematch votes: {Object.values(rematchVotes).join(", ")}
                    </p>
                  )}
                  <div className="mt-3 flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={playAgain}
                      className="min-h-[44px] rounded-full bg-[#c8ff3d] px-6 text-sm font-bold text-[#0b0b0c]"
                    >
                      Play again
                    </button>
                    <button
                      type="button"
                      onClick={voteRematch}
                      disabled={!!rematchVotes[userId]}
                      className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#c8ff3d]/50 px-5 text-sm font-bold text-[#c8ff3d] disabled:opacity-50"
                    >
                      <RefreshCw className="h-4 w-4" />
                      {rematchVotes[userId] ? "Voted!" : "Rematch"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <Palette className="h-3.5 w-3.5" /> Color
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setColor(c);
                      setEraser(false);
                    }}
                    aria-label={`Color ${c}`}
                    title={c}
                    className={`h-9 w-9 rounded-full border-2 transition-transform hover:scale-110 ${color === c && !eraser ? "border-[#c8ff3d]" : "border-white/15"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <label
                  title="Custom color"
                  className={`grid h-9 w-9 cursor-pointer place-items-center overflow-hidden rounded-full border-2 text-lg font-bold ${!COLORS.includes(color) ? "border-[#c8ff3d]" : "border-white/15"}`}
                  style={{ backgroundColor: COLORS.includes(color) ? "transparent" : color }}
                >
                  <span aria-hidden>{COLORS.includes(color) ? "+" : ""}</span>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => {
                      setColor(e.target.value);
                      setEraser(false);
                    }}
                    className="sr-only"
                    aria-label="Custom color"
                  />
                </label>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <Brush className="h-3.5 w-3.5" /> Brush
              </span>
              {SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  className={`grid h-9 w-9 place-items-center rounded-full border transition-colors ${size === s ? "border-[#c8ff3d]" : "border-white/15"} text-[#f2efe6]`}
                  aria-label={`Size ${s}px`}
                  title={`${s}px`}
                >
                  <span className="rounded-full bg-current" style={{ width: s, height: s }} />
                </button>
              ))}
              <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" aria-hidden />
              <button
                type="button"
                onClick={() => setEraser((v) => !v)}
                className={`flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors ${eraser ? "border-[#c8ff3d] text-[#c8ff3d]" : "border-white/15 text-[#f2efe6]"}`}
              >
                <Eraser className="h-4 w-4" /> Eraser
              </button>
              <button
                type="button"
                onClick={undo}
                className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/15 px-3 text-xs font-bold text-[#f2efe6]"
              >
                <Undo2 className="h-4 w-4" /> Undo
              </button>
              <button
                type="button"
                onClick={clear}
                className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/15 px-3 text-xs font-bold text-[#f2efe6]"
              >
                <Trash2 className="h-4 w-4" /> Clear
              </button>
              <button
                type="button"
                onClick={save}
                className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/15 px-3 text-xs font-bold text-[#f2efe6]"
              >
                <Download className="h-4 w-4" /> PNG
              </button>
              {roundOver && strokes.length > 0 && (
                <button
                  type="button"
                  onClick={replayDrawing}
                  disabled={replaying}
                  className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/15 px-3 text-xs font-bold text-[#f2efe6] disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" /> {replaying ? "Playing…" : "Replay"}
                </button>
              )}
            </div>
          </div>

          {choosing ? (
            <div className="mt-3 rounded-xl border border-[#c8ff3d]/30 bg-[#c8ff3d]/[0.04] p-3">
              <p className="text-sm font-bold text-[#f2efe6]">
                Round {round + 1}/{mode === "speed" ? SPEED_ROUNDS : TOTAL_ROUNDS} — pick a word to draw
                {mode === "speed" && <span className="text-[#c8ff3d]"> · 30s · 2× points</span>}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {choices.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => beginRound(w, durationS)}
                    className="min-h-[44px] rounded-full bg-[#c8ff3d] px-5 text-sm font-bold text-[#0b0b0c] transition-transform hover:bg-[#c8ff3d]/90 active:scale-95"
                  >
                    {w}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  value={customWord}
                  onChange={(e) => setCustomWord(e.target.value)}
                  placeholder="…or your own word (letters only)"
                  maxLength={24}
                  className="h-11 min-h-[44px] flex-1 rounded-full border border-white/15 bg-black/40 px-4 text-sm font-semibold text-[#f2efe6] placeholder:text-muted-foreground"
                />
                {mode === "classic" && (
                  <div className="flex gap-1.5" role="group" aria-label="Round timer">
                    {DURATIONS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDurationS(d)}
                        className={`h-11 min-h-[44px] rounded-full border px-3 text-xs font-bold ${durationS === d ? "border-[#c8ff3d] text-[#c8ff3d]" : "border-white/15 text-muted-foreground"}`}
                      >
                        {d}s
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (!/^[a-zA-Z ]{2,24}$/.test(customWord.trim())) {
                      toast.error("Custom word: 2–24 letters");
                      return;
                    }
                    beginRound(customWord.trim().toLowerCase(), durationS);
                  }}
                  className="flex min-h-[44px] items-center justify-center rounded-full border border-[#c8ff3d]/50 px-5 text-sm font-bold text-[#c8ff3d]"
                >
                  Draw it
                </button>
              </div>
            </div>
          ) : (
            !inRound &&
            !gameOver &&
            !sandboxOn && (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="grid grid-cols-3 gap-2" role="group" aria-label="Game mode">
                  {(Object.keys(MODE_META) as Mode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={`rounded-xl border p-2 text-left transition-colors ${mode === m ? "border-[#c8ff3d] bg-[#c8ff3d]/[0.06]" : "border-white/10 hover:border-white/25"}`}
                    >
                      <span className="flex items-center gap-1 text-xs font-bold text-[#f2efe6]">
                        {m === "speed" ? (
                          <Zap className="h-3.5 w-3.5 text-[#c8ff3d]" />
                        ) : m === "sandbox" ? (
                          <Palette className="h-3.5 w-3.5 text-[#c8ff3d]" />
                        ) : (
                          <Trophy className="h-3.5 w-3.5 text-[#c8ff3d]" />
                        )}
                        {MODE_META[m].label}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                        {MODE_META[m].blurb}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    value={name}
                    onChange={(e) => saveName(e.target.value)}
                    placeholder="Your nickname"
                    maxLength={24}
                    className="h-11 min-h-[44px] flex-1 rounded-full border border-white/15 bg-black/40 px-4 text-sm font-semibold text-[#f2efe6] placeholder:text-muted-foreground"
                  />
                  {mode === "classic" && (
                    <div className="flex gap-1.5" role="group" aria-label="Round timer">
                      {DURATIONS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDurationS(d)}
                          className={`h-11 min-h-[44px] rounded-full border px-3 text-xs font-bold ${durationS === d ? "border-[#c8ff3d] text-[#c8ff3d]" : "border-white/15 text-muted-foreground"}`}
                        >
                          {d}s
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={mode === "sandbox" ? beginSandbox : openPicker}
                    className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full bg-[#c8ff3d] px-4 text-sm font-bold text-[#0b0b0c] transition-transform hover:bg-[#c8ff3d]/90 active:scale-95 sm:flex-none sm:px-6"
                  >
                    <Play className="h-4 w-4" />
                    {mode === "sandbox" ? "Open sandbox" : round === 0 ? "Start drawing" : `Round ${round + 1}`}
                  </button>
                </div>
              </div>
            )
          )}
          {sandboxOn && (
            <div className="mt-3 flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:flex-row sm:items-center">
              <p className="flex-1 text-sm text-muted-foreground">
                Sandbox open — <span className="font-bold text-[#f2efe6]">everyone</span> can draw. Invite friends
                with the room code.
              </p>
              <button
                type="button"
                onClick={() => resetGame(false)}
                className="flex min-h-[44px] items-center justify-center rounded-full border border-white/15 px-6 text-sm font-bold text-[#f2efe6]"
              >
                End sandbox
              </button>
            </div>
          )}
          {roundOver && !gameOver && (
            <div className="mt-3 flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:flex-row sm:items-center">
              <p className="flex-1 text-sm text-muted-foreground">
                {revealed ? (
                  <>
                    The word was <span className="font-bold text-[#f2efe6]">“{revealed}”</span>. Whoever starts
                    next draws.
                  </>
                ) : (
                  "Round over."
                )}
              </p>
              <button
                type="button"
                onClick={openPicker}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#c8ff3d] px-6 text-sm font-bold text-[#0b0b0c] transition-transform hover:bg-[#c8ff3d]/90 active:scale-95"
              >
                <Play className="h-4 w-4" /> Next round
              </button>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="rounded-2xl border border-[#262629] bg-[#141416] p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A8A8E]">
              <Users className="h-3.5 w-3.5" /> Players {sortedPlayers.length > 0 && `· ${sortedPlayers.length}`}
            </p>
            {sortedPlayers.length === 0 ? (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                <span className="font-semibold text-[#f2efe6]">How to play:</span> pick Classic, Speed (2×
                points) or Sandbox, then start — whoever starts draws. Correct guess: (100 + 2/sec left) × mode.
                Drawer gets +50 per correct guesser. A <Lightbulb className="inline h-3 w-3" /> hint letter drops
                every 25s. Tap an emoji to react live.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {sortedPlayers.map((p, i) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-1.5 truncate font-semibold text-[#f2efe6]">
                      {i === 0 && <Crown className="h-3.5 w-3.5 shrink-0 text-[#c8ff3d]" />}
                      <span className="truncate">
                        {p.name} {p.id === userId && <span className="text-muted-foreground">(you)</span>}
                      </span>
                      {p.id === drawerId && word && <span aria-label="drawing">✏️</span>}
                    </span>
                    <span className="shrink-0 font-mono text-xs font-bold text-[#c8ff3d]">{p.score}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-[#262629] bg-[#141416] p-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A8A8E]">Guesses</p>
            <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
              {feed.length === 0 && (
                <li className="text-xs text-muted-foreground">No guesses yet — be the first.</li>
              )}
              {feed.slice(-12).map((item) =>
                item.type === "system" ? (
                  <li key={item.id} className="px-1 text-center text-xs font-bold text-[#c8ff3d]">
                    🎉 {item.text}
                  </li>
                ) : (
                  <li
                    key={item.id}
                    className={`rounded-xl px-3 py-1.5 text-sm ${item.correct ? "bg-[#c8ff3d]/15 text-[#c8ff3d]" : "bg-white/[0.04] text-[#f2efe6]"}`}
                  >
                    <span className="font-bold">{item.name}: </span>
                    <span>{item.text}</span>
                    {item.correct && <span className="ml-1 text-xs">✓</span>}
                  </li>
                ),
              )}
            </ul>
            <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Send a reaction">
              {REACT_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => sendReaction(e)}
                  className="grid h-11 w-11 place-items-center rounded-full border border-white/10 text-lg transition-transform hover:scale-110 active:scale-95"
                  aria-label={`React ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>
            <form onSubmit={submitGuess} className="mt-2 flex gap-2">
              <input
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value)}
                placeholder={isDrawer && inRound ? "Drawer can't guess" : "Type a guess…"}
                disabled={isDrawer && inRound}
                maxLength={40}
                className="h-11 min-h-[44px] min-w-0 flex-1 rounded-full border border-white/15 bg-black/40 px-4 text-sm text-[#f2efe6] placeholder:text-muted-foreground disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isDrawer && inRound}
                className="h-11 min-h-[44px] shrink-0 rounded-full bg-[#c8ff3d] px-5 text-sm font-bold text-[#0b0b0c] disabled:opacity-50"
              >
                Guess
              </button>
            </form>
            {!name.trim() && (
              <input
                value={name}
                onChange={(e) => saveName(e.target.value)}
                placeholder="Nickname to guess"
                maxLength={24}
                className="mt-2 h-11 min-h-[44px] rounded-full border border-white/15 bg-black/40 px-4 text-sm text-[#f2efe6]"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
