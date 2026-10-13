import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListMusic, Loader2, Music, Pause, Play, SkipForward, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MusicSheet } from "@/components/chat/MusicSheet";
import { fetchRealmBots, realmBotsKey } from "@/lib/bots";
import { formatDuration, musicQueueKey, runMusicCommand, useMusicQueue } from "@/lib/music";

/**
 * MUSIC BOT inside a voice channel.
 *
 * The bot is a voice-channel feature: the queue lives on the voice room and
 * `/play` is refused everywhere else (music_add checks the room kind). A voice
 * channel has no composer, so this panel is where `/play` is typed: a song name
 * or a link, then the queue at the top plays it for whoever is in the call.
 *
 * The preview is played locally and never autoplays — browsers block that, and a
 * voice channel should not suddenly make noise.
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
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const tracks = queue.data ?? [];
  const current = tracks[0] ?? null;

  // A song reaching the front of the queue (or being skipped) stops the old
  // preview instead of leaving two tracks talking at once.
  useEffect(() => {
    audioRef.current?.pause();
    setPlaying(false);
  }, [current?.id]);

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

  const run = async (command: "skip" | "stop") => {
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
  };

  const togglePreview = () => {
    const audio = audioRef.current;
    if (!audio || !current?.preview_url) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    void audio.play().then(() => setPlaying(true), () => setPlaying(false));
  };

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-primary text-white">
          <Music className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
            Music bot
            <span className="rounded-full border border-[var(--rizz-pink)]/30 bg-[var(--rizz-pink)]/10 px-1.5 py-px text-[9px] font-semibold normal-case tracking-normal text-[var(--rizz-pink)]">
              voice only
            </span>
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {canUse
              ? tracks.length === 0
                ? "Nothing queued — type a song below."
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
            className="h-9 shrink-0 gap-1.5 border-white/10 bg-white/5 text-xs"
            onClick={() => setSheetOpen(true)}
          >
            <ListMusic className="h-3.5 w-3.5" /> Queue
          </Button>
        )}
      </div>

      {canUse && current && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2">
          <button
            type="button"
            disabled={!current.preview_url}
            onClick={togglePreview}
            aria-label={playing ? `Pause ${current.title}` : `Play a preview of ${current.title}`}
            className="group relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-primary text-white disabled:opacity-70"
          >
            {current.artwork_url ? (
              <img src={current.artwork_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <Music className="h-4 w-4" />
            )}
            <span className="absolute inset-0 grid place-items-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </span>
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{current.title}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {current.artist ?? "Unknown artist"}
              {formatDuration(current.duration_ms) ? ` · ${formatDuration(current.duration_ms)}` : ""}
              {current.preview_url ? " · tap to preview" : ""}
            </p>
          </div>

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
            variant="ghost"
            size="sm"
            disabled={busy !== null}
            onClick={() => void run("stop")}
            aria-label="Clear the queue"
            className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-foreground"
          >
            {busy === "stop" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}

      {canUse && (
        <form className="mt-3 flex gap-2" onSubmit={(event) => void submit(event)}>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="/play a song name or link"
            aria-label="Queue a song with the music bot"
            maxLength={120}
            disabled={busy === "play"}
            className="glass h-11 border-white/10"
          />
          <Button
            type="submit"
            disabled={!query.trim() || busy === "play"}
            className="h-11 shrink-0 border-0 bg-gradient-primary text-primary-foreground"
          >
            {busy === "play" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Play
          </Button>
        </form>
      )}

      <MusicSheet open={sheetOpen} onOpenChange={setSheetOpen} realmId={realmId} roomId={roomId} />

      {current?.preview_url && (
        <audio
          ref={audioRef}
          src={current.preview_url}
          onEnded={() => setPlaying(false)}
          onPause={() => setPlaying(false)}
          className="hidden"
        />
      )}
    </div>
  );
}
