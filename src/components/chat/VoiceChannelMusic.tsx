import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ListMusic,
  Loader2,
  Music,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MusicSheet } from "@/components/chat/MusicSheet";
import { MusicPlayer, queueTrackToMusic, type MusicPlayerController } from "@/components/music/MusicPlayer";
import { fetchRealmBots, realmBotsKey } from "@/lib/bots";
import { formatDuration, musicQueueKey, runMusicCommand, useMusicQueue } from "@/lib/music";
import { MUSIC_PROVIDERS, detectMusicSource } from "@/lib/music-sources";
import { useMusicBotInCall, musicBotControls } from "@/components/voice/MusicBotInCall";

/**
 * MUSIC BOT inside a voice channel.
 *
 * The bot is a voice-channel feature: the queue lives on the voice room and
 * `/play` is refused everywhere else (music_add checks the room kind). A voice
 * channel has no composer, so this panel is where `/play` is typed: a song name,
 * a YouTube link, an Apple Music link, or a direct audio file.
 *
 * Playback uses the unified `MusicPlayer`, so the panel and the in-call bot
 * share one implementation and every provider behaves the same. The panel never
 * autoplays, and it steps aside while the bot itself is singing in this
 * channel's call so the same song is never heard twice.
 */
export function VoiceChannelMusic({ realmId, roomId }: { realmId: string; roomId: string }) {
  const qc = useQueryClient();
  const bots = useQuery({ queryKey: realmBotsKey(realmId), queryFn: () => fetchRealmBots(realmId) });
  const bot = (bots.data?.bots ?? []).find((entry) => entry.name === "MUSIC BOT");
  const canUse = !!bot?.enabled;

  const queue = useMusicQueue(realmId, roomId, canUse);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<"play" | "skip" | "stop" | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Per-listener playback preferences: the bot plays the queue in order, these
  // only shape what *you* hear in the panel.
  const [loop, setLoop] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(1);
  const controller = useRef<MusicPlayerController | null>(null);

  // When the bot is riding in this channel's call, the panel says so — the bot
  // is a participant now, not just a queue.
  const botInCall = useMusicBotInCall();

  const tracks = queue.data ?? [];
  const current = tracks[0] ?? null;
  const currentInput = queueTrackToMusic(current);
  const upcoming = tracks.slice(1);
  const provider = MUSIC_PROVIDERS[detectMusicSource(current?.url ?? current?.preview_url)?.kind ?? "apple"];
  const singingHere = botInCall.enabled && !!botInCall.track && botInCall.track.id === current?.id;

  // MUSIC BOT sings a track through the call's own player. The panel's local
  // player must step aside at that point, or the same song plays twice.
  useEffect(() => {
    if (!singingHere) return;
    controller.current?.pause();
  }, [singingHere]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const song = query.trim().replace(/^\/play\s+/i, "").trim();
    if (!song || busy) return;
    setBusy("play");
    try {
      const result = await runMusicCommand("play", { args: song, realmId, roomId });
      if (!result.ok) throw new Error(result.error || `No song found for "${song}"`);
      toast.success(result.body || `Queued ${song}`);
      setQuery("");
      await qc.invalidateQueries({ queryKey: musicQueueKey(realmId, roomId) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The music bot didn't answer");
    } finally {
      setBusy(null);
    }
  };

  const run = useCallback(
    async (command: "skip" | "stop") => {
      setBusy(command);
      try {
        const result = await runMusicCommand(command, { args: "", realmId, roomId });
        if (!result.ok) throw new Error(result.error || "The music bot didn't answer");
        toast.success(result.body || (command === "skip" ? "Skipped." : "Queue cleared."));
        await qc.invalidateQueries({ queryKey: musicQueueKey(realmId, roomId) });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "The music bot didn't answer");
      } finally {
        setBusy(null);
      }
    },
    [qc, realmId, roomId],
  );

  // The queue has no history, so "previous" restarts the current track — the
  // standard behaviour for a player with nothing behind it.
  const previous = () => {
    if (botInCall.singing) {
      musicBotControls.seek(0);
      return;
    }
    controller.current?.seekTo(0);
  };

  // A new order every time shuffle is switched on (or tapped again), so it
  // never looks randomised but frozen.
  const orderedUpcoming = useMemo(
    () => (shuffle ? seededShuffle(upcoming, shuffleSeed) : upcoming),
    [shuffle, upcoming, shuffleSeed],
  );

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Music className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
            Music bot
            <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-px text-[9px] font-semibold normal-case tracking-normal text-primary">
              voice only
            </span>
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {canUse
              ? tracks.length === 0
                ? "Nothing queued — paste a YouTube, Apple or audio link below."
                : `${tracks.length} song${tracks.length === 1 ? "" : "s"} in this channel's queue`
              : bot
                ? "MUSIC BOT is switched off for this realm"
                : "Add MUSIC BOT to this realm to play music here"}
          </p>
        </div>
        {canUse && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 shrink-0 gap-1.5 border-white/10 bg-white/5 text-xs"
            onClick={() => setSheetOpen(true)}
          >
            <ListMusic className="h-3.5 w-3.5" /> Queue
          </Button>
        )}
      </div>

      {canUse && current && (
        <>
          <div className="mt-3">
            <MusicPlayer
              track={currentInput}
              realmId={realmId}
              loop={loop}
              showVolume
              onEnded={() => void run("skip")}
              controllerRef={(next) => {
                controller.current = next;
              }}
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={previous}
              aria-label="Restart the current track"
              className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-foreground"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => void run("skip")}
              className="h-9 shrink-0 gap-1.5 border-white/10 bg-white/5 text-xs"
            >
              {busy === "skip" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SkipForward className="h-3.5 w-3.5" />}
              Skip
            </Button>
            <Button
              type="button"
              variant={loop ? "default" : "ghost"}
              size="sm"
              aria-pressed={loop}
              onClick={() => setLoop((value) => !value)}
              className={`h-9 w-9 shrink-0 p-0 ${loop ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              aria-label="Loop the current track"
            >
              <Repeat className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={shuffle ? "default" : "ghost"}
              size="sm"
              aria-pressed={shuffle}
              onClick={() => {
                setShuffle((value) => {
                  if (!value) setShuffleSeed((seed) => seed + 1);
                  return !value;
                });
                toast.info("Shuffle changes the order you hear here; the queue itself stays in order.");
              }}
              className={`h-9 w-9 shrink-0 p-0 ${shuffle ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              aria-label="Shuffle the upcoming tracks"
            >
              <Shuffle className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy !== null}
              onClick={() => void run("stop")}
              aria-label="Clear the queue"
              className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-foreground"
            >
              {busy === "stop" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
            </Button>
            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
              {singingHere ? (
                <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                  {botInCall.singing ? "Singing in call" : botInCall.note ? "In call — see note" : "In call"}
                </span>
              ) : (
                provider.note
              )}
            </span>
          </div>

          {botInCall.note && singingHere && (
            <p className="mt-2 rounded-xl border border-amber-400/25 bg-amber-400/5 px-2.5 py-1.5 text-[11px] text-amber-100">
              {botInCall.note}
            </p>
          )}

          {orderedUpcoming.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {orderedUpcoming.slice(0, 5).map((track, index) => (
                <li
                  key={track.id}
                  className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-1.5"
                >
                  <span className="w-4 shrink-0 text-center text-[11px] font-bold tabular-nums text-muted-foreground">
                    {index + 2}
                  </span>
                  {track.artwork_url ? (
                    <img src={track.artwork_url} alt="" loading="lazy" className="h-7 w-7 shrink-0 rounded-md object-cover" />
                  ) : (
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white/5">
                      <Music className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{track.title}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {track.artist ?? MUSIC_PROVIDERS[detectMusicSource(track.url ?? track.preview_url)?.kind ?? "apple"].label}
                      {formatDuration(track.duration_ms) ? ` · ${formatDuration(track.duration_ms)}` : ""}
                    </span>
                  </span>
                </li>
              ))}
              {upcoming.length > 5 && (
                <li className="px-2 text-[11px] text-muted-foreground">+{upcoming.length - 5} more in the queue</li>
              )}
            </ul>
          )}
        </>
      )}

      {canUse && (
        <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => void submit(event)}>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="/play a song, a YouTube link, or an audio file"
            aria-label="Queue a song with the music bot"
            maxLength={200}
            disabled={busy === "play"}
            className="glass h-11 border-white/10"
          />
          <Button
            type="submit"
            disabled={!query.trim() || busy === "play"}
            className="h-12 shrink-0 border-0 bg-primary text-primary-foreground sm:h-11 sm:w-auto"
          >
            {busy === "play" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Music className="h-4 w-4" />}
            Play
          </Button>
        </form>
      )}

      <MusicSheet open={sheetOpen} onOpenChange={setSheetOpen} realmId={realmId} roomId={roomId} />
    </div>
  );
}

/**
 * A seeded Fisher–Yates shuffle. Seeded so one render pass is stable (no
 * flicker while React re-renders) and a new seed gives a genuinely new order.
 */
function seededShuffle<T>(items: T[], seed: number): T[] {
  let state = seed * 2_654_435_761 + 1;
  const random = () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
