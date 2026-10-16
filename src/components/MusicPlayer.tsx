import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Repeat, Shuffle, Heart, MoreHorizontal, List, Music2, Share2, Radio, Search as SearchIcon, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

type Track = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number; // in seconds
  coverUrl?: string;
  audioUrl: string;
  category?: string;
};

// Free music sources - using FMA (Free Music Archive) and other public domain sources
const FEATURED_TRACKS: Track[] = [
  {
    id: "1",
    title: "Chill Lofi Beats",
    artist: "Lofi Studio",
    album: "Study Vibes",
    duration: 180,
    category: "Lofi",
    coverUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop",
    audioUrl: "https://cdn.pixabay.com/audio/2022/03/10/audio_c54a8a9d8c.mp3",
  },
  {
    id: "2",
    title: "Electronic Dreams",
    artist: "Synthwave Radio",
    album: "Neon Nights",
    duration: 240,
    category: "Electronic",
    coverUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop",
    audioUrl: "https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3",
  },
  {
    id: "3",
    title: "Acoustic Sunrise",
    artist: "Morning Melodies",
    album: "Dawn Sessions",
    duration: 195,
    category: "Acoustic",
    coverUrl: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=300&h=300&fit=crop",
    audioUrl: "https://cdn.pixabay.com/audio/2022/08/02/audio_88a1a9c675.mp3",
  },
  {
    id: "4",
    title: "Deep Focus",
    artist: "Ambient Sounds",
    album: "Concentration Zone",
    duration: 210,
    category: "Ambient",
    coverUrl: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300&h=300&fit=crop",
    audioUrl: "https://cdn.pixabay.com/audio/2021/08/04/audio_bb630cc098.mp3",
  },
  {
    id: "5",
    title: "Hip Hop Beats",
    artist: "Beat Maker",
    album: "Urban Rhythms",
    duration: 200,
    category: "Hip Hop",
    coverUrl: "https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=300&h=300&fit=crop",
    audioUrl: "https://cdn.pixabay.com/audio/2022/11/15/audio_5c1ab5d691.mp3",
  },
  {
    id: "6",
    title: "Jazz Cafe",
    artist: "Smooth Jazz Collective",
    album: "Night Moods",
    duration: 230,
    category: "Jazz",
    coverUrl: "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=300&h=300&fit=crop",
    audioUrl: "https://cdn.pixabay.com/audio/2022/03/23/audio_25c8c40390.mp3",
  },
  {
    id: "7",
    title: "Classical Moments",
    artist: "Orchestra Ensemble",
    album: "Timeless Classics",
    duration: 280,
    category: "Classical",
    coverUrl: "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=300&h=300&fit=crop",
    audioUrl: "https://cdn.pixabay.com/audio/2022/06/07/audio_359e8bf87e.mp3",
  },
  {
    id: "8",
    title: "Rock Anthem",
    artist: "Electric Legends",
    album: "Power Chords",
    duration: 215,
    category: "Rock",
    coverUrl: "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=300&h=300&fit=crop",
    audioUrl: "https://cdn.pixabay.com/audio/2022/09/16/audio_02a284ba0d.mp3",
  },
];

const CATEGORIES = ["All", "Lofi", "Electronic", "Acoustic", "Ambient", "Hip Hop", "Jazz", "Classical", "Rock"];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function MusicPlayer({ 
  open, 
  onOpenChange,
  channelId 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  channelId?: string;
}) {
  const { user } = useAuth();
  const [tracks, setTracks] = useState<Track[]>(FEATURED_TRACKS);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(70);
  const [isMuted, setIsMuted] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [likedTracks, setLikedTracks] = useState<Set<string>>(new Set());
  const [showQueue, setShowQueue] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const currentTrack = tracks[currentTrackIndex];

  // Filter tracks by category and search
  const filteredTracks = tracks.filter((track) => {
    const matchesCategory = selectedCategory === "All" || track.category === selectedCategory;
    const matchesSearch = searchQuery === "" || 
      track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      track.artist.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Load liked tracks from localStorage
  useEffect(() => {
    if (!user) return;
    try {
      const saved = localStorage.getItem(`rizz:liked-tracks:${user.id}`);
      if (saved) {
        setLikedTracks(new Set(JSON.parse(saved)));
      }
    } catch (e) {
      console.error("Failed to load liked tracks", e);
    }
  }, [user]);

  // Save liked tracks to localStorage
  const saveLikedTracks = (liked: Set<string>) => {
    if (!user) return;
    try {
      localStorage.setItem(`rizz:liked-tracks:${user.id}`, JSON.stringify([...liked]));
    } catch (e) {
      console.error("Failed to save liked tracks", e);
    }
  };

  // Sync playback state with channel (if in a channel)
  useEffect(() => {
    if (!channelId || !user) return;
    
    const channel = supabase.channel(`music:${channelId}`);
    
    // Subscribe to playback updates
    channel.on("broadcast", { event: "music-update" }, ({ payload }) => {
      if (payload.userId === user.id) return; // Ignore own updates
      
      if (payload.trackId && payload.trackId !== currentTrack.id) {
        const trackIndex = tracks.findIndex(t => t.id === payload.trackId);
        if (trackIndex !== -1) {
          setCurrentTrackIndex(trackIndex);
        }
      }
      
      if (payload.isPlaying !== undefined && payload.isPlaying !== isPlaying) {
        setIsPlaying(payload.isPlaying);
      }
      
      if (payload.currentTime !== undefined) {
        setCurrentTime(payload.currentTime);
        if (audioRef.current) {
          audioRef.current.currentTime = payload.currentTime;
        }
      }
    });
    
    channel.subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, user, currentTrack?.id, isPlaying, tracks]);

  // Broadcast playback state
  const broadcastUpdate = (update: any) => {
    if (!channelId || !user) return;
    
    supabase.channel(`music:${channelId}`).send({
      type: "broadcast",
      event: "music-update",
      payload: {
        userId: user.id,
        trackId: currentTrack?.id,
        ...update,
      },
    });
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const handleEnded = () => {
      if (isRepeat) {
        audio.currentTime = 0;
        audio.play();
      } else {
        handleNext();
      }
    };

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [isRepeat, currentTrackIndex]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (!open) {
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  }, [open]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    
    const newIsPlaying = !isPlaying;
    
    if (newIsPlaying) {
      audioRef.current.play().catch((e) => {
        toast.error("Failed to play audio");
        console.error(e);
      });
    } else {
      audioRef.current.pause();
    }
    
    setIsPlaying(newIsPlaying);
    broadcastUpdate({ isPlaying: newIsPlaying });
  };

  const handleNext = () => {
    let nextIndex;
    const currentFilteredIndex = filteredTracks.findIndex(t => t.id === currentTrack.id);
    
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * filteredTracks.length);
    } else {
      nextIndex = (currentFilteredIndex + 1) % filteredTracks.length;
    }
    
    const nextTrack = filteredTracks[nextIndex];
    const globalIndex = tracks.findIndex(t => t.id === nextTrack.id);
    
    setCurrentTrackIndex(globalIndex);
    setCurrentTime(0);
    
    if (isPlaying && audioRef.current) {
      audioRef.current.play();
    }
    
    broadcastUpdate({ trackId: nextTrack.id, currentTime: 0 });
  };

  const handlePrevious = () => {
    if (currentTime > 3) {
      if (audioRef.current) audioRef.current.currentTime = 0;
      setCurrentTime(0);
      broadcastUpdate({ currentTime: 0 });
    } else {
      const currentFilteredIndex = filteredTracks.findIndex(t => t.id === currentTrack.id);
      const prevIndex = currentFilteredIndex === 0 ? filteredTracks.length - 1 : currentFilteredIndex - 1;
      const prevTrack = filteredTracks[prevIndex];
      const globalIndex = tracks.findIndex(t => t.id === prevTrack.id);
      
      setCurrentTrackIndex(globalIndex);
      setCurrentTime(0);
      
      if (isPlaying && audioRef.current) {
        audioRef.current.play();
      }
      
      broadcastUpdate({ trackId: prevTrack.id, currentTime: 0 });
    }
  };

  const handleSeek = (value: number[]) => {
    const newTime = value[0];
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
    broadcastUpdate({ currentTime: newTime });
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    setIsMuted(false);
  };

  const toggleLike = () => {
    const newLiked = new Set(likedTracks);
    if (newLiked.has(currentTrack.id)) {
      newLiked.delete(currentTrack.id);
      toast.success("Removed from liked songs");
    } else {
      newLiked.add(currentTrack.id);
      toast.success("Added to liked songs");
    }
    setLikedTracks(newLiked);
    saveLikedTracks(newLiked);
  };

  const shareCurrentTrack = async () => {
    if (!user || !currentTrack) return;
    
    const shareText = `🎵 Now listening to: ${currentTrack.title} by ${currentTrack.artist}`;
    
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success("Track info copied to clipboard!");
    } catch (e) {
      toast.error("Failed to copy");
    }
  };

  const isLiked = likedTracks.has(currentTrack?.id);

  return (
    <>
      <audio ref={audioRef} src={currentTrack?.audioUrl} />
      
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[90dvh] max-h-[900px] bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1e] border-t border-white/10 p-0"
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <SheetHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <Music2 className="h-5 w-5 text-primary" />
                <SheetTitle className="text-lg font-display">
                  {channelId ? "Shared Music Player" : "Music Player"}
                </SheetTitle>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSearch(!showSearch)}
                  className="h-9 w-9 rounded-full hover:bg-white/10 grid place-items-center transition-colors"
                >
                  <SearchIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setShowQueue(!showQueue)}
                  className="h-9 w-9 rounded-full hover:bg-white/10 grid place-items-center transition-colors"
                >
                  <List className="h-5 w-5" />
                </button>
                <button
                  onClick={() => onOpenChange(false)}
                  className="h-9 w-9 rounded-full hover:bg-white/10 grid place-items-center transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </SheetHeader>

            {/* Search Bar */}
            {showSearch && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="px-4 pb-2"
              >
                <Input
                  placeholder="Search tracks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white/5 border-white/10"
                />
              </motion.div>
            )}

            {/* Category Filter */}
            {!showQueue && (
              <div className="px-4 pb-2 overflow-x-auto no-scrollbar">
                <div className="flex gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                        selectedCategory === cat
                          ? "bg-primary text-primary-foreground"
                          : "bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <AnimatePresence mode="wait">
                {showQueue ? (
                  <motion.div
                    key="queue"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-muted-foreground">
                        Queue ({filteredTracks.length})
                      </h3>
                      {likedTracks.size > 0 && (
                        <button
                          onClick={() => {
                            setSelectedCategory("All");
                            setSearchQuery("");
                            const liked = tracks.filter(t => likedTracks.has(t.id));
                            setTracks([...liked, ...tracks.filter(t => !likedTracks.has(t.id))]);
                          }}
                          className="text-xs text-primary hover:underline"
                        >
                          Show Liked ({likedTracks.size})
                        </button>
                      )}
                    </div>
                    {filteredTracks.map((track) => {
                      const isCurrentTrack = track.id === currentTrack.id;
                      const trackIndex = tracks.findIndex(t => t.id === track.id);
                      
                      return (
                        <button
                          key={track.id}
                          onClick={() => {
                            setCurrentTrackIndex(trackIndex);
                            setCurrentTime(0);
                            if (audioRef.current) {
                              audioRef.current.play();
                              setIsPlaying(true);
                            }
                            setShowQueue(false);
                            broadcastUpdate({ trackId: track.id, currentTime: 0, isPlaying: true });
                          }}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors ${
                            isCurrentTrack ? "bg-primary/10 ring-1 ring-primary/30" : ""
                          }`}
                        >
                          <img
                            src={track.coverUrl}
                            alt={track.title}
                            className="h-12 w-12 rounded-lg object-cover"
                          />
                          <div className="flex-1 text-left min-w-0">
                            <p className={`font-medium truncate ${isCurrentTrack ? "text-primary" : ""}`}>
                              {track.title}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {likedTracks.has(track.id) && (
                              <Heart className="h-4 w-4 text-red-500" fill="currentColor" />
                            )}
                            <span className="text-sm text-muted-foreground">{formatTime(track.duration)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </motion.div>
                ) : (
                  <motion.div
                    key="player"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex flex-col items-center pt-8"
                  >
                    {/* Album Art */}
                    <motion.div
                      animate={{ scale: isPlaying ? [1, 1.02, 1] : 1 }}
                      transition={{ duration: 2, repeat: isPlaying ? Infinity : 0 }}
                      className="relative mb-8"
                    >
                      <img
                        src={currentTrack?.coverUrl}
                        alt={currentTrack?.title}
                        className="w-72 h-72 rounded-3xl shadow-2xl object-cover ring-1 ring-white/10"
                      />
                      {isPlaying && (
                        <motion.div
                          className="absolute inset-0 rounded-3xl bg-gradient-to-t from-primary/20 to-transparent"
                          animate={{ opacity: [0.3, 0.6, 0.3] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      )}
                      {channelId && (
                        <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm flex items-center gap-1.5">
                          <Radio className="h-3 w-3 text-primary" />
                          <span className="text-xs font-medium">Shared Session</span>
                        </div>
                      )}
                    </motion.div>

                    {/* Track Info */}
                    <div className="w-full text-center mb-6">
                      <h2 className="text-2xl font-bold mb-1">{currentTrack?.title}</h2>
                      <p className="text-muted-foreground">{currentTrack?.artist}</p>
                      {currentTrack?.album && (
                        <p className="text-sm text-muted-foreground/70 mt-1">{currentTrack.album}</p>
                      )}
                      {currentTrack?.category && (
                        <span className="inline-block mt-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                          {currentTrack.category}
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full mb-6">
                      <Slider
                        value={[currentTime]}
                        min={0}
                        max={currentTrack?.duration || 100}
                        step={0.1}
                        onValueChange={handleSeek}
                        className="mb-2"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(currentTrack?.duration || 0)}</span>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="w-full flex items-center justify-between mb-6">
                      <button
                        onClick={() => setIsShuffle(!isShuffle)}
                        className={`h-10 w-10 rounded-full grid place-items-center transition-colors ${
                          isShuffle ? "text-primary bg-primary/10" : "hover:bg-white/10"
                        }`}
                      >
                        <Shuffle className="h-4 w-4" />
                      </button>

                      <div className="flex items-center gap-4">
                        <button
                          onClick={handlePrevious}
                          className="h-12 w-12 rounded-full hover:bg-white/10 grid place-items-center transition-colors"
                        >
                          <SkipBack className="h-5 w-5" fill="currentColor" />
                        </button>

                        <button
                          onClick={togglePlay}
                          className="h-16 w-16 rounded-full bg-primary hover:bg-primary/90 grid place-items-center shadow-lg shadow-primary/25 transition-all hover:scale-105"
                        >
                          {isPlaying ? (
                            <Pause className="h-7 w-7" fill="currentColor" />
                          ) : (
                            <Play className="h-7 w-7 ml-1" fill="currentColor" />
                          )}
                        </button>

                        <button
                          onClick={handleNext}
                          className="h-12 w-12 rounded-full hover:bg-white/10 grid place-items-center transition-colors"
                        >
                          <SkipForward className="h-5 w-5" fill="currentColor" />
                        </button>
                      </div>

                      <button
                        onClick={() => setIsRepeat(!isRepeat)}
                        className={`h-10 w-10 rounded-full grid place-items-center transition-colors ${
                          isRepeat ? "text-primary bg-primary/10" : "hover:bg-white/10"
                        }`}
                      >
                        <Repeat className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Secondary Controls */}
                    <div className="w-full flex items-center justify-between">
                      <button
                        onClick={toggleLike}
                        className={`h-10 w-10 rounded-full grid place-items-center transition-colors ${
                          isLiked ? "text-red-500" : "hover:bg-white/10"
                        }`}
                      >
                        <Heart className="h-5 w-5" fill={isLiked ? "currentColor" : "none"} />
                      </button>

                      <div className="flex items-center gap-3 flex-1 max-w-xs mx-4">
                        <button
                          onClick={() => setIsMuted(!isMuted)}
                          className="h-8 w-8 rounded-full hover:bg-white/10 grid place-items-center transition-colors"
                        >
                          {isMuted || volume === 0 ? (
                            <VolumeX className="h-4 w-4" />
                          ) : (
                            <Volume2 className="h-4 w-4" />
                          )}
                        </button>
                        <Slider
                          value={[isMuted ? 0 : volume]}
                          min={0}
                          max={100}
                          step={1}
                          onValueChange={handleVolumeChange}
                          className="flex-1"
                        />
                      </div>

                      <button 
                        onClick={shareCurrentTrack}
                        className="h-10 w-10 rounded-full hover:bg-white/10 grid place-items-center transition-colors"
                      >
                        <Share2 className="h-5 w-5" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
