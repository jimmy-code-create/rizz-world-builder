"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sliders, Mic, Volume2, VolumeX, Activity, Headphones, Sparkles } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CloseButton } from "@/components/ui/close-button";
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
import { formatVolume, loadSoundSettings, useSoundSettings } from "@/lib/sound-settings";
import {
  usePeerAudio,
  peerVolumeOf,
  setPeerVolume,
  togglePeerMute,
  type PeerAudioState,
} from "@/lib/peer-audio";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@/lib/toast";

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

type SettingsTab = "devices" | "mic" | "volume" | "members";

const TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: "devices", label: "Devices" },
  { id: "mic", label: "Microphone" },
  { id: "volume", label: "Volume" },
  { id: "members", label: "Members" },
];

let cachedDevices: MediaDeviceInfo[] = [];

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

  // Slider drags write to a LOCAL draft at 60fps and commit to the global
  // store only on release (onValueCommit). The old code called the global
  // setter on every onValueChange tick, which re-rendered the sheet plus every
  // useSoundSettings subscriber (remote audio nodes, music player, call view)
  // per tick — that fan-out is what made the sheet feel laggy.
  const [draft, setDraft] = useState(soundSettings);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [tab, setTab] = useState<SettingsTab>("mic");
  useEffect(() => {
    if (open) {
      const fresh = loadSoundSettings();
      draftRef.current = fresh;
      setDraft(fresh);
      setPeerDraft({});
    }
  }, [open]);
  const commitDraft = useCallback(() => {
    setSoundSettings({ ...draftRef.current });
  }, [setSoundSettings]);

  // Per-peer volume drafts, same reason: commit on release, not per tick.
  const [peerDraft, setPeerDraft] = useState<Record<string, number>>({});

  const [devices, setDevices] = useState<MediaDeviceInfo[]>(() => cachedDevices);
  const [sinkSupported, setSinkSupported] = useState(false);
  // Mount the (heavy) content a frame after the sheet starts opening: ~15
  // Radix portals + avatars mounting in the same frame as the slide animation
  // is what dropped frames on phones.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!open) {
      setMounted(false);
      return;
    }
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, [open ]);

  useEffect(() => {
    setSinkSupported(
      typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype,
    );
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      cachedDevices = list;
      setDevices(list);
    } catch {
      // Permission denied or not yet requested
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (cachedDevices.length > 0) setDevices(cachedDevices);
    // Defer device enumeration so it runs after sheet open animation completes, preventing UI lag
    const timer = setTimeout(() => {
      void refreshDevices();
    }, 150);
    // A plugged/unplugged headset while the sheet is open refreshes the lists.
    const onDeviceChange = () => {
      void refreshDevices();
    };
    navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);
    return () => {
      clearTimeout(timer);
      navigator.mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);
    };
  }, [open, refreshDevices]);

  const { inputs, outputs } = useMemo(() => {
    const all = devices.length > 0 ? devices : cachedDevices;
    return {
      inputs: all.filter((device) => device.kind === "audioinput"),
      outputs: all.filter((device) => device.kind === "audiooutput"),
    };
  }, [devices]);

  const tabBar = (
    <div role="tablist" aria-label="Settings sections" className="flex gap-1.5 overflow-x-auto pb-1">
      {TABS.map((entry) => {
        const selected = tab === entry.id;
        return (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => setTab(entry.id)}
            className={`h-11 shrink-0 rounded-full border px-4 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d] ${
              selected
                ? "border-[#c8ff3d] bg-[#c8ff3d]/15 text-[#c8ff3d]"
                : "border-[#2a2a2e] text-muted-foreground hover:text-foreground"
            }`}
          >
            {entry.label}
            {entry.id === "members" && participants.length > 0 ? ` · ${participants.length}` : ""}
          </button>
        );
      })}
    </div>
  );

  // One tab mounts at a time: opening the sheet builds a single light
  // section instead of every select, meter, slider and avatar at once.
  const content =
    tab === "devices" ? (
      <div className="space-y-4 text-xs">
        {/* Input Device */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold flex items-center gap-1.5">
            <Mic className="h-3.5 w-3.5 text-primary" /> Input Device
          </Label>
          <Select
            value={draft.inputDeviceId ?? "default"}
            onValueChange={(val) => {
              const next = { ...draftRef.current, inputDeviceId: val === "default" ? null : val };
              draftRef.current = next;
              setDraft(next);
              commitDraft();
            }}
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
            value={draft.outputDeviceId ?? "default"}
            onValueChange={(val) => {
              const next = { ...draftRef.current, outputDeviceId: val === "default" ? null : val };
              draftRef.current = next;
              setDraft(next);
              commitDraft();
            }}
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
      </div>
    ) : tab === "mic" ? (
      <div className="space-y-4 text-xs">
        {/* Live Mic Test Meter */}
        <MicLiveMeter
          open={open}
          inputDeviceId={draft.inputDeviceId}
          noiseSuppression={draft.noiseSuppression}
          sensitivity={draft.micSensitivity}
        />

        {/* Mic Sensitivity Slider */}
        <div className="space-y-2 pt-2 border-t border-white/10">
          <div className="flex justify-between font-medium">
            <span className="text-foreground">Mic Sensitivity</span>
            <span className="text-muted-foreground font-mono">
              {Math.round(draft.micSensitivity * 100)}%
            </span>
          </div>
          <Slider
            value={[Math.round(draft.micSensitivity * 100)]}
            min={0}
            max={100}
            step={5}
            onValueChange={([val]) => setDraft((d) => ({ ...d, micSensitivity: (val ?? 50) / 100 }))}
            onValueCommit={commitDraft}
          />
          <p className="text-[11px] text-muted-foreground">
            Activation threshold before the lime speaking ring turns on.
          </p>
        </div>

        {/* Toggles */}
        <div className="space-y-3 pt-2 border-t border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs font-semibold">Noise Suppression</Label>
              <p className="text-[11px] text-muted-foreground">Filters background noise and echo cancellation</p>
            </div>
            <Switch
              checked={draft.noiseSuppression}
              onCheckedChange={(v) => {
                const next = { ...draftRef.current, noiseSuppression: v };
                draftRef.current = next;
                setDraft(next);
                commitDraft();
              }}
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
      </div>
    ) : tab === "volume" ? (
      <div className="space-y-4 text-xs">
        {/* Output Voice Volume */}
        <div className="space-y-2">
          <div className="flex justify-between font-medium">
            <span className="text-foreground">Voice Volume</span>
            <span className="text-muted-foreground font-mono">{formatVolume(draft.voice)}</span>
          </div>
          <Slider
            value={[Math.round(draft.voice * 100)]}
            min={0}
            max={100}
            step={5}
            onValueChange={([val]) => setDraft((d) => ({ ...d, voice: (val ?? 100) / 100 }))}
            onValueCommit={commitDraft}
          />
        </div>

        {/* Music Bot Volume */}
        <div className="space-y-2 pt-2 border-t border-white/10">
          <div className="flex justify-between font-medium">
            <span className="text-foreground">Music Bot Volume</span>
            <span className="text-muted-foreground font-mono">{formatVolume(draft.music)}</span>
          </div>
          <Slider
            value={[Math.round(draft.music * 100)]}
            min={0}
            max={100}
            step={5}
            onValueChange={([val]) => setDraft((d) => ({ ...d, music: (val ?? 80) / 100 }))}
            onValueCommit={commitDraft}
          />
        </div>
      </div>
    ) : (
      <div className="space-y-2.5 text-xs">
        {/* Participants Volume Management (when in call) */}
        {participants.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-muted-foreground">
            Nobody else is here yet.
          </p>
        ) : (
          <>
            <Label className="text-xs font-semibold text-foreground">In-Call Members ({participants.length})</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {participants.map((p) => {
                const isMe = p.user_id === currentUserId;
                const uName = p.user?.display_name || p.user?.username || "user";
                const isPeerMuted = peerAudio.muted.includes(p.user_id);
                const peerVol = peerDraft[p.user_id] ?? peerVolumeOf(peerAudio, p.user_id);

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
                          onValueChange={([val]) =>
                            setPeerDraft((d) => ({ ...d, [p.user_id]: val ?? 100 }))
                          }
                          onValueCommit={([val]) => {
                            const v = val ?? peerDraft[p.user_id] ?? 100;
                            setPeerDraft((d) => {
                              const next = { ...d };
                              delete next[p.user_id];
                              return next;
                            });
                            if (onSetPeerVolume) onSetPeerVolume(p.user_id, v);
                            else setPeerVolume(p.user_id, v);
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
          </>
        )}
      </div>
    );

  const body = (
    <>
      {tabBar}
      {mounted ? (
        content
      ) : (
        <div className="space-y-3" aria-hidden>
          <div className="h-12 animate-pulse rounded-xl bg-white/5" />
          <div className="h-12 animate-pulse rounded-xl bg-white/5" />
          <div className="h-24 animate-pulse rounded-xl bg-white/5" />
        </div>
      )}
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent hideClose side="bottom" className="glass-strong z-[140] rounded-t-3xl border-white/10 p-0 max-h-[85vh] flex flex-col overflow-hidden">
          <SheetHeader className="flex flex-row items-center justify-between p-3.5 px-4 border-b border-white/10 text-left shrink-0">
            <SheetTitle className="font-display flex items-center gap-2 text-base">
              <Sliders className="h-4 w-4 text-primary" /> Voice & Audio Settings
            </SheetTitle>
            <SheetClose asChild>
              <CloseButton />
            </SheetClose>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">{body}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="glass-strong border-white/10 max-w-md w-full p-0 max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex flex-row items-center justify-between p-3.5 px-4 border-b border-white/10 shrink-0">
          <DialogTitle className="font-display flex items-center gap-2">
            <Sliders className="h-5 w-5 text-primary" /> Voice & Audio Settings
          </DialogTitle>
          <DialogClose asChild>
            <CloseButton />
          </DialogClose>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">{body}</div>
      </DialogContent>
    </Dialog>
  );
}

function MicLiveMeter({
  open,
  inputDeviceId,
  noiseSuppression,
  sensitivity,
}: {
  open: boolean;
  inputDeviceId?: string | null;
  noiseSuppression: boolean;
  sensitivity: number;
}) {
  const [active, setActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const sensitivityRef = useRef(sensitivity);
  sensitivityRef.current = sensitivity;

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
    if (barRef.current) {
      barRef.current.style.width = "0%";
      barRef.current.style.backgroundColor = "rgba(200, 255, 61, 0.5)";
    }
    setActive(false);
  }, []);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  // Closing the sheet releases the mic: the test stream used to stay alive
  // (and fight the call engine's own analyser) until unmount or manual stop.
  useEffect(() => {
    if (!open) stop();
  }, [open, stop]);

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
      // 128 bins is plenty for a level meter; the old 256 doubled per-frame work.
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let lastPaint = 0;

      const updateMeter = () => {
        // ~12fps is all a level bar needs; rAF at 60fps just burned CPU.
        const now = performance.now();
        if (now - lastPaint >= 80) {
          lastPaint = now;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const avg = sum / bufferLength;
          const normalized = Math.min(100, Math.round((avg / 128) * 100));
          if (barRef.current) {
            barRef.current.style.width = `${normalized}%`;
            const above = normalized >= Math.round(sensitivityRef.current * 100);
            barRef.current.style.backgroundColor = above ? "var(--primary, #c8ff3d)" : "rgba(200, 255, 61, 0.5)";
          }
        }
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };
      setActive(true);
      updateMeter();
    } catch {
      toast.error("Could not access microphone for live test");
      stop();
    }
  };

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
          ref={barRef}
          className="h-full rounded-full transition-[width] duration-75"
          style={{ width: "0%", backgroundColor: "rgba(200, 255, 61, 0.5)" }}
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
