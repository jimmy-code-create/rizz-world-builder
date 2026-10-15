"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sliders, Mic, Volume2, VolumeX, Activity, Headphones, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatVolume, useSoundSettings } from "@/lib/sound-settings";
import {
  usePeerAudio,
  peerVolumeOf,
  setPeerVolume,
  togglePeerMute,
  type PeerAudioState,
} from "@/lib/peer-audio";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

export interface VoiceSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  muted?: boolean;
  onToggleMute?: () => void;
  participants?: Array<{
    user_id: string;
    user?: {
      username?: string | null;
      display_name?: string | null;
      avatar_url?: string | null;
    } | null;
  }>;
  currentUserId?: string;
  peerAudio?: PeerAudioState;
  onSetPeerVolume?: (peerId: string, volume: number) => void;
  onTogglePeerMute?: (peerId: string) => void;
}

export function VoiceSettingsSheet({
  open,
  onOpenChange,
  muted = false,
  onToggleMute,
  participants = [],
  currentUserId,
  peerAudio: propPeerAudio,
  onSetPeerVolume,
  onTogglePeerMute,
}: VoiceSettingsSheetProps) {
  const isMobile = useIsMobile();
  const [soundSettings, setSoundSettings] = useSoundSettings();
  const internalPeerAudio = usePeerAudio();
  const peerAudio = propPeerAudio ?? internalPeerAudio;

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [sinkSupported, setSinkSupported] = useState(false);

  useEffect(() => {
    setSinkSupported(
      typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype,
    );
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      setDevices(await navigator.mediaDevices.enumerateDevices());
    } catch {
      // Permission denied or not yet requested
    }
  }, []);

  useEffect(() => {
    if (open) {
      void refreshDevices();
    }
  }, [open, refreshDevices]);

  const inputs = devices.filter((device) => device.kind === "audioinput");
  const outputs = devices.filter((device) => device.kind === "audiooutput");

  const content = (
    <div className="space-y-4 text-xs">
      {/* Input Device */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <Mic className="h-3.5 w-3.5 text-primary" /> Input Device
        </Label>
        <Select
          value={soundSettings.inputDeviceId ?? "default"}
          onValueChange={(val) => setSoundSettings({ inputDeviceId: val === "default" ? null : val })}
        >
          <SelectTrigger className="h-10 bg-white/[0.04] border-white/10 text-xs">
            <SelectValue placeholder="System Default" />
          </SelectTrigger>
          <SelectContent className="bg-[#141416] border-[#2a2a2e] text-xs">
            <SelectItem value="default">System Default</SelectItem>
            {inputs.map((d, i) => (
              <SelectItem key={d.deviceId || `input-${i}`} value={d.deviceId}>
                {d.label || `Microphone ${i + 1}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Output Device */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <Headphones className="h-3.5 w-3.5 text-primary" /> Output Device
        </Label>
        <Select
          value={soundSettings.outputDeviceId ?? "default"}
          onValueChange={(val) => setSoundSettings({ outputDeviceId: val === "default" ? null : val })}
          disabled={!sinkSupported}
        >
          <SelectTrigger className="h-10 bg-white/[0.04] border-white/10 text-xs disabled:opacity-50">
            <SelectValue placeholder="System Default" />
          </SelectTrigger>
          <SelectContent className="bg-[#141416] border-[#2a2a2e] text-xs">
            <SelectItem value="default">System Default</SelectItem>
            {outputs.map((d, i) => (
              <SelectItem key={d.deviceId || `output-${i}`} value={d.deviceId}>
                {d.label || `Speaker ${i + 1}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Live Mic Test Meter */}
      <MicLiveMeter
        inputDeviceId={soundSettings.inputDeviceId}
        noiseSuppression={soundSettings.noiseSuppression}
        sensitivity={soundSettings.micSensitivity}
      />

      {/* Mic Sensitivity Slider */}
      <div className="space-y-2 pt-2 border-t border-white/10">
        <div className="flex justify-between font-medium">
          <span className="text-foreground">Mic Sensitivity</span>
          <span className="text-muted-foreground font-mono">
            {Math.round(soundSettings.micSensitivity * 100)}%
          </span>
        </div>
        <Slider
          value={[Math.round(soundSettings.micSensitivity * 100)]}
          min={0}
          max={100}
          step={5}
          onValueChange={([val]) => setSoundSettings({ micSensitivity: (val ?? 50) / 100 })}
        />
        <p className="text-[11px] text-muted-foreground">
          Activation threshold before the lime speaking ring turns on.
        </p>
      </div>

      {/* Output Voice Volume */}
      <div className="space-y-2 pt-2 border-t border-white/10">
        <div className="flex justify-between font-medium">
          <span className="text-foreground">Voice Volume</span>
          <span className="text-muted-foreground font-mono">{formatVolume(soundSettings.voice)}</span>
        </div>
        <Slider
          value={[Math.round(soundSettings.voice * 100)]}
          min={0}
          max={200}
          step={5}
          onValueChange={([val]) => setSoundSettings({ voice: val / 100 })}
        />
      </div>

      {/* Music Bot Volume */}
      <div className="space-y-2 pt-2 border-t border-white/10">
        <div className="flex justify-between font-medium">
          <span className="text-foreground">Music Bot Volume</span>
          <span className="text-muted-foreground font-mono">{formatVolume(soundSettings.music)}</span>
        </div>
        <Slider
          value={[Math.round(soundSettings.music * 100)]}
          min={0}
          max={200}
          step={5}
          onValueChange={([val]) => setSoundSettings({ music: val / 100 })}
        />
      </div>

      {/* Toggles */}
      <div className="space-y-3 pt-2 border-t border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs font-semibold">Noise Suppression</Label>
            <p className="text-[11px] text-muted-foreground">Filters background noise and echo cancellation</p>
          </div>
          <Switch
            checked={soundSettings.noiseSuppression}
            onCheckedChange={(v) => setSoundSettings({ noiseSuppression: v })}
          />
        </div>

        {onToggleMute && (
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs font-semibold">Self Mute</Label>
              <p className="text-[11px] text-muted-foreground">Mute your microphone in this call</p>
            </div>
            <Switch checked={muted} onCheckedChange={onToggleMute} />
          </div>
        )}
      </div>

      {/* Participants Volume Management (when in call) */}
      {participants.length > 0 && (
        <div className="space-y-2.5 pt-3 border-t border-white/10">
          <Label className="text-xs font-semibold text-foreground">In-Call Members ({participants.length})</Label>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {participants.map((p) => {
              const isMe = p.user_id === currentUserId;
              const uName = p.user?.display_name || p.user?.username || "user";
              const isPeerMuted = peerAudio.muted.includes(p.user_id);
              const peerVol = peerVolumeOf(peerAudio, p.user_id);

              return (
                <div key={p.user_id} className="flex items-center justify-between gap-3 p-2 rounded-xl bg-white/[0.03] border border-white/5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={p.user?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[10px] bg-primary text-primary-foreground font-bold">
                        {uName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-xs font-medium">
                      {uName} {isMe && "(you)"}
                    </span>
                  </div>
                  {!isMe && (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-muted-foreground">{peerVol}%</span>
                      <Slider
                        value={[peerVol]}
                        min={0}
                        max={100}
                        step={5}
                        onValueChange={([val]) => {
                          if (onSetPeerVolume) onSetPeerVolume(p.user_id, val);
                          else setPeerVolume(p.user_id, val);
                        }}
                        className="w-16"
                        aria-label={`Volume for ${uName}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          if (onTogglePeerMute) onTogglePeerMute(p.user_id);
                          else togglePeerMute(p.user_id);
                        }}
                        aria-label={isPeerMuted ? `Unmute ${uName}` : `Mute ${uName}`}
                      >
                        {isPeerMuted ? <VolumeX className="h-3.5 w-3.5 text-destructive" /> : <Volume2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="glass-strong z-[140] rounded-t-3xl border-white/10 p-5 max-h-[85vh] overflow-y-auto">
          <SheetHeader className="pb-3 border-b border-white/10 text-left">
            <SheetTitle className="font-display flex items-center gap-2 text-base">
              <Sliders className="h-4 w-4 text-primary" /> Voice & Audio Settings
            </SheetTitle>
          </SheetHeader>
          <div className="pt-3">{content}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-white/10 max-w-md w-full max-h-[85vh] overflow-y-auto space-y-4">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Sliders className="h-5 w-5 text-primary" /> Voice & Audio Settings
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}

function MicLiveMeter({
  inputDeviceId,
  noiseSuppression,
  sensitivity,
}: {
  inputDeviceId?: string | null;
  noiseSuppression: boolean;
  sensitivity: number;
}) {
  const [active, setActive] = useState(false);
  const [level, setLevel] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setLevel(0);
    setActive(false);
  }, []);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  const start = async () => {
    stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: inputDeviceId ? { exact: inputDeviceId } : undefined,
          noiseSuppression,
          echoCancellation: true,
        },
      });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateMeter = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setLevel(normalized);
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };
      setActive(true);
      updateMeter();
    } catch {
      toast.error("Could not access microphone for live test");
      stop();
    }
  };

  const isAboveThreshold = level >= Math.round(sensitivity * 100);

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> Live Mic Level
        </span>
        <Button
          type="button"
          size="sm"
          variant={active ? "outline" : "default"}
          onClick={active ? stop : start}
          className={`h-7 px-2.5 text-xs rounded-lg ${active ? "glass border-white/10 text-muted-foreground" : "bg-primary text-primary-foreground shadow-sm"}`}
        >
          {active ? "Stop test" : "Test mic"}
        </Button>
      </div>

      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-surface-2 border border-border">
        <div
          className={`h-full transition-all duration-75 rounded-full ${isAboveThreshold ? "bg-primary" : "bg-primary/50"}`}
          style={{ width: `${level}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/70 shadow-sm"
          style={{ left: `${Math.round(sensitivity * 100)}%` }}
          title={`Activation threshold: ${Math.round(sensitivity * 100)}%`}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        White line shows threshold where the lime speaking ring turns on.
      </p>
    </div>
  );
}
