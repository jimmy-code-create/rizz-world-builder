import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Gamepad2,
  Headphones,
  Maximize2,
  Play,
  Plus,
  Search,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { GameIcon } from "@/components/GameIcon";
import { GamePlayOverlay } from "@/components/games/GamePlayOverlay";
import { useVoiceCallContext } from "@/components/voice/VoiceCallProvider";
import {
  getGames,
  inviteText,
  launchUrl,
  makeRoomCode,
  useRoomActivity,
  type GameEntry,
} from "@/lib/activities";

export const Route = createFileRoute("/_app/games")({
  head: () => ({ meta: [{ title: "Games · RIZZ" }] }),
  component: GamesHub,
});

type Filter = "all" | "instant" | "arcade" | "board" | "puzzle" | "party" | "web";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "instant", label: "Instant play" },
  { id: "arcade", label: "Action" },
  { id: "board", label: "Board games" },
  { id: "puzzle", label: "Puzzles" },
  { id: "party", label: "Party" },
  { id: "web", label: "Web games" },
];

function matchesFilter(entry: GameEntry, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "instant") return entry.instant;
  if (filter === "web") return entry.source === "web";
  return entry.category === filter;
}

/**
 * THE GAMES HUB — Discord-style activities, one tap from the call.
 *
 * Two promises are made on every card and both are true: instant play (built-in
 * games really do start on tap with no account) and fullscreen (the surface can
 * fill the screen, and inside a call it becomes the background with voice
 * floating on top). Launching from here while in a voice channel starts the
 * activity for the whole room, which is what makes it a group thing.
 */
function GamesHub() {
  const { user, profile } = useAuth();
  const { call, openView, participants } = useVoiceCallContext();
  const me = user
    ? { id: user.id, name: profile?.display_name || profile?.username || "Someone" }
    : null;
  // A watcher, not a player: no `playing` argument, so this screen never claims
  // that someone is in a game they merely started.
  const roomActivity = useRoomActivity(call?.roomId ?? null, me);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<GameEntry | null>(null);

  const games = useMemo(() => getGames(), []);
  const visible = useMemo(
    () =>
      games.filter(
        (entry) =>
          matchesFilter(entry, filter) &&
          (!query.trim() ||
            `${entry.name} ${entry.description} ${entry.hook ?? ""}`
              .toLowerCase()
              .includes(query.trim().toLowerCase())),
      ),
    [games, filter, query],
  );

  const live = roomActivity.activity;
  const livePlayers = Object.keys(roomActivity.players).length;
  const inCall = !!call?.roomId && !!user;
  const builtinCount = games.filter((entry) => entry.source === "builtin").length;

  const play = async (entry: GameEntry) => {
    if (inCall) {
      const started = await roomActivity.start(entry);
      if (!started) {
        toast.error("That game could not start — try again in the voice channel.");
        return;
      }
      toast.success(`${entry.name} is live in ${call?.channelName}`, {
        description: "Voice stays on top of the game — everyone gets a Join banner.",
      });
      openView();
      return;
    }

    if (entry.instant) {
      setPlaying(entry);
      return;
    }

    const code = entry.type === "embed" || entry.sharedCode === false ? null : makeRoomCode();
    const url = launchUrl(entry, code);
    try {
      if (entry.type !== "embed") await navigator.clipboard.writeText(inviteText(entry, code));
    } catch {
      /* the clipboard is a nicety on top of the window that opens */
    }
    window.open(url, "_blank", "noopener,noreferrer");
    toast.info(`${entry.name} opened in a new tab`, {
      description:
        entry.type === "embed" ? undefined : "The invite link was copied — paste it in chat.",
    });
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-3 sm:px-4 md:py-5">
      {/* ---- hero ---------------------------------------------------------- */}
      <section className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="flex flex-wrap items-start gap-3 p-4 sm:p-5">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
              Activities
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Game Hub
            </h1>
            <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
              {builtinCount} games ship inside RIZZ — chess and checkers, arena action, puzzles —
              plus web classics like skribbl. No sign-up, no lobby, no download: tap one and it
              starts, full screen, with your voice on top.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                <Zap className="h-3.5 w-3.5 text-primary" /> Instant play
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                <Maximize2 className="h-3.5 w-3.5 text-primary" /> Fullscreen
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                <Headphones className="h-3.5 w-3.5 text-primary" /> Voice stays on top
              </span>
            </div>
          </div>
          <div className="w-full shrink-0 sm:w-auto">
            {inCall ? (
              <div className="rounded-2xl border border-primary/40 bg-primary/10 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                  In call
                </p>
                <p className="mt-0.5 truncate text-sm font-bold">{call?.channelName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {Math.max(0, participants.length)} connected · launching drops everyone into the
                  game
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  No call
                </p>
                <p className="mt-0.5 text-sm font-semibold">Play solo right now</p>
                <Link
                  to="/realms"
                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                >
                  Join a voice channel to play together <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---- live strip ---------------------------------------------------- */}
      {live && (
        <section className="mt-3">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/40 bg-primary/[0.08] p-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/15">
              <GameIcon icon={live.gameIcon} size={26} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> Live in voice
              </p>
              <p className="truncate text-sm font-bold">
                {live.gameName}
                {live.roomCode ? (
                  <span className="ml-2 font-mono text-primary">{live.roomCode}</span>
                ) : null}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                Started by {live.startedByName} · {livePlayers} playing
                {live.source === "builtin" ? " · runs in-app" : " · external room"}
              </p>
            </div>
            <button
              type="button"
              onClick={openView}
              className="h-11 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:brightness-105 active:scale-95"
            >
              Jump back in
            </button>
            {live.startedBy === user?.id && (
              <button
                type="button"
                onClick={() => void roomActivity.end()}
                className="h-11 rounded-full border border-border px-4 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
              >
                End
              </button>
            )}
          </div>
        </section>
      )}

      {/* ---- filters ------------------------------------------------------- */}
      <section className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                filter === option.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="ml-auto flex min-w-[180px] flex-1 items-center gap-2 rounded-full border border-border px-3 py-1.5 sm:max-w-xs">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search games"
            aria-label="Search games"
            className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
        </label>
      </section>

      {/* ---- game cards ---------------------------------------------------- */}
      <section className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((game) => (
          <GameCard key={game.id} game={game} inCall={inCall} onPlay={() => void play(game)} />
        ))}
      </section>

      {visible.length === 0 && (
        <p className="mt-3 rounded-2xl border border-border bg-card p-5 text-center text-sm text-muted-foreground">
          No games match that. Try another filter.
        </p>
      )}

      {/* ---- how it works -------------------------------------------------- */}
      <section className="mt-5">
        <h2 className="font-display text-lg font-bold">How activities work</h2>
        <div className="mt-2 grid gap-2.5 sm:grid-cols-3">
          <Step
            icon={<Headphones className="h-4 w-4 text-primary" />}
            title="1 · Hop in voice"
            body="Open a realm's voice channel. The call keeps running behind everything from here on."
          />
          <Step
            icon={<Play className="h-4 w-4 text-primary" />}
            title="2 · Launch a game"
            body="Tap Play in call. The game becomes the background and everyone gets a Join banner."
          />
          <Step
            icon={<Users className="h-4 w-4 text-primary" />}
            title="3 · Talk over it"
            body="Mute, deafen, see who is talking and leave — all from the dock floating over the game."
          />
        </div>
      </section>

      <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          Want a game from somewhere else? Add it to{" "}
          <span className="font-mono text-foreground">src/data/games.json</span> — it shows up here
          and in the call immediately, with its own room code handling.
        </p>
        <Link
          to="/bots/developer"
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-bold text-muted-foreground transition hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Developer tools
        </Link>
      </section>

      {playing && <GamePlayOverlay entry={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}

function GameCard({
  game,
  inCall,
  onPlay,
}: {
  game: GameEntry;
  inCall: boolean;
  onPlay: () => void;
}) {
  const accent = game.accent ?? "var(--primary)";
  const cta = inCall ? "Play in call" : game.instant ? "Play now" : "Play on the web";
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:border-primary/40">
      <div className="flex items-start gap-3 p-3">
        <span
          aria-hidden
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border"
          style={{ borderColor: `${accent}44`, background: `${accent}14` }}
        >
          <GameIcon icon={game.icon} size={30} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-base font-bold">{game.name}</h3>
            {game.instant && (
              <span
                className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: `${accent}1f`, color: accent }}
              >
                <Zap className="h-2.5 w-2.5" /> No sign-up
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{game.description}</p>
          {game.hook && (
            <p className="mt-1 truncate text-[11px] font-semibold text-foreground/80">
              {game.hook}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2 text-[10px] font-semibold text-muted-foreground">
        <span className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
          <Users className="h-3 w-3" /> {game.players}
        </span>
        <span className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
          <Maximize2 className="h-3 w-3" /> Fullscreen
        </span>
        <span className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
          {game.source === "builtin" ? (
            <>
              <Sparkles className="h-3 w-3" /> Runs in RIZZ
            </>
          ) : (
            <>
              <Gamepad2 className="h-3 w-3" /> Web game
            </>
          )}
        </span>
      </div>

      <div className="mt-auto flex items-center gap-2 border-t border-border p-3">
        {game.controls && (
          <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
            {game.controls}
          </p>
        )}
        <button
          type="button"
          onClick={onPlay}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:brightness-105 active:scale-95"
        >
          <Play className="h-4 w-4 fill-current" /> {cta}
        </button>
      </div>
    </article>
  );
}

function Step({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/15">{icon}</span>
      <p className="mt-2 text-sm font-bold">{title}</p>
      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{body}</p>
    </div>
  );
}
