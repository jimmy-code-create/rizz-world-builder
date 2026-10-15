import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, Headphones, Mic, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SheetClose } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatVolume,
  loadSoundSettings,
  SOUND_SETTINGS_EVENT,
  useSoundSettings,
} from "@/lib/sound-settings";

/**
 * Voice-channel settings sheet — the "sliders" button in the call view.
 *
 * One compact bottom surface for the per-call audio knobs: output/input device
 * pickers, your output volume, the mic's sensitivity, noise suppression and a
 * live mic test. Everything writes to the same `rizz:sound` store the settings
 * page uses, so the two views can never disagree.
 *
 * The mic test reads the real capture constraints the call uses (input device +
 * noise suppression), so what you see here is what the call will hear.
 */
export function VoiceSettingsSheet({
  open,
  onOpenChange,
  realmId,
  channelName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The realm the call belongs to: enables a per-realm MUSIC BOT volume row. */
  realmId?: string | null;
  /** Realm name for the sheet subtitle. */
  channelName?: string | null;
}) {
  const [settings, update] = useSoundSettings();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [micTest, setMicTest] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const [settingsTick, setSettingsTick] = useState(0);

  const sinkSupported =
    typeof window !== "undefined" &&
    typeof HTMLMediaElement !== "undefined" &&
    "setSinkId" in HTMLMediaElement.prototype;

  // Device list refreshes whenever the sheet opens or hardware changes.
  useEffect(() => {
    if (!open) return;
    const refresh = () => {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      navigator.mediaDevices
        .enumerateDevices()
        .then(setDevices)
        .catch(() => {
          // Permission denied: labels stay generic, pickers still work.
        });
    };
    refresh();
    const media = navigator.mediaDevices;
    if (!media?.addEventListener) return;
    media.addEventListener("devicechange", refresh);
    return () => media.removeEventListener("devicechange", refresh);
  }, [open]);

  // Live re-render when anything in the sound store changes.
  useEffect(() => {
    const sync = () => setSettingsTick((tick) => tick + 1);
    window.addEventListener(SOUND_SETTINGS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SOUND_SETTINGS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const stopMicTest = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setMicTest(false);
    setMicLevel(0);
  }, []);

  // Stay current with the live mic settings while the test is running.
  const live = loadSoundSettings();
  void settingsTick;

  const startMicTest = useCallback(async () => {
    if (micTest) {
      stopMicTest();
      return;
    }
    try {
      // Same constraints the call pipeline uses, so the test reflects reality.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: settings.inputDeviceId ? { exact: settings.inputDeviceId } : undefined,
          noiseSuppression: settings.noiseSuppression,
          echoCancellation: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;
      const AC: typeof AudioContext =
        (window as unknown as { AudioContext: typeof AudioContext }).AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const context = new AC();
      if (context.state === "suspended") await context.resume().catch(() => {});
      ctxRef.current = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const buffer = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(buffer);
        let sum = 0;
        for (let index = 0; index < buffer.length; index += 1) {
          const value = (buffer[index] - 128) / 128;
          sum += value * value;
        }
        setMicLevel(Math.min(1, Math.sqrt(sum / buffer.length) * 3));
        rafRef.current = requestAnimationFrame(tick);
      };
      setMicTest(true);
      tick();
    } catch {
      toast.error("Couldn't open your microphone for the test");
      stopMicTest();
    }
  }, [micTest, settings.inputDeviceId, settings.noiseSuppression, stopMicTest]);

  // Closing the sheet always stops the mic stream — never leave a hot mic.
  useEffect(() => {
    if (!open) stopMicTest();
    return undefined;
  }, [open, stopMicTest]);
  useEffect(() => stopMicTest, [stopMicTest]);

  const inputs = devices.filter((device) => device.kind === "audioinput");
  const outputs = devices.filter((device) => device.kind === "audiooutput");
  const labelsHidden = devices.length > 0 && devices.every((device) => !device.label);
  const realmOverride = realmId ? settings.realmOverrides[realmId] : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="glass-strong z-[70] flex max-h-[85dvh] flex-col gap-0 overflow-hidden rounded-t-3xl border-white/10"
      >
        <SheetHeader className="shrink-0 border-b border-white/10 bg-background/60 px-5 pb-3.5 pt-5 text-left backdrop-blur-md">
          <SheetTitle className="flex items-center gap-2 font-display text-lg font-bold">
            <AudioLines className="h-5 w-5 text-primary" />
            Voice settings
            {channelName ? <span className="truncate text-sm font-medium text-muted-foreground">· {channelName}</span> : null}
            <SheetClose className="ml-auto grid h-10 w-10 place-items-center rounded-full border border-white/10 text-muted-foreground transition-colors hover:text-foreground">
              <X className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Close</span>
            </SheetClose>
          </SheetTitle>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4">
          {/* Output */}
          <section>
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Headphones className="h-4 w-4 text-primary" /> Output
            </h2>
            <div className="mt-2.5 space-y-4">
              <div>
                <span className="text-xs font-semibold text-muted-foreground">Speaker</span>
                <Select
                  value={settings.outputDeviceId ?? "default"}
                  onValueChange={(next) => update({ outputDeviceId: next === "default" ? null : next })}
                  disabled={!sinkSupported}
                >
                  <SelectTrigger className="mt-1 h-11 border-white/10 bg-white/5">
                    <SelectValue placeholder="System default" />
                  </SelectTrigger>
                  <SelectContent className="glass-strong border-white/10">
                    <SelectItem value="default">System default</SelectItem>
                    {outputs.map((device, index) => (
                      <SelectItem key={device.deviceId || `out-${index}`} value={device.deviceId}>
                        {device.label || `Speaker ${index + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!sinkSupported && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    This browser can't choose an output device; use your system sound settings.
                  </p>
                )}
              </div>
              <SliderRow
                label="Your volume"
                value={Math.round(settings.voice * 100)}
                readout={formatVolume(settings.muted ? 0 : settings.voice)}
                max={200}
                ariaLabel="Output volume"
                onValueChange={(value) => update({ voice: (value ?? 100) / 100 })}
              />
              {realmId !== undefined && realmId !== null && (
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">MUSIC BOT here</span>
                    <span className="text-xs font-bold tabular-nums">
                      {realmOverride === undefined ? "Default" : formatVolume(realmOverride)}
                    </span>
                  </div>
                  <Slider
                    className="mt-1.5"
                    value={[Math.round((realmOverride ?? 1) * 100)]}
                    min={0}
                    max={200}
                    step={5}
                    aria-label="MUSIC BOT volume in this realm"
                    onValueChange={([value]) =>
                      update({ realmOverrides: { ...settings.realmOverrides, [realmId]: (value ?? 100) / 100 } })
                    }
                  />
                </div>
              )}
            </div>
          </section>

          {/* Microphone */}
          <section>
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Mic className="h-4 w-4 text-primary" /> Microphone
            </h2>
            <div className="mt-2.5 space-y-4">
              <div>
                <span className="text-xs font-semibold text-muted-foreground">Input device</span>
                <Select
                  value={settings.inputDeviceId ?? "default"}
                  onValueChange={(next) => update({ inputDeviceId: next === "default" ? null : next })}
                >
                  <SelectTrigger className="mt-1 h-11 border-white/10 bg-white/5">
                    <SelectValue placeholder="System default" />
                  </SelectTrigger>
                  <SelectContent className="glass-strong border-white/10">
                    <SelectItem value="default">System default</SelectItem>
                    {inputs.map((device, index) => (
                      <SelectItem key={device.deviceId || `in-${index}`} value={device.deviceId}>
                        {device.label || `Microphone ${index + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {labelsHidden && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Device names appear after you allow microphone access.
                  </p>
                )}
              </div>

              <SliderRow
                label="Input volume"
                value={Math.round(live.micSensitivity * 100)}
                readout={`${Math.round(live.micSensitivity * 100)}%`}
                max={100}
                ariaLabel="Input volume"
                onValueChange={(value) => update({ micSensitivity: (value ?? 50) / 100 })}
              />

              <div className="flex items-center justify-between gap-3">
                <label htmlFor="voice-sheet-denoise" className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Noise suppression
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    Applied to the next call you join.
                  </span>
                </label>
                <Switch
                  id="voice-sheet-denoise"
                  checked={settings.noiseSuppression}
                  onCheckedChange={(checked) => update({ noiseSuppression: checked })}
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => void startMicTest()}
                  aria-pressed={micTest}
                  className={`min-h-11 w-full rounded-2xl border px-4 text-sm font-semibold transition-colors ${
                    micTest
                      ? "border-primary/50 bg-primary/15 text-foreground"
                      : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {micTest ? "Stop mic test" : "Test my mic"}
                </button>
                {micTest && (
                  <div className="mt-2">
                    <div
                      className="h-2 overflow-hidden rounded-full bg-white/10"
                      role="meter"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(micLevel * 100)}
                      aria-label="Microphone level"
                    >
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-100"
                        style={{ width: `${Math.round(micLevel * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Say something — the bar moves with your voice at {settings.noiseSuppression ? "high" : "no"}{" "}
                      noise suppression.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Label + % readout + slider, the one row style used across the sheet. */
function SliderRow({
  label,
  value,
  readout,
  max,
  ariaLabel,
  onValueChange,
}: {
  label: string;
  value: number;
  readout: string;
  max: number;
  ariaLabel: string;
  onValueChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        <span className="text-xs font-bold tabular-nums">{readout}</span>
      </div>
      <Slider
        className="mt-1.5"
        value={[value]}
        min={0}
        max={max}
        step={5}
        aria-label={ariaLabel}
        onValueChange={([next]) => onValueChange(next ?? max / 2)}
      />
    </div>
  );
}
