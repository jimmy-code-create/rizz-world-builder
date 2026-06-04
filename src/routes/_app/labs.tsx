import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Sparkles, Dice5, Heart, Flame, Zap, QrCode, Copy, Timer, Calculator,
  Palette, Music2, Coins, Wand2, Smile, Star, Clock, Lock, Eye, EyeOff,
  Hash, Quote, Cloud, Sun, Moon, Coffee, Pizza, Brain, Gamepad2, Trophy,
  Shuffle, MessageSquare, Camera, Volume2, Bot, Mic, Send, Plus, Minus,
  Check, X, RefreshCw, Activity, Compass, Gift, Image as ImageIcon,
} from "lucide-react";

export const Route = createFileRoute("/_app/labs")({
  head: () => ({ meta: [{ title: "Labs · 40+ features · RIZZ" }] }),
  component: LabsPage,
});

function LabsPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass border border-white/10 text-xs">
          <Sparkles className="h-3 w-3 text-[var(--rizz-pink)]" /> 40+ live mini-features
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-bold">RIZZ Labs</h1>
        <p className="text-sm text-muted-foreground">Toys, tools and goodies. Tap any tile.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Tile title="01 · Rizz-o-meter" icon={<Flame className="h-4 w-4" />}><RizzMeter /></Tile>
        <Tile title="02 · Pickup line generator" icon={<Quote className="h-4 w-4" />}><PickupLines /></Tile>
        <Tile title="03 · Compatibility checker" icon={<Heart className="h-4 w-4" />}><Compatibility /></Tile>
        <Tile title="04 · Daily vibe" icon={<Sun className="h-4 w-4" />}><DailyVibe /></Tile>
        <Tile title="05 · Magic 8-ball" icon={<Dice5 className="h-4 w-4" />}><MagicBall /></Tile>
        <Tile title="06 · Coin flip" icon={<Coins className="h-4 w-4" />}><CoinFlip /></Tile>
        <Tile title="07 · Dice roller" icon={<Dice5 className="h-4 w-4" />}><DiceRoller /></Tile>
        <Tile title="08 · Random pick" icon={<Shuffle className="h-4 w-4" />}><RandomPick /></Tile>
        <Tile title="09 · Pomodoro timer" icon={<Timer className="h-4 w-4" />}><Pomodoro /></Tile>
        <Tile title="10 · Countdown" icon={<Clock className="h-4 w-4" />}><Countdown /></Tile>
        <Tile title="11 · Stopwatch" icon={<Activity className="h-4 w-4" />}><Stopwatch /></Tile>
        <Tile title="12 · Word counter" icon={<Hash className="h-4 w-4" />}><WordCounter /></Tile>
        <Tile title="13 · Emoji translator" icon={<Smile className="h-4 w-4" />}><EmojiTranslate /></Tile>
        <Tile title="14 · Aesthetic text" icon={<Wand2 className="h-4 w-4" />}><AestheticText /></Tile>
        <Tile title="15 · Username ideas" icon={<Bot className="h-4 w-4" />}><UsernameIdeas /></Tile>
        <Tile title="16 · Bio writer" icon={<MessageSquare className="h-4 w-4" />}><BioWriter /></Tile>
        <Tile title="17 · Hashtag forge" icon={<Hash className="h-4 w-4" />}><HashtagForge /></Tile>
        <Tile title="18 · QR generator" icon={<QrCode className="h-4 w-4" />}><QrGen /></Tile>
        <Tile title="19 · Color palette" icon={<Palette className="h-4 w-4" />}><PalettePicker /></Tile>
        <Tile title="20 · Gradient maker" icon={<Palette className="h-4 w-4" />}><GradientMaker /></Tile>
        <Tile title="21 · Tip calculator" icon={<Calculator className="h-4 w-4" />}><TipCalc /></Tile>
        <Tile title="22 · BMI calculator" icon={<Calculator className="h-4 w-4" />}><BmiCalc /></Tile>
        <Tile title="23 · Age in days" icon={<Calculator className="h-4 w-4" />}><AgeCalc /></Tile>
        <Tile title="24 · Password forge" icon={<Lock className="h-4 w-4" />}><PasswordGen /></Tile>
        <Tile title="25 · Reveal text" icon={<Eye className="h-4 w-4" />}><RevealText /></Tile>
        <Tile title="26 · Mood tracker" icon={<Smile className="h-4 w-4" />}><MoodTracker /></Tile>
        <Tile title="27 · Habit streak" icon={<Flame className="h-4 w-4" />}><HabitStreak /></Tile>
        <Tile title="28 · Goal progress" icon={<Trophy className="h-4 w-4" />}><GoalProgress /></Tile>
        <Tile title="29 · Quote of the day" icon={<Quote className="h-4 w-4" />}><QuoteOfDay /></Tile>
        <Tile title="30 · Truth or dare" icon={<Gamepad2 className="h-4 w-4" />}><TruthOrDare /></Tile>
        <Tile title="31 · Would you rather" icon={<Brain className="h-4 w-4" />}><WouldYouRather /></Tile>
        <Tile title="32 · Tap counter" icon={<Plus className="h-4 w-4" />}><TapCounter /></Tile>
        <Tile title="33 · Reaction test" icon={<Zap className="h-4 w-4" />}><ReactionTest /></Tile>
        <Tile title="34 · Memory match" icon={<Brain className="h-4 w-4" />}><MemoryGame /></Tile>
        <Tile title="35 · Caption shuffler" icon={<Shuffle className="h-4 w-4" />}><CaptionShuffler /></Tile>
        <Tile title="36 · Whisper mode" icon={<Volume2 className="h-4 w-4" />}><WhisperMode /></Tile>
        <Tile title="37 · Confession box" icon={<Lock className="h-4 w-4" />}><Confession /></Tile>
        <Tile title="38 · Compliment generator" icon={<Heart className="h-4 w-4" />}><Compliments /></Tile>
        <Tile title="39 · Roast me lite" icon={<Flame className="h-4 w-4" />}><RoastMe /></Tile>
        <Tile title="40 · Currency convert" icon={<Coins className="h-4 w-4" />}><CurrencyConvert /></Tile>
        <Tile title="41 · Weather mood" icon={<Cloud className="h-4 w-4" />}><WeatherMood /></Tile>
        <Tile title="42 · Star sign vibe" icon={<Star className="h-4 w-4" />}><StarSign /></Tile>
        <Tile title="43 · Sleep calculator" icon={<Moon className="h-4 w-4" />}><SleepCalc /></Tile>
        <Tile title="44 · Coffee tracker" icon={<Coffee className="h-4 w-4" />}><CoffeeTracker /></Tile>
        <Tile title="45 · Pizza splitter" icon={<Pizza className="h-4 w-4" />}><PizzaSplit /></Tile>
        <Tile title="46 · Mood music picker" icon={<Music2 className="h-4 w-4" />}><MoodMusic /></Tile>
        <Tile title="47 · Spin the bottle" icon={<RefreshCw className="h-4 w-4" />}><SpinBottle /></Tile>
        <Tile title="48 · Vibe check" icon={<Sparkles className="h-4 w-4" />}><VibeCheck /></Tile>
      </div>
    </div>
  );
}

function Tile({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="glass border border-white/10 rounded-2xl p-4 space-y-3"
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <span className="text-[var(--rizz-pink)]">{icon}</span>
        <span className="font-medium">{title}</span>
      </div>
      <div>{children}</div>
    </motion.div>
  );
}

/* ---------- helpers ---------- */
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const copy = (s: string) => { navigator.clipboard?.writeText(s); toast.success("Copied"); };

/* 01 */
function RizzMeter() {
  const [v, setV] = useState(0);
  return (
    <div className="space-y-2">
      <Button size="sm" className="bg-gradient-primary border-0" onClick={() => setV(Math.floor(Math.random() * 101))}>
        <Flame className="h-4 w-4 mr-1" /> Measure rizz
      </Button>
      <Progress value={v} />
      <p className="text-xs text-muted-foreground">Score: <b className="text-foreground">{v}/100</b> — {v > 80 ? "Unmatched aura" : v > 50 ? "Solid drip" : v > 20 ? "Warming up" : "Tap again"}</p>
    </div>
  );
}
/* 02 */
function PickupLines() {
  const lines = [
    "Are you a feed algorithm? Because you keep surfacing in my mind.",
    "If rizz were a currency, you'd be the central bank.",
    "You must be a notification — I never want to dismiss you.",
    "Are you a story? Because I'd watch you 24 hours straight.",
  ];
  const [l, setL] = useState(lines[0]);
  return (
    <div className="space-y-2">
      <p className="text-sm italic">"{l}"</p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setL(pick(lines))}><Shuffle className="h-3 w-3 mr-1" />New</Button>
        <Button size="sm" variant="ghost" onClick={() => copy(l)}><Copy className="h-3 w-3 mr-1" />Copy</Button>
      </div>
    </div>
  );
}
/* 03 */
function Compatibility() {
  const [a, setA] = useState(""); const [b, setB] = useState(""); const [s, setS] = useState<number | null>(null);
  const calc = () => {
    const sum = (a + b).toLowerCase().split("").reduce((n, c) => n + c.charCodeAt(0), 0);
    setS(sum % 101);
  };
  return (
    <div className="space-y-2">
      <Input placeholder="Name A" value={a} onChange={(e) => setA(e.target.value)} />
      <Input placeholder="Name B" value={b} onChange={(e) => setB(e.target.value)} />
      <Button size="sm" onClick={calc} className="bg-gradient-primary border-0"><Heart className="h-3 w-3 mr-1" />Calculate</Button>
      {s !== null && <p className="text-sm">Match: <b>{s}%</b></p>}
    </div>
  );
}
/* 04 */
function DailyVibe() {
  const vibes = ["Soft launch ✨", "Main character 💅", "Chaotic good 🔥", "Low-key icon 🌙", "Hyperpop hours 🎧"];
  const v = vibes[new Date().getDate() % vibes.length];
  return <p className="text-lg font-display">{v}</p>;
}
/* 05 */
function MagicBall() {
  const ans = ["Absolutely.", "Not today.", "Try again later.", "100% yes.", "Hard pass.", "The vibes say yes."];
  const [a, setA] = useState("Ask a question…");
  return (
    <div className="space-y-2">
      <div className="h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-transparent flex items-center justify-center text-sm font-medium">{a}</div>
      <Button size="sm" onClick={() => setA(pick(ans))} variant="outline"><Dice5 className="h-3 w-3 mr-1" />Shake</Button>
    </div>
  );
}
/* 06 */
function CoinFlip() {
  const [r, setR] = useState<"Heads" | "Tails" | null>(null);
  const [spin, setSpin] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <motion.div animate={{ rotateY: spin ? 720 : 0 }} transition={{ duration: 0.6 }} className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center font-bold text-primary-foreground">{r?.[0] ?? "?"}</motion.div>
      <Button size="sm" onClick={() => { setSpin(true); setTimeout(() => { setR(Math.random() < 0.5 ? "Heads" : "Tails"); setSpin(false); }, 600); }}>Flip</Button>
      {r && <span className="text-sm text-muted-foreground">{r}</span>}
    </div>
  );
}
/* 07 */
function DiceRoller() {
  const [d, setD] = useState([1, 1]);
  return (
    <div className="flex items-center gap-3">
      {d.map((n, i) => <div key={i} className="h-10 w-10 rounded-xl glass border border-white/10 flex items-center justify-center font-display text-lg">{n}</div>)}
      <Button size="sm" onClick={() => setD([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)])}>Roll</Button>
      <span className="text-sm text-muted-foreground">Σ {d[0] + d[1]}</span>
    </div>
  );
}
/* 08 */
function RandomPick() {
  const [t, setT] = useState("pizza, sushi, ramen, tacos");
  const [pick1, setPick1] = useState("");
  return (
    <div className="space-y-2">
      <Input value={t} onChange={(e) => setT(e.target.value)} placeholder="comma,separated,list" />
      <Button size="sm" onClick={() => setPick1(pick(t.split(",").map((x) => x.trim()).filter(Boolean)))}><Shuffle className="h-3 w-3 mr-1" />Pick</Button>
      {pick1 && <p className="text-sm">→ <b>{pick1}</b></p>}
    </div>
  );
}
/* 09 */
function Pomodoro() {
  const [sec, setSec] = useState(25 * 60); const [run, setRun] = useState(false);
  useEffect(() => { if (!run) return; const i = setInterval(() => setSec((s) => Math.max(0, s - 1)), 1000); return () => clearInterval(i); }, [run]);
  const mm = String(Math.floor(sec / 60)).padStart(2, "0"); const ss = String(sec % 60).padStart(2, "0");
  return (
    <div className="flex items-center gap-3">
      <span className="font-display text-2xl tabular-nums">{mm}:{ss}</span>
      <Button size="sm" onClick={() => setRun(!run)}>{run ? "Pause" : "Start"}</Button>
      <Button size="sm" variant="ghost" onClick={() => { setRun(false); setSec(25 * 60); }}>Reset</Button>
    </div>
  );
}
/* 10 */
function Countdown() {
  const [target, setTarget] = useState("");
  const [left, setLeft] = useState("");
  useEffect(() => {
    const i = setInterval(() => {
      if (!target) return;
      const ms = +new Date(target) - Date.now();
      if (ms <= 0) return setLeft("Now ✨");
      const d = Math.floor(ms / 86400000), h = Math.floor((ms / 3600000) % 24), m = Math.floor((ms / 60000) % 60);
      setLeft(`${d}d ${h}h ${m}m`);
    }, 1000);
    return () => clearInterval(i);
  }, [target]);
  return (
    <div className="space-y-2">
      <Input type="datetime-local" value={target} onChange={(e) => setTarget(e.target.value)} />
      {left && <p className="text-sm font-display">{left}</p>}
    </div>
  );
}
/* 11 */
function Stopwatch() {
  const [ms, setMs] = useState(0); const [run, setRun] = useState(false);
  useEffect(() => { if (!run) return; const t = Date.now() - ms; const i = setInterval(() => setMs(Date.now() - t), 50); return () => clearInterval(i); }, [run]);
  return (
    <div className="flex items-center gap-3">
      <span className="font-display text-xl tabular-nums">{(ms / 1000).toFixed(2)}s</span>
      <Button size="sm" onClick={() => setRun(!run)}>{run ? "Stop" : "Start"}</Button>
      <Button size="sm" variant="ghost" onClick={() => { setRun(false); setMs(0); }}>Reset</Button>
    </div>
  );
}
/* 12 */
function WordCounter() {
  const [t, setT] = useState("");
  const words = t.trim() ? t.trim().split(/\s+/).length : 0;
  return (
    <div className="space-y-2">
      <Textarea rows={3} placeholder="Paste text…" value={t} onChange={(e) => setT(e.target.value)} />
      <div className="flex gap-3 text-xs text-muted-foreground">
        <span>Words: <b className="text-foreground">{words}</b></span>
        <span>Chars: <b className="text-foreground">{t.length}</b></span>
      </div>
    </div>
  );
}
/* 13 */
function EmojiTranslate() {
  const map: Record<string, string> = { love: "❤️", fire: "🔥", happy: "😄", sad: "😢", party: "🎉", star: "⭐", coffee: "☕", pizza: "🍕", music: "🎵", cool: "😎" };
  const [t, setT] = useState("");
  const out = t.split(/\s+/).map((w) => map[w.toLowerCase()] ?? w).join(" ");
  return (
    <div className="space-y-2">
      <Input value={t} onChange={(e) => setT(e.target.value)} placeholder="love fire pizza" />
      <p className="text-lg">{out || "—"}</p>
    </div>
  );
}
/* 14 */
function AestheticText() {
  const [t, setT] = useState("rizz");
  const wide = t.split("").map((c) => String.fromCharCode(c.charCodeAt(0) > 32 && c.charCodeAt(0) < 127 ? c.charCodeAt(0) + 0xfee0 : c.charCodeAt(0))).join("");
  return (
    <div className="space-y-2">
      <Input value={t} onChange={(e) => setT(e.target.value)} />
      <p className="font-display text-lg">{wide}</p>
      <Button size="sm" variant="ghost" onClick={() => copy(wide)}><Copy className="h-3 w-3 mr-1" />Copy</Button>
    </div>
  );
}
/* 15 */
function UsernameIdeas() {
  const adj = ["neon", "lush", "midnight", "feral", "hyper", "soft", "wild", "lo-fi"];
  const noun = ["fox", "ghost", "comet", "venom", "halo", "rose", "ember", "drift"];
  const [list, setList] = useState<string[]>([]);
  return (
    <div className="space-y-2">
      <Button size="sm" onClick={() => setList(Array.from({ length: 6 }, () => `${pick(adj)}_${pick(noun)}${Math.floor(Math.random() * 99)}`))}><Bot className="h-3 w-3 mr-1" />Generate</Button>
      <div className="flex flex-wrap gap-1.5">{list.map((u) => <Badge key={u} variant="outline" className="cursor-pointer" onClick={() => copy(u)}>@{u}</Badge>)}</div>
    </div>
  );
}
/* 16 */
function BioWriter() {
  const parts = [["chaos coordinator", "vibe curator", "night owl", "soft launcher"], ["☕ over 9000", "🎧 always", "💌 dm me", "✨ pls"], ["she/her", "they/them", "he/him", "any/all"]];
  const [b, setB] = useState("");
  return (
    <div className="space-y-2">
      <Button size="sm" onClick={() => setB(parts.map(pick).join(" · "))}><Wand2 className="h-3 w-3 mr-1" />Write bio</Button>
      {b && <><p className="text-sm">{b}</p><Button size="sm" variant="ghost" onClick={() => copy(b)}><Copy className="h-3 w-3 mr-1" />Copy</Button></>}
    </div>
  );
}
/* 17 */
function HashtagForge() {
  const [topic, setTopic] = useState("rizz"); const [out, setOut] = useState<string[]>([]);
  const mods = ["daily", "core", "club", "vibes", "energy", "szn", "world", "tok", "gang", "era"];
  return (
    <div className="space-y-2">
      <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
      <Button size="sm" onClick={() => setOut(mods.slice(0, 8).map((m) => `#${topic}${m}`))}><Hash className="h-3 w-3 mr-1" />Forge</Button>
      {out.length > 0 && <p className="text-xs text-muted-foreground cursor-pointer" onClick={() => copy(out.join(" "))}>{out.join(" ")}</p>}
    </div>
  );
}
/* 18 */
function QrGen() {
  const [t, setT] = useState("https://lovable.dev");
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&bgcolor=0f0f0f&color=ff2d92&data=${encodeURIComponent(t)}`;
  return (
    <div className="space-y-2">
      <Input value={t} onChange={(e) => setT(e.target.value)} />
      <img src={url} alt="qr" className="rounded-lg border border-white/10" width={140} height={140} />
    </div>
  );
}
/* 19 */
function PalettePicker() {
  const [seed, setSeed] = useState(0);
  const cols = useMemo(() => Array.from({ length: 5 }, () => `hsl(${Math.floor(Math.random() * 360)} 80% 60%)`), [seed]);
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">{cols.map((c, i) => <div key={i} className="flex-1 h-12 rounded-lg cursor-pointer" style={{ background: c }} onClick={() => copy(c)} />)}</div>
      <Button size="sm" onClick={() => setSeed(seed + 1)}><Shuffle className="h-3 w-3 mr-1" />Generate</Button>
    </div>
  );
}
/* 20 */
function GradientMaker() {
  const [a, setA] = useState("#ff2d92"); const [b, setB] = useState("#7c3aed");
  const css = `linear-gradient(135deg, ${a}, ${b})`;
  return (
    <div className="space-y-2">
      <div className="h-16 rounded-xl" style={{ background: css }} />
      <div className="flex gap-2"><Input type="color" value={a} onChange={(e) => setA(e.target.value)} className="h-9 w-14 p-1" /><Input type="color" value={b} onChange={(e) => setB(e.target.value)} className="h-9 w-14 p-1" /><Button size="sm" variant="ghost" onClick={() => copy(css)}><Copy className="h-3 w-3" /></Button></div>
    </div>
  );
}
/* 21 */
function TipCalc() {
  const [bill, setBill] = useState(50); const [pct, setPct] = useState(18);
  return (
    <div className="space-y-2">
      <Input type="number" value={bill} onChange={(e) => setBill(+e.target.value)} />
      <div className="text-xs">Tip {pct}%</div>
      <Slider value={[pct]} onValueChange={(v) => setPct(v[0])} min={0} max={30} step={1} />
      <p className="text-sm">Tip <b>${(bill * pct / 100).toFixed(2)}</b> · Total <b>${(bill * (1 + pct / 100)).toFixed(2)}</b></p>
    </div>
  );
}
/* 22 */
function BmiCalc() {
  const [kg, setKg] = useState(70); const [cm, setCm] = useState(175);
  const bmi = kg / Math.pow(cm / 100, 2);
  return (
    <div className="space-y-2">
      <div className="flex gap-2"><Input type="number" value={kg} onChange={(e) => setKg(+e.target.value)} placeholder="kg" /><Input type="number" value={cm} onChange={(e) => setCm(+e.target.value)} placeholder="cm" /></div>
      <p className="text-sm">BMI <b>{bmi.toFixed(1)}</b></p>
    </div>
  );
}
/* 23 */
function AgeCalc() {
  const [d, setD] = useState("");
  const days = d ? Math.floor((Date.now() - +new Date(d)) / 86400000) : 0;
  return (
    <div className="space-y-2">
      <Input type="date" value={d} onChange={(e) => setD(e.target.value)} />
      {d && <p className="text-sm">You've lived <b>{days.toLocaleString()}</b> days ✨</p>}
    </div>
  );
}
/* 24 */
function PasswordGen() {
  const [len, setLen] = useState(16); const [p, setP] = useState("");
  const gen = () => {
    const c = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
    setP(Array.from({ length: len }, () => c[Math.floor(Math.random() * c.length)]).join(""));
  };
  return (
    <div className="space-y-2">
      <div className="text-xs">Length {len}</div>
      <Slider value={[len]} onValueChange={(v) => setLen(v[0])} min={8} max={32} step={1} />
      <div className="flex gap-2"><Button size="sm" onClick={gen}><Lock className="h-3 w-3 mr-1" />Generate</Button>{p && <Button size="sm" variant="ghost" onClick={() => copy(p)}><Copy className="h-3 w-3" /></Button>}</div>
      {p && <code className="block text-xs glass rounded p-2 break-all">{p}</code>}
    </div>
  );
}
/* 25 */
function RevealText() {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-2">
      <div className="glass rounded-xl p-3 select-none">
        {show ? <p className="text-sm">Your rizz today is unmatched. ❤️‍🔥</p> : <p className="text-sm blur-sm">████████ ███ ████████ ██</p>}
      </div>
      <Button size="sm" variant="outline" onClick={() => setShow(!show)}>{show ? <><EyeOff className="h-3 w-3 mr-1" />Hide</> : <><Eye className="h-3 w-3 mr-1" />Reveal</>}</Button>
    </div>
  );
}
/* 26 */
function MoodTracker() {
  const moods = ["😄", "😐", "😢", "😡", "🥰", "😴"]; const [m, setM] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">{moods.map((x) => <button key={x} onClick={() => { setM(x); toast.success("Logged " + x); }} className={`h-9 w-9 rounded-xl text-lg glass border ${m === x ? "border-[var(--rizz-pink)]" : "border-white/10"}`}>{x}</button>)}</div>
      {m && <p className="text-xs text-muted-foreground">Today: {m}</p>}
    </div>
  );
}
/* 27 */
function HabitStreak() {
  const [days, setDays] = useState(0);
  return (
    <div className="flex items-center gap-3">
      <div className="font-display text-3xl">🔥 {days}</div>
      <Button size="sm" onClick={() => setDays(days + 1)}>+ Day</Button>
      <Button size="sm" variant="ghost" onClick={() => setDays(0)}>Reset</Button>
    </div>
  );
}
/* 28 */
function GoalProgress() {
  const [v, setV] = useState(40);
  return (
    <div className="space-y-2">
      <Progress value={v} />
      <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setV(Math.max(0, v - 10))}><Minus className="h-3 w-3" /></Button><Button size="sm" variant="outline" onClick={() => setV(Math.min(100, v + 10))}><Plus className="h-3 w-3" /></Button><span className="text-sm self-center">{v}%</span></div>
    </div>
  );
}
/* 29 */
function QuoteOfDay() {
  const qs = ["Touch grass, then touch greatness.", "Soft life, hard launch.", "Be unapologetically loud.", "Energy speaks louder than captions."];
  const q = qs[new Date().getDay() % qs.length];
  return <p className="italic text-sm">"{q}"</p>;
}
/* 30 */
function TruthOrDare() {
  const t = ["Last DM you sent?", "Biggest ick?", "Crush's initials?", "Most-replayed song?"];
  const d = ["Post a selfie now.", "Send a voice note saying hi.", "Change your bio for 1h.", "Like 5 old posts."];
  const [mode, setMode] = useState<"t" | "d">("t"); const [cur, setCur] = useState(t[0]);
  return (
    <div className="space-y-2">
      <p className="text-sm">{cur}</p>
      <div className="flex gap-2"><Button size="sm" onClick={() => { setMode("t"); setCur(pick(t)); }}>Truth</Button><Button size="sm" variant="outline" onClick={() => { setMode("d"); setCur(pick(d)); }}>Dare</Button></div>
    </div>
  );
}
/* 31 */
function WouldYouRather() {
  const opts = [["Read minds", "Be invisible"], ["No music for a year", "No social for a year"], ["Always late", "Always early"], ["Famous online", "Rich offline"]];
  const [o, setO] = useState(opts[0]);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2"><Button size="sm" variant="outline">{o[0]}</Button><Button size="sm" variant="outline">{o[1]}</Button></div>
      <Button size="sm" variant="ghost" onClick={() => setO(pick(opts))}><Shuffle className="h-3 w-3 mr-1" />New</Button>
    </div>
  );
}
/* 32 */
function TapCounter() {
  const [n, setN] = useState(0);
  return (
    <div className="flex items-center gap-3">
      <button onClick={() => setN(n + 1)} className="h-16 w-16 rounded-full bg-gradient-primary shadow-glow text-primary-foreground font-display text-2xl">{n}</button>
      <Button size="sm" variant="ghost" onClick={() => setN(0)}>Reset</Button>
    </div>
  );
}
/* 33 */
function ReactionTest() {
  const [state, setState] = useState<"idle" | "wait" | "now" | "done">("idle"); const [start, setStart] = useState(0); const [ms, setMs] = useState(0);
  const begin = () => { setState("wait"); setTimeout(() => { setStart(performance.now()); setState("now"); }, 1000 + Math.random() * 2000); };
  const tap = () => { if (state === "now") { setMs(Math.round(performance.now() - start)); setState("done"); } };
  return (
    <div className="space-y-2">
      <button onClick={state === "idle" || state === "done" ? begin : tap} className={`h-16 w-full rounded-xl font-medium ${state === "now" ? "bg-[var(--rizz-pink)] text-white" : state === "wait" ? "bg-yellow-500/30" : "glass border border-white/10"}`}>
        {state === "idle" ? "Start" : state === "wait" ? "Wait…" : state === "now" ? "TAP!" : `${ms}ms — again?`}
      </button>
    </div>
  );
}
/* 34 */
function MemoryGame() {
  const emojis = ["🌸", "🔥", "🎧", "💎", "👾", "🌙"];
  const [deck, setDeck] = useState(() => shuffle([...emojis, ...emojis]));
  const [flipped, setFlipped] = useState<number[]>([]); const [done, setDone] = useState<number[]>([]);
  function shuffle<T>(a: T[]) { return [...a].sort(() => Math.random() - 0.5); }
  useEffect(() => {
    if (flipped.length === 2) {
      const [a, b] = flipped;
      if (deck[a] === deck[b]) setDone((d) => [...d, a, b]);
      const t = setTimeout(() => setFlipped([]), 700);
      return () => clearTimeout(t);
    }
  }, [flipped, deck]);
  const reset = () => { setDeck(shuffle([...emojis, ...emojis])); setFlipped([]); setDone([]); };
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-1.5">
        {deck.map((e, i) => {
          const open = flipped.includes(i) || done.includes(i);
          return <button key={i} disabled={open || flipped.length === 2} onClick={() => setFlipped((f) => [...f, i])} className={`h-10 rounded-lg ${open ? "bg-gradient-primary text-primary-foreground" : "glass border border-white/10"}`}>{open ? e : "?"}</button>;
        })}
      </div>
      <Button size="sm" variant="ghost" onClick={reset}><RefreshCw className="h-3 w-3 mr-1" />Restart</Button>
    </div>
  );
}
/* 35 */
function CaptionShuffler() {
  const caps = ["lost in the algorithm 🌀", "soft launch, hard fall 🤍", "main character behavior 💅", "no thoughts, just rizz 🧠", "running on caffeine + chaos ☕"];
  const [c, setC] = useState(caps[0]);
  return (
    <div className="space-y-2">
      <p className="text-sm">{c}</p>
      <div className="flex gap-2"><Button size="sm" onClick={() => setC(pick(caps))}><Shuffle className="h-3 w-3 mr-1" />New</Button><Button size="sm" variant="ghost" onClick={() => copy(c)}><Copy className="h-3 w-3" /></Button></div>
    </div>
  );
}
/* 36 */
function WhisperMode() {
  const [on, setOn] = useState(false);
  return (
    <div className="flex items-center justify-between">
      <div><p className="text-sm font-medium">Whisper mode</p><p className="text-xs text-muted-foreground">Dim non-essentials</p></div>
      <Switch checked={on} onCheckedChange={(v) => { setOn(v); document.body.style.filter = v ? "brightness(0.85) contrast(0.95)" : ""; }} />
    </div>
  );
}
/* 37 */
function Confession() {
  const [t, setT] = useState(""); const [sent, setSent] = useState(false);
  return (
    <div className="space-y-2">
      {sent ? <p className="text-sm text-[var(--rizz-pink)]">Locked & sealed 💌</p> : (
        <>
          <Textarea rows={2} placeholder="Anonymous thought…" value={t} onChange={(e) => setT(e.target.value)} />
          <Button size="sm" onClick={() => { if (t.trim()) { setSent(true); toast.success("Stored locally"); } }}><Send className="h-3 w-3 mr-1" />Seal</Button>
        </>
      )}
    </div>
  );
}
/* 38 */
function Compliments() {
  const cs = ["You bring main-character energy to every room.", "Your timeline is a vibe sanctuary.", "Even your typos slap.", "You make Mondays look like Saturdays."];
  const [c, setC] = useState(cs[0]);
  return <div className="space-y-2"><p className="text-sm">{c}</p><Button size="sm" onClick={() => setC(pick(cs))}><Heart className="h-3 w-3 mr-1" />More love</Button></div>;
}
/* 39 */
function RoastMe() {
  const rs = ["Your playlist is a cry for help.", "Even your shadow left on read.", "You're the reason captchas exist.", "Your aura needs a software update."];
  const [r, setR] = useState(rs[0]);
  return <div className="space-y-2"><p className="text-sm">{r}</p><Button size="sm" variant="outline" onClick={() => setR(pick(rs))}><Flame className="h-3 w-3 mr-1" />Roast</Button></div>;
}
/* 40 */
function CurrencyConvert() {
  const [usd, setUsd] = useState(10); const rates: Record<string, number> = { EUR: 0.92, GBP: 0.78, JPY: 155, INR: 84, BRL: 5.1 };
  return (
    <div className="space-y-2">
      <Input type="number" value={usd} onChange={(e) => setUsd(+e.target.value)} />
      <div className="grid grid-cols-2 gap-1 text-xs">{Object.entries(rates).map(([k, v]) => <div key={k} className="glass rounded px-2 py-1">{k} {(usd * v).toFixed(2)}</div>)}</div>
    </div>
  );
}
/* 41 */
function WeatherMood() {
  const map = [{ e: "☀️", m: "Solar main-character day" }, { e: "🌧️", m: "Lo-fi journaling weather" }, { e: "❄️", m: "Hot cocoa, soft launch" }, { e: "🌪️", m: "Chaos era unlocked" }];
  const [i, setI] = useState(0);
  return <div className="flex items-center gap-3"><div className="text-3xl">{map[i].e}</div><div className="flex-1 text-sm">{map[i].m}</div><Button size="sm" variant="ghost" onClick={() => setI((i + 1) % map.length)}><Shuffle className="h-3 w-3" /></Button></div>;
}
/* 42 */
function StarSign() {
  const signs = ["♈ Aries", "♉ Taurus", "♊ Gemini", "♋ Cancer", "♌ Leo", "♍ Virgo", "♎ Libra", "♏ Scorpio", "♐ Sagittarius", "♑ Capricorn", "♒ Aquarius", "♓ Pisces"];
  const [m, setM] = useState(0);
  return (
    <div className="space-y-2">
      <Slider value={[m]} onValueChange={(v) => setM(v[0])} min={0} max={11} step={1} />
      <p className="text-sm">{signs[m]} — today: trust the chaos.</p>
    </div>
  );
}
/* 43 */
function SleepCalc() {
  const [wake, setWake] = useState("07:00");
  const cycles = useMemo(() => {
    if (!wake) return [];
    const [h, m] = wake.split(":").map(Number);
    const d = new Date(); d.setHours(h, m, 0, 0);
    return [6, 5, 4].map((c) => { const x = new Date(d.getTime() - c * 90 * 60000); return `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")} (${c} cycles)`; });
  }, [wake]);
  return (
    <div className="space-y-2">
      <Input type="time" value={wake} onChange={(e) => setWake(e.target.value)} />
      <ul className="text-xs space-y-0.5">{cycles.map((c) => <li key={c}>💤 Bed at {c}</li>)}</ul>
    </div>
  );
}
/* 44 */
function CoffeeTracker() {
  const [c, setC] = useState(0);
  return (
    <div className="flex items-center gap-3">
      <div className="font-display text-2xl">☕ × {c}</div>
      <Button size="sm" onClick={() => setC(c + 1)}>+ Cup</Button>
      <Button size="sm" variant="ghost" onClick={() => setC(0)}>Reset</Button>
      {c > 4 && <span className="text-xs text-yellow-400">jittery zone</span>}
    </div>
  );
}
/* 45 */
function PizzaSplit() {
  const [people, setPeople] = useState(4); const [slices, setSlices] = useState(8);
  return (
    <div className="space-y-2">
      <div className="flex gap-2"><Input type="number" value={people} onChange={(e) => setPeople(+e.target.value)} /><Input type="number" value={slices} onChange={(e) => setSlices(+e.target.value)} /></div>
      <p className="text-sm">🍕 <b>{(slices / Math.max(1, people)).toFixed(1)}</b> slices per person</p>
    </div>
  );
}
/* 46 */
function MoodMusic() {
  const map: Record<string, string> = { happy: "Hyperpop", sad: "Sad-girl indie", focus: "Lo-fi beats", hype: "Phonk", chill: "Bossa nova" };
  const [m, setM] = useState("happy");
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">{Object.keys(map).map((k) => <Button key={k} size="sm" variant={m === k ? "default" : "outline"} onClick={() => setM(k)}>{k}</Button>)}</div>
      <p className="text-sm">🎵 Try: <b>{map[m]}</b></p>
    </div>
  );
}
/* 47 */
function SpinBottle() {
  const [a, setA] = useState(0);
  return (
    <div className="flex items-center gap-3">
      <motion.div animate={{ rotate: a }} transition={{ duration: 1.2, ease: "easeOut" }} className="h-16 w-16 rounded-full bg-gradient-primary flex items-center justify-center text-2xl">🍾</motion.div>
      <Button size="sm" onClick={() => setA(a + 720 + Math.floor(Math.random() * 360))}>Spin</Button>
    </div>
  );
}
/* 48 */
function VibeCheck() {
  const [v, setV] = useState<string | null>(null);
  const vibes = ["✅ Vibes immaculate", "⚠️ Vibes recoverable", "❌ Vibes in shambles"];
  return (
    <div className="space-y-2">
      <Button size="sm" className="bg-gradient-primary border-0" onClick={() => setV(pick(vibes))}><Sparkles className="h-3 w-3 mr-1" />Check</Button>
      {v && <p className="text-sm font-medium">{v}</p>}
    </div>
  );
}