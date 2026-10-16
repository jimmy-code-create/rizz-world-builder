import { useState, useRef, useEffect } from "react";
import { Music, Play, Pause, SkipForward, SkipBack, X, Trash2, Volume2, VolumeX, Loader2, Repeat, Repeat1, Shuffle, ListMusic, Search, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type MusicTrack = {
  id: string;
  title: string;
  videoId: string;
  thumbnail: string;
  duration: string;
  addedBy: string;
  addedByName: string;
};

type RepeatMode = "off" | "all" | "one";

type SharedMusicState = {
  currentTrack: MusicTrack | null;
  queue: MusicTrack[];
  isPlaying: boolean;
  startedAt: number | null;
  pausedAt: number | null;
  repeatMode: RepeatMode;
  shuffleEnabled: boolean;
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
  const [showAddSection, setShowAddSection] = useState(false);
  const [musicState, setMusicState] = useState<SharedMusicState>({
    currentTrack: null,
    queue: [],
    isPlaying: false,
    startedAt: null,
    pausedAt: null,
    repeatMode: "off",
    shuffleEnabled: false,
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
                handleTrackEnd();
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
      setShowAddSection(false);
      return;
    }

    setSearching(true);
    try {
      // Note: In production, you'd call your backend API that uses YouTube Data API
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
      setTimeout(() => handlePlay(), 100);
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

  const handleSkipNext = () => {
    if (musicState.repeatMode === "one" && musicState.currentTrack) {
      // Replay same track
      handlePlay();
      return;
    }

    const nextQueue = musicState.queue.slice(1);
    let nextTrack = nextQueue[0] || null;

    if (!nextTrack && musicState.repeatMode === "all" && musicState.queue.length > 0) {
      // Loop back to start
      nextTrack = musicState.queue[0];
    }

    const newState: SharedMusicState = {
      ...musicState,
      currentTrack: nextTrack,
      queue: musicState.repeatMode === "all" && !nextQueue[0] ? musicState.queue : nextQueue,
      isPlaying: false,
      startedAt: null,
      pausedAt: null,
    };

    setMusicState(newState);
    broadcastState(newState);

    if (nextTrack) {
      setTimeout(() => handlePlay(), 100);
    }
  };

  const handleSkipPrevious = () => {
    // Restart current track or go to previous if within first 3 seconds
    if (musicState.currentTrack) {
      handlePlay();
    }
  };

  const handleTrackEnd = () => {
    handleSkipNext();
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

  const toggleRepeat = () => {
    const modes: RepeatMode[] = ["off", "all", "one"];
    const currentIndex = modes.indexOf(musicState.repeatMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    
    const newState: SharedMusicState = {
      ...musicState,
      repeatMode: nextMode,
    };
    
    setMusicState(newState);
    broadcastState(newState);
    
    toast.success(
      nextMode === "off" 
        ? "Repeat off" 
        : nextMode === "all" 
          ? "Repeat queue" 
          : "Repeat one"
    );
  };

  const toggleShuffle = () => {
    const newState: SharedMusicState = {
      ...musicState,
      shuffleEnabled: !musicState.shuffleEnabled,
    };
    
    setMusicState(newState);
    broadcastState(newState);
    toast.success(newState.shuffleEnabled ? "Shuffle on" : "Shuffle off");
  };

  const clearQueue = () => {
    const newState: SharedMusicState = {
      currentTrack: null,
      queue: [],
      isPlaying: false,
      startedAt: null,
      pausedAt: null,
      repeatMode: musicState.repeatMode,
      shuffleEnabled: musicState.shuffleEnabled,
    };
    
    setMusicState(newState);
    broadcastState(newState);
    if (playerRef.current) {
      try {
        playerRef.current.stopVideo();
      } catch (e) {
        console.debug("Stop error:", e);
      }
    }
    toast.success("Queue cleared");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="border-white/10 bg-[#0b0714] rounded-t-3xl max-h-[85dvh] overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
      >
        <div ref={playerContainerRef} className="hidden" />
        
        <SheetHeader className="text-left pt-2 pb-4">
          <SheetTitle className="font-display text-2xl flex items-center gap-2">
            <Music className="h-6 w-6 text-primary" />
            Music
          </SheetTitle>
        </SheetHeader>

        {/* Now Playing */}
        {musicState.currentTrack && (
          <div className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-400/[0.12] to-emerald-400/[0.05] p-4 mb-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-200 mb-3">
              Now Playing
            </p>
            <div className="flex items-center gap-4 mb-4">
              <img
                src={musicState.currentTrack.thumbnail}
                alt=""
                className="h-20 w-20 rounded-xl object-cover ring-2 ring-emerald-400/30"
              />
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold truncate">{musicState.currentTrack.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Added by {musicState.currentTrack.addedByName}
                </p>
              </div>
            </div>

            {/* Main Controls */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <Button
                size="icon"
                variant="ghost"
                onClick={handleSkipPrevious}
                disabled={!musicState.currentTrack}
                className="h-10 w-10 rounded-full hover:bg-emerald-400/10"
              >
                <SkipBack className="h-5 w-5" />
              </Button>
              
              <Button
                size="icon"
                onClick={musicState.isPlaying ? handlePause : handlePlay}
                disabled={!musicState.currentTrack}
                className="h-14 w-14 rounded-full bg-emerald-400 hover:bg-emerald-500 text-black shadow-lg shadow-emerald-400/30"
              >
                {musicState.isPlaying ? (
                  <Pause className="h-6 w-6" fill="currentColor" />
                ) : (
                  <Play className="h-6 w-6 ml-0.5" fill="currentColor" />
                )}
              </Button>

              <Button
                size="icon"
                variant="ghost"
                onClick={handleSkipNext}
                disabled={musicState.queue.length === 0}
                className="h-10 w-10 rounded-full hover:bg-emerald-400/10"
              >
                <SkipForward className="h-5 w-5" />
              </Button>
            </div>

            {/* Secondary Controls */}
            <div className="flex items-center justify-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={toggleShuffle}
                className={`h-9 w-9 rounded-full ${musicState.shuffleEnabled ? "text-emerald-400 bg-emerald-400/10" : "hover:bg-white/5"}`}
              >
                <Shuffle className="h-4 w-4" />
              </Button>

              <Button
                size="icon"
                variant="ghost"
                onClick={toggleRepeat}
                className={`h-9 w-9 rounded-full ${musicState.repeatMode !== "off" ? "text-emerald-400 bg-emerald-400/10" : "hover:bg-white/5"}`}
              >
                {musicState.repeatMode === "one" ? (
                  <Repeat1 className="h-4 w-4" />
                ) : (
                  <Repeat className="h-4 w-4" />
                )}
              </Button>

              <div className="flex-1 mx-2">
                <div className="flex items-center gap-2">
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
              </div>
            </div>
          </div>
        )}

        {/* Add Music Button */}
        {!showAddSection && (
          <Button
            onClick={() => setShowAddSection(true)}
            className="w-full h-12 mb-4 gap-2 bg-primary text-primary-foreground"
          >
            <Plus className="h-5 w-5" />
            Add Music
          </Button>
        )}

        {/* Add Music Section */}
        {showAddSection && (
          <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Add to Queue</p>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setShowAddSection(false)}
                className="h-8 w-8 -mr-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
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
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        )}

        {/* Queue */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ListMusic className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Queue ({musicState.queue.length})
              </p>
            </div>
            {musicState.queue.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={clearQueue}
                className="h-8 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>

          {musicState.queue.length === 0 ? (
            <div className="py-12 text-center">
              <Music className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm font-semibold text-muted-foreground mb-1">No songs in queue</p>
              <p className="text-xs text-muted-foreground/70">
                Add a YouTube link to get started!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {musicState.queue.map((track, index) => (
                <div
                  key={track.id}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                    index === 0 && musicState.isPlaying
                      ? "border-emerald-400/40 bg-emerald-400/[0.07]"
                      : "border-white/10 bg-white/[0.02]"
                  }`}
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
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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
