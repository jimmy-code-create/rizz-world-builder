import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Repeat, Shuffle, Heart, MoreHorizontal, List, Music2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

type Track = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number; // in seconds
  coverUrl?: string;
  audioUrl: string;
};

// Sample tracks - Replace with your actual music source
const SAMPLE_TRACKS: Track[] = [
  {
    id: "1",
    title: "Lofi Chill Beats",
    artist: "Rizz Radio",
    album: "Chill Vibes Vol. 1",
    duration: 180,
    coverUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  },
  {
    id: "2",
    title: "Midnight Drive",
    artist: "Synthwave Dreams",
    album: "Neon Nights",
    duration: 240,
    coverUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  },
  {
    id: "3",
    title: "Summer Vibes",
    artist: "Tropical Sounds",
    album: "Beach Sessions",
    duration: 195,
    coverUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  },
  {
    id: "4",
    title: "Focus Flow",
    artist: "Study Beats",
    album: "Deep Work",
    duration: 210,
    coverUrl: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300&h=300&fit=crop",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
  },
];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function MusicPlayer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(70);
  const [isMuted, setIsMuted] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const currentTrack = SAMPLE_TRACKS[currentTrackIndex];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
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
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((e) => {
        toast.error("Failed to play audio");
        console.error(e);
      });
    }
    setIsPlaying(!isPlaying);
  };

  const handleNext = () => {
    let nextIndex;
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * SAMPLE_TRACKS.length);
    } else {
      nextIndex = (currentTrackIndex + 1) % SAMPLE_TRACKS.length;
    }
    setCurrentTrackIndex(nextIndex);
    setCurrentTime(0);
    if (isPlaying && audioRef.current) {
      audioRef.current.play();
    }
  };

  const handlePrevious = () => {
    if (currentTime > 3) {
      // If more than 3 seconds in, restart current track
      if (audioRef.current) audioRef.current.currentTime = 0;
      setCurrentTime(0);
    } else {
      // Otherwise go to previous track
      const prevIndex = currentTrackIndex === 0 ? SAMPLE_TRACKS.length - 1 : currentTrackIndex - 1;
      setCurrentTrackIndex(prevIndex);
      setCurrentTime(0);
      if (isPlaying && audioRef.current) {
        audioRef.current.play();
      }
    }
  };

  const handleSeek = (value: number[]) => {
    const newTime = value[0];
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    setIsMuted(false);
  };

  return (
    <>
      <audio ref={audioRef} src={currentTrack.audioUrl} />
      
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
                <SheetTitle className="text-lg font-display">Music Player</SheetTitle>
              </div>
              <div className="flex items-center gap-2">
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
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">Queue</h3>
                    {SAMPLE_TRACKS.map((track, index) => (
                      <button
                        key={track.id}
                        onClick={() => {
                          setCurrentTrackIndex(index);
                          setCurrentTime(0);
                          if (audioRef.current) {
                            audioRef.current.play();
                            setIsPlaying(true);
                          }
                          setShowQueue(false);
                        }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors ${
                          index === currentTrackIndex ? "bg-primary/10 ring-1 ring-primary/30" : ""
                        }`}
                      >
                        <img
                          src={track.coverUrl}
                          alt={track.title}
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                        <div className="flex-1 text-left min-w-0">
                          <p className={`font-medium truncate ${index === currentTrackIndex ? "text-primary" : ""}`}>
                            {track.title}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
                        </div>
                        <span className="text-sm text-muted-foreground">{formatTime(track.duration)}</span>
                      </button>
                    ))}
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
                        src={currentTrack.coverUrl}
                        alt={currentTrack.title}
                        className="w-72 h-72 rounded-3xl shadow-2xl object-cover ring-1 ring-white/10"
                      />
                      {isPlaying && (
                        <motion.div
                          className="absolute inset-0 rounded-3xl bg-gradient-to-t from-primary/20 to-transparent"
                          animate={{ opacity: [0.3, 0.6, 0.3] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      )}
                    </motion.div>

                    {/* Track Info */}
                    <div className="w-full text-center mb-6">
                      <h2 className="text-2xl font-bold mb-1">{currentTrack.title}</h2>
                      <p className="text-muted-foreground">{currentTrack.artist}</p>
                      {currentTrack.album && (
                        <p className="text-sm text-muted-foreground/70 mt-1">{currentTrack.album}</p>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full mb-6">
                      <Slider
                        value={[currentTime]}
                        min={0}
                        max={currentTrack.duration}
                        step={0.1}
                        onValueChange={handleSeek}
                        className="mb-2"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(currentTrack.duration)}</span>
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
                        onClick={() => setIsLiked(!isLiked)}
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

                      <button className="h-10 w-10 rounded-full hover:bg-white/10 grid place-items-center transition-colors">
                        <MoreHorizontal className="h-5 w-5" />
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
