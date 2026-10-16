import { useState, useRef, useEffect } from "react";
import { Music, Play, Pause, SkipForward, X, Trash2, Volume2, VolumeX, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type MusicTrack = {
  id: string;
  title: string;
  videoId: string;
  thumbnail: string;
  duration: string;
  addedBy: string;
  addedByName: string;
};

type SharedMusicState = {
  currentTrack: MusicTrack | null;
  queue: MusicTrack[];
  isPlaying: boolean;
  startedAt: number | null;
  pausedAt: number | null;
};

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export function VCMusicSheet({
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [musicState, setMusicState] = useState<SharedMusicState>({
    currentTrack: null,
    queue: [],
    isPlaying: false,
    startedAt: null,
    pausedAt: null,
  });
  const [volume, setVolume] = useState(70);
  const [muted, setMuted] = useState(false);
  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load YouTube IFrame API
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.debug("Player cleanup:", e);
        }
      }
    };
  }, []);

  // Initialize player
  useEffect(() => {
    if (!open || !playerContainerRef.current || !window.YT?.Player) return;

    const initPlayer = () => {
      if (!playerRef.current && playerContainerRef.current) {
        playerRef.current = new window.YT.Player(playerContainerRef.current, {
          height: "0",
          width: "0",
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
          },
          events: {
            onStateChange: (event: any) => {
              if (event.data === window.YT.PlayerState.ENDED) {
                handleSkip();
              }
            },
          },
        });
      }
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }
  }, [open]);

  // Sync state via realtime
  useEffect(() => {
    if (!open || !channelId || !user) return;

    const channel = supabase.channel(`vc-music:${channelId}`);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "music-state" }, ({ payload }) => {
        if (payload.userId === user.id) return; // Ignore own updates
        setMusicState(payload.state);
        syncPlayer(payload.state);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [open, channelId, user]);

  const syncPlayer = (state: SharedMusicState) => {
    if (!playerRef.current || !state.currentTrack) return;

    try {
      if (state.isPlaying && state.startedAt) {
        const elapsed = (Date.now() - state.startedAt) / 1000;
        playerRef.current.loadVideoById(state.currentTrack.videoId, elapsed);
        playerRef.current.setVolume(muted ? 0 : volume);
      } else if (state.pausedAt) {
        playerRef.current.loadVideoById(state.currentTrack.videoId);
        playerRef.current.seekTo(state.pausedAt / 1000);
        playerRef.current.pauseVideo();
      }
    } catch (e) {
      console.debug("Player sync error:", e);
    }
  };

  const broadcastState = (state: SharedMusicState) => {
    if (!channelRef.current || !user) return;
    channelRef.current.send({
      type: "broadcast",
      event: "music-state",
      payload: { userId: user.id, state },
    });
  };

  const searchYouTube = async () => {
    if (!searchQuery.trim() || searching) return;

    // Check if it's a YouTube URL
    const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = searchQuery.match(youtubeRegex);

    if (match) {
      // Direct video ID
      const videoId = match[1];
      addToQueue({
        id: Date.now().toString(),
        title: "YouTube Video",
        videoId,
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        duration: "Unknown",
        addedBy: user!.id,
        addedByName: user!.email?.split("@")[0] || "You",
      });
      setSearchQuery("");
      return;
    }

    setSearching(true);
    try {
      // Note: In production, you'd call your backend API that uses YouTube Data API
      // For now, we'll use a placeholder
      toast.info("Search feature requires YouTube Data API key on backend");
      setSearchResults([]);
    } catch (error) {
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const addToQueue = (track: MusicTrack) => {
    const newQueue = [...musicState.queue, track];
    const newState: SharedMusicState = {
      ...musicState,
      queue: newQueue,
      currentTrack: musicState.currentTrack || track,
    };
    
    setMusicState(newState);
    broadcastState(newState);
    toast.success(`Added ${track.title}`);

    if (!musicState.currentTrack) {
      // Auto-play first track after user interaction
      handlePlay();
    }
  };

  const handlePlay = () => {
    if (!musicState.currentTrack || !playerRef.current) return;

    const newState: SharedMusicState = {
      ...musicState,
      isPlaying: true,
      startedAt: Date.now(),
      pausedAt: null,
    };

    try {
      playerRef.current.loadVideoById(musicState.currentTrack.videoId);
      playerRef.current.setVolume(muted ? 0 : volume);
      playerRef.current.playVideo();
      setMusicState(newState);
      broadcastState(newState);
    } catch (e) {
      toast.error("Playback failed - click play again");
    }
  };

  const handlePause = () => {
    if (!playerRef.current) return;

    try {
      const currentTime = playerRef.current.getCurrentTime() * 1000;
      playerRef.current.pauseVideo();
      
      const newState: SharedMusicState = {
        ...musicState,
        isPlaying: false,
        startedAt: null,
        pausedAt: currentTime,
      };
      
      setMusicState(newState);
      broadcastState(newState);
    } catch (e) {
      console.debug("Pause error:", e);
    }
  };

  const handleSkip = () => {
    const nextQueue = musicState.queue.slice(1);
    const nextTrack = nextQueue[0] || null;

    const newState: SharedMusicState = {
      currentTrack: nextTrack,
      queue: nextQueue,
      isPlaying: false,
      startedAt: null,
      pausedAt: null,
    };

    setMusicState(newState);
    broadcastState(newState);

    if (nextTrack) {
      // Auto-play next track
      setTimeout(() => handlePlay(), 100);
    }
  };

  const handleRemove = (trackId: string, addedBy: string) => {
    if (addedBy !== user?.id) {
      toast.error("Only the queuer can remove this track");
      return;
    }

    const newQueue = musicState.queue.filter((t) => t.id !== trackId);
    const newState: SharedMusicState = {
      ...musicState,
      queue: newQueue,
    };

    setMusicState(newState);
    broadcastState(newState);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    setMuted(false);
    if (playerRef.current) {
      playerRef.current.setVolume(value[0]);
    }
  };

  const toggleMute = () => {
    const newMuted = !muted;
    setMuted(newMuted);
    if (playerRef.current) {
      playerRef.current.setVolume(newMuted ? 0 : volume);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="border-white/10 bg-[#0b0714] rounded-t-3xl max-h-[85dvh] overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
      >
        <div ref={playerContainerRef} className="hidden" />
        
        <SheetHeader className="text-left pt-2">
          <SheetTitle className="font-display text-xl flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            Music
          </SheetTitle>
        </SheetHeader>

        {/* Now Playing */}
        {musicState.currentTrack && (
          <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.07] p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Now Playing
            </p>
            <div className="flex items-center gap-3">
              <img
                src={musicState.currentTrack.thumbnail}
                alt=""
                className="h-16 w-16 rounded-lg object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{musicState.currentTrack.title}</p>
                <p className="text-xs text-muted-foreground">
                  Added by {musicState.currentTrack.addedByName}
                </p>
              </div>
              <Button
                size="icon"
                variant="outline"
                onClick={musicState.isPlaying ? handlePause : handlePlay}
                className="h-12 w-12 rounded-full border-emerald-400/40 bg-emerald-400/10"
              >
                {musicState.isPlaying ? (
                  <Pause className="h-5 w-5 text-emerald-200" />
                ) : (
                  <Play className="h-5 w-5 text-emerald-200" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Volume Control */}
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <button
            type="button"
            onClick={toggleMute}
            className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10 transition-colors"
          >
            {muted || volume === 0 ? (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Volume2 className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          <Slider
            value={[muted ? 0 : volume]}
            min={0}
            max={100}
            step={5}
            onValueChange={handleVolumeChange}
            className="flex-1"
          />
          <span className="text-xs font-mono text-muted-foreground w-10 text-right">
            {muted ? 0 : volume}%
          </span>
        </div>

        {/* Add Music */}
        <div className="mt-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              searchYouTube();
            }}
            className="flex gap-2"
          >
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Paste YouTube link or search..."
              className="flex-1 h-11 glass border-white/10"
              disabled={searching}
            />
            <Button
              type="submit"
              disabled={!searchQuery.trim() || searching}
              className="h-11 px-6 bg-primary text-primary-foreground"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
            </Button>
          </form>
        </div>

        {/* Queue */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Queue ({musicState.queue.length})
            </p>
            {musicState.queue.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSkip}
                className="h-8 gap-1.5 border-white/10 bg-white/5 text-xs"
              >
                <SkipForward className="h-3.5 w-3.5" />
                Skip
              </Button>
            )}
          </div>

          {musicState.queue.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">
              No songs in queue. Add a YouTube link above!
            </p>
          ) : (
            <div className="space-y-2">
              {musicState.queue.map((track, index) => (
                <div
                  key={track.id}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3"
                >
                  <span className="text-xs font-bold text-muted-foreground w-6 text-center">
                    {index + 1}
                  </span>
                  <img
                    src={track.thumbnail}
                    alt=""
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{track.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {track.addedByName} · {track.duration}
                    </p>
                  </div>
                  {track.addedBy === user?.id && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemove(track.id, track.addedBy)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
