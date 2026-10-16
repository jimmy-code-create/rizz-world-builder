import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Music, Pause, Play, Plus, SkipForward, Square, Volume2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { formatDuration, musicQueueKey, runMusicCommand, useMusicQueue } from "@/lib/music";
import { useSoundSettings } from "@/lib/sound-settings";

export type MusicNowPlaying = {
  title?: string | null;
  artist?: string | null;
  artworkUrl?: string | null;
  singing: boolean;
  blocked: boolean;
  canToggle: boolean;
  note?: string | null;
};

type MusicSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  realmId: string;
  roomId: string | null;
  /** In-call transport. When omitted the sheet is queue-only (realm page). */
  nowPlaying?: MusicNowPlaying | null;
  onToggleNowPlaying?: () => void;
  onRetryNowPlaying?: () => void;
};

/**
 * MUSIC BOT's queue for the channel on screen. Adding songs happens through the
 * composer's `/play`, so this panel is read-mostly: it shows what is coming up
 * and offers the two commands people reach for most, /skip and /stop.
 */
export function MusicSheet({ open, onOpenChange, realmId, roomId, nowPlaying, onToggleNowPlaying, onRetryNowPlaying }: MusicSheetProps) {
  const queue = useMusicQueue(realmId, roomId, open);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"skip" | "stop" | null>(null);
  const [addTitle, setAddTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [soundSettings, setSoundSettings] = useSoundSettings();

  const run = async (command: "skip" | "stop") => {
    setBusy(command);
    try {
      const result = await runMusicCommand(command, { args: "", realmId, roomId });
      if (result.ok === false) throw new Error(result.error || "The music bot didn't answer");
      toast.success(result.body || (command === "skip" ? "Skipped." : "Queue cleared."));
      await qc.invalidateQueries({ queryKey: musicQueueKey(realmId, roomId) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The music bot didn't answer");
    } finally {
      setBusy(null);
    }
  };

  const tracks = queue.data ?? [];

  const addSong = async () => {
    const title = addTitle.trim();
    if (!title || adding) return;
    setAdding(true);
    try {
      const result = await runMusicCommand("play", { args: title, realmId, roomId });
      if (result.ok === false) throw new Error(result.error || "The music bot didn't answer");
      toast.success(result.body || "Queued.");
      setAddTitle("");
      await qc.invalidateQueries({ queryKey: musicQueueKey(realmId, roomId) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The music bot didn't answer");
    } finally {
      setAdding(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="glass-strong flex w-full flex-col gap-0 border-white/10 p-0 sm:max-w-md">
        <SheetHeader className="shrink-0 border-b border-white/10 px-4 py-3 text-left">
          <SheetTitle className="flex items-center gap-2 font-display text-base">
            <Music className="h-4 w-4 text-primary" /> Music
          </SheetTitle>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {nowPlaying && (
            <div className="mb-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.07] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Now playing</p>
              <div className="mt-2 flex items-center gap-3">
                {nowPlaying.artworkUrl ? (
                  <img
                    src={nowPlaying.artworkUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-white/10"
                  />
                ) : (
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-500/25 text-emerald-100">
                    <Music className="h-5 w-5" aria-hidden="true" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {nowPlaying.title ?? "Nothing queued"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {nowPlaying.blocked
                      ? (nowPlaying.note ?? "Tap retry to let MUSIC BOT sing")
                      : nowPlaying.singing
                        ? `Singing${nowPlaying.artist ? ` · ${nowPlaying.artist}` : ""}`
                        : (nowPlaying.artist ?? "Paused")}
                  </p>
                </div>
                {nowPlaying.blocked ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="glass h-9 shrink-0 gap-1.5 border-white/10 text-xs"
                    onClick={() => onRetryNowPlaying?.()}
                  >
                    <Play className="h-3.5 w-3.5" /> Retry
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="glass h-9 w-9 shrink-0 border-white/10 !px-0"
                    disabled={!nowPlaying.canToggle}
                    onClick={() => onToggleNowPlaying?.()}
                    aria-label={nowPlaying.singing ? "Pause music" : "Play music"}
                  >
                    {nowPlaying.singing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Input
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addSong();
                }
              }}
              placeholder="Add a song…"
              aria-label="Add a song"
              maxLength={120}
              className="h-11 flex-1 rounded-full border-[#2a2a2e] bg-[#141416] text-sm"
            />
            <Button
              type="button"
              disabled={adding || !addTitle.trim()}
              onClick={() => void addSong()}
              aria-label="Queue song"
              className="h-11 w-11 shrink-0 rounded-full bg-[#c8ff3d] !px-0 text-[#0b0b0c] hover:bg-[#c8ff3d]/90 disabled:opacity-50"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>

          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <Volume2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Music Volume</span>
                <span className="font-mono text-foreground">{Math.round((soundSettings.music ?? 0.8) * 100)}%</span>
              </div>
              <Slider
                value={[Math.round((soundSettings.music ?? 0.8) * 100)]}
                min={0}
                max={100}
                step={5}
                onValueCommit={([val]) => {
                  const newVolume = (val ?? 80) / 100;
                  setSoundSettings({ ...soundSettings, music: newVolume });
                  toast.success(`Music volume: ${Math.round(newVolume * 100)}%`, { duration: 1000 });
                }}
                aria-label="Music volume"
                className="w-full"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {tracks.length === 0 ? "Queue empty" : `Up next · ${tracks.length}`}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="glass h-8 gap-1.5 border-white/10 text-xs"
                disabled={!!busy || tracks.length === 0}
                onClick={() => void run("skip")}
              >
                {busy === "skip" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SkipForward className="h-3.5 w-3.5" />}
                Skip
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="glass h-8 gap-1.5 border-white/10 text-xs"
                disabled={!!busy || tracks.length === 0}
                onClick={() => void run("stop")}
              >
                {busy === "stop" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                Clear
              </Button>
            </div>
          </div>

          {queue.isLoading && (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading the queue…
            </p>
          )}
          {queue.isError && (
            <p className="py-8 text-center text-sm text-destructive">Couldn't load the queue.</p>
          )}
          {!queue.isLoading && !queue.isError && tracks.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nothing queued in this channel yet. Add a song with{" "}
              <span className="font-semibold text-foreground">/play song name</span> in the composer.
            </p>
          )}

          <div className="mt-3 space-y-2">
            {tracks.map((track, index) => (
              <div key={track.id} className="flex items-center gap-3 rounded-2xl border border-white/10 glass p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/30 font-display text-xs font-bold text-muted-foreground">
                  {index === 0 ? "▶" : track.position}
                </span>
                {track.artwork_url && (
                  <img
                    src={track.artwork_url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{track.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {track.artist ?? "Unknown artist"}
                    {formatDuration(track.duration_ms) ? ` · ${formatDuration(track.duration_ms)}` : ""}
                  </p>
                </div>
                {track.url && (
                  <a
                    href={track.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs font-semibold text-primary hover:underline"
                  >
                    Open
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
