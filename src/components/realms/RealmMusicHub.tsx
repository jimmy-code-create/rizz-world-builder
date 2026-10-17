import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ListMusic,
  Loader2,
  Mic,
  Music,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Square,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { MusicSheet } from "@/components/chat/MusicSheet";
import { MusicPlayer, queueTrackToMusic, type MusicPlayerController } from "@/components/music/MusicPlayer";
import { fetchRealmBots, realmBotsKey } from "@/lib/bots";
import { formatDuration, musicQueueKey, runMusicCommand, useMusicQueue } from "@/lib/music";
import { MUSIC_PROVIDERS, detectMusicSource } from "@/lib/music-sources";
import { musicBotControls, useMusicBotInCall } from "@/components/voice/MusicBotInCall";
import { useVoiceCallContext } from "@/components/voice/VoiceCallProvider";

type RealmMusicHubProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  realmId: string;
  roomId: string;
  roomName?: string;
};

/**
 * Dedicated Music menu for a realm voice channel.
 *
 * Opened from the music icon in the realm voice bar AND from the VC header, so
 * both entry points land on the same hub. It drives the shared MUSIC BOT queue
 * (per voice room): paste a link or `/play` a song, then skip / loop / replay /
 * shuffle / clear with everyone in sync. Playback uses the unified MusicPlayer.
 */
export function RealmMusicHub({ open, onOpenChange, realmId, roomId, roomName }: RealmMusicHubProps) {
  const qc = useQueryClient();
  const voice = useVoiceCallContext();

  const bots = useQuery({
    queryKey: realmBotsKey(realmId),
    queryFn: () => fetchRealmBots(realmId),
    enabled: open && !!realmId,
  });
  const bot = (bots.data?.bots ?? []).find((entry) => entry.name === "MUSIC BOT");
  const canUse = !!bot?.enabled;

  const queue = useMusicQueue(realmId, roomId, open && canUse);
  const [queryText, setQueryText] = useState("");
  const [busy, setBusy] = useState<"play" | "skip" | "stop" | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [loop, setLoop] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(1);
  const controller = useRef<MusicPlayerController | null>(null);
  const botInCall = useMusicBotInCall();

  const tracks = queue.data ?? [];
  const current = tracks[0] ?? null;
  const currentInput = queueTrackToMusic(current);
  const upcoming = tracks.slice(1);
  const provider = MUSIC_PROVIDERS[detectMusicSource(current?.url ?? current?.preview_url)?.kind ?? "apple"];
  const singingHere = botInCall.enabled && !!botInCall.track && botInCall.track.id === current?.id;

  const inThisCall = voice?.call?.channelId === roomId;
  const joining = voice?.busy ?? false;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const song = queryText.trim().replace(/^\/play\s+/i, "").trim();
    if (!song || busy) return;
    setBusy("play");
    try {
      const result = await runMusicCommand("play", { args: song, realmId, roomId });
      if (!result.ok) throw new Error(result.error || `No song found for "${song}"`);
      toast.success(result.body || `Queued ${song}`);
      setQueryText("");
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

  const restart = () => {
    if (botInCall.singing) {
      musicBotControls.seek(0);
      toast.success("Restarted track");
      return;
    }
    controller.current?.seekTo(0);
  };

  const orderedUpcoming = useMemo(
    () => (shuffle ? seededShuffle(upcoming, shuffleSeed) : upcoming),
    [shuffle, upcoming, shuffleSeed],
  );

  return (
    <>
      <Sheet open={open && !queueOpen} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[88dvh] overflow-y-auto rounded-t-3xl border-white/10 bg-[#0b0714] px-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
        >
          <SheetHeader className="pb-3 pt-2 text-left">
            <SheetTitle className="flex items-center gap-2 font-display text-2xl">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400/15 text-emerald-200">
                <Music className="h-5 w-5" />
              </span>
              Music
              {roomName && (
                <span className="ml-1 truncate text-xs font-normal text-muted-foreground">
                  · {roomName}
                </span>
              )}
            </SheetTitle>
            <p className="text-xs text-muted-foreground">
              Shared MUSIC BOT queue for this voice channel — queue, skip, loop, replay and
              shuffle in sync.
            </p>
          </SheetHeader>

          {!canUse && open && (
            <div className="mb-4 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4 text-sm">
              <p className="font-bold">MUSIC BOT isn&apos;t enabled here</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {bot
                  ? "MUSIC BOT is switched off for this realm — ask a mod to enable it."
                  : "Add MUSIC BOT to this realm to play music in voice channels."}
              </p>
            </div>
          )}

          {!inThisCall && canUse && (
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.07] p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Hear it together</p>
                <p className="text-xs text-muted-foreground">
                  Join the channel so MUSIC BOT sings in the call with everyone.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={joining || !voice}
                onClick={() =>
                  voice?.joinChannel({ id: roomId, realmId, name: roomName ?? "Voice channel" })
                }
                className="h-10 shrink-0 gap-2 bg-emerald-400 px-4 text-black hover:bg-emerald-300"
              >
                <Mic className="h-4 w-4" /> {joining ? "Joining…" : "Join VC"}
              </Button>
            </div>
          )}

          {canUse && current && (
            <div className="mb-4 rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-400/[0.12] to-emerald-400/[0.05] p-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                Now playing
              </p>
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

              {/* Transport: restart / skip / loop / shuffle / stop */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={restart}
                  aria-label="Replay the current track from the start"
                  className="h-10 w-10 shrink-0 p-0 text-muted-foreground hover:text-foreground"
                >
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void run("skip")}
                  className="h-10 shrink-0 gap-1.5 border-white/10 bg-white/5 text-xs"
                >
                  {busy === "skip" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <SkipForward className="h-3.5 w-3.5" />
                  )}
                  Skip
                </Button>
                <Button
                  type="button"
                  variant={loop ? "default" : "ghost"}
                  size="sm"
                  aria-pressed={loop}
                  onClick={() => setLoop((v) => !v)}
                  aria-label="Loop the current track"
                  className={`h-10 w-10 shrink-0 p-0 ${loop ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  <Repeat className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant={shuffle ? "default" : "ghost"}
                  size="sm"
                  aria-pressed={shuffle}
                  onClick={() => {
                    setShuffle((v) => {
                      if (!v) setShuffleSeed((s) => s + 1);
                      return !v;
                    });
                  }}
                  aria-label="Shuffle the upcoming tracks"
                  className={`h-10 w-10 shrink-0 p-0 ${shuffle ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
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
                  className="h-10 w-10 shrink-0 p-0 text-muted-foreground hover:text-foreground"
                >
                  {busy === "stop" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Square className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQueueOpen(true)}
                  className="ml-auto h-10 shrink-0 gap-1.5 border-white/10 bg-white/5 text-xs"
                >
                  <ListMusic className="h-3.5 w-3.5" /> Queue ({tracks.length})
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {singingHere
                  ? botInCall.singing
                    ? "🎶 Singing in the call now"
                    : "In the call — see note in VC"
                  : provider.note}
                {loop && " · 🔁 Loop on"}
                {shuffle && " · 🔀 Shuffle on"}
              </p>
            </div>
          )}

          {canUse && !current && (
            <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center">
              <Music className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-bold">Nothing queued</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Paste a YouTube, Apple or audio link below — or type a song name.
              </p>
            </div>
          )}

          {canUse && orderedUpcoming.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Up next
              </p>
              <ul className="space-y-1.5">
                {orderedUpcoming.slice(0, 5).map((track, index) => (
                  <li
                    key={track.id}
                    className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-1.5"
                  >
                    <span className="w-4 shrink-0 text-center text-[11px] font-bold tabular-nums text-muted-foreground">
                      {index + 2}
                    </span>
                    {track.artwork_url ? (
                      <img
                        src={track.artwork_url}
                        alt=""
                        loading="lazy"
                        className="h-8 w-8 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/5">
                        <Music className="h-3.5 w-3.5 text-muted-foreground" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{track.title}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {track.artist ?? "Unknown artist"}
                        {formatDuration(track.duration_ms)
                          ? ` · ${formatDuration(track.duration_ms)}`
                          : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              {upcoming.length > 5 && (
                <button
                  type="button"
                  onClick={() => setQueueOpen(true)}
                  className="mt-1.5 px-1 text-[11px] text-primary hover:underline"
                >
                  +{upcoming.length - 5} more — open full queue
                </button>
              )}
            </div>
          )}

          {canUse && (
            <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="/play a song, a YouTube link, or an audio file"
                aria-label="Queue a song with the music bot"
                maxLength={200}
                disabled={busy === "play"}
                className="glass h-11 border-white/10"
              />
              <Button
                type="submit"
                disabled={!queryText.trim() || busy === "play"}
                className="h-12 shrink-0 gap-2 border-0 bg-primary text-primary-foreground sm:h-11"
              >
                {busy === "play" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Play
              </Button>
            </form>
          )}
        </SheetContent>
      </Sheet>

      <MusicSheet open={queueOpen} onOpenChange={setQueueOpen} realmId={realmId} roomId={roomId} />
    </>
  );
}

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
