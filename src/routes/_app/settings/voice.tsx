import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n, tf, tp } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { Headphones, Mic, Music2, Volume1, Volume2, Activity } from "lucide-react";
import { toast } from "@/lib/toast";
import { SettingsCard, SettingsSubPage } from "@/components/settings/SettingsSubPage";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { fetchRealms } from "@/lib/realms";
import { channelVolume, formatVolume, SOUND_SETTINGS_KEY, useSoundSettings } from "@/lib/sound-settings";
import { playNotificationPing } from "@/lib/notification-sound";

export const Route = createFileRoute("/_app/settings/voice")({
  head: () => ({ meta: [{ title: "Voice & Sound · RIZZ" }] }),
  component: VoiceAndSoundPage,
});

/**
 * Voice & Sound.
 *
 * One screen for everything audible: the MUSIC BOT, voice call audio, TTS and
 * notification sounds, plus the microphone and device pickers. Every slider
 * writes straight to `rizz:sound`, which fires an event the players listen for,
 * so a change applies mid-song and never needs a restart.
 *
 * Everything here persists per user on this device (the same store the other
 * preferences use). Values above 100% are honest about their limits: the
 * browser caps streamed media at 100%, while notification tones are synthesised
 * by us and do go louder.
 */
function VoiceAndSoundPage() {
  const [settings, update] = useSoundSettings();
  const { t } = useI18n();
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
      // Permission denied: device labels stay generic, the pickers still work.
    }
  }, []);

  useEffect(() => {
    void refreshDevices();
    const media = navigator.mediaDevices;
    if (!media?.addEventListener) return;
    const onChange = () => void refreshDevices();
    media.addEventListener("devicechange", onChange);
    return () => media.removeEventListener("devicechange", onChange);
  }, [refreshDevices]);

  const inputs = devices.filter((device) => device.kind === "audioinput");
  const outputs = devices.filter((device) => device.kind === "audiooutput");
  const labelsHidden = devices.length > 0 && devices.every((device) => !device.label);

  const realms = useQuery({
    queryKey: ["sound-realms"],
    queryFn: () => fetchRealms(),
    staleTime: 5 * 60_000,
  });

  const musicEffective = channelVolume(settings, "music");
  const voiceEffective = channelVolume(settings, "voice");
  const notificationsEffective = channelVolume(settings, "notifications");

  const setRealmVolume = (realmId: string, value: number) => {
    update({ realmOverrides: { ...settings.realmOverrides, [realmId]: value / 100 } });
  };

  const resetRealm = (realmId: string) => {
    const next = { ...settings.realmOverrides };
    delete next[realmId];
    update({ realmOverrides: next });
  };

  const testSound = () => {
    if (settings.muted) {
      toast.info(t("voice_muted_test"));
      return;
    }
    // The ping is synthesised, so it honours the full 0–200% range.
    playNotificationPing(notificationsEffective);
    toast.success(tf("voice_test_at", { volume: formatVolume(notificationsEffective) }));
  };

  const overriddenRealms = useMemo(
    () => (realms.data ?? []).filter((realm) => settings.realmOverrides[realm.id] !== undefined),
    [realms.data, settings.realmOverrides],
  );

  return (
    <SettingsSubPage
      title={t("settings_voice_label")}
      description={t("settings_voice_desc")}
      icon={<Volume2 className="h-5 w-5" />}
    >
      <SettingsCard>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Volume2 className="h-4 w-4 text-primary" /> Master volume
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("voice_master_desc")}
            </p>
          </div>
          <span className="shrink-0 font-display text-lg font-bold tabular-nums">
            {formatVolume(settings.master)}
          </span>
        </div>
        <VolumeSlider
          label={t("voice_master")}
          value={settings.master}
          onChange={(value) => update({ master: value })}
        />

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/5 pt-4">
          <label htmlFor="sound-muted" className="min-w-0">
            <span className="block text-sm font-semibold">{t("voice_mute_all")}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {t("voice_mute_all_desc")}
            </span>
          </label>
          <Switch
            id="sound-muted"
            checked={settings.muted}
            onCheckedChange={(checked) => update({ muted: checked })}
          />
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={testSound}
          className="mt-4 min-h-11 w-full gap-2 border-white/10 bg-white/5"
        >
          <Volume1 className="h-4 w-4" /> {t("voice_test_sound")}
        </Button>
      </SettingsCard>

      <SettingsCard>
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Music2 className="h-4 w-4 text-primary" /> Separate levels
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("voice_channels_desc")}
        </p>
        <div className="mt-4 space-y-5">
          <VolumeSlider
            label={t("voice_music_bot")}
            value={settings.music}
            effective={musicEffective}
            onChange={(value) => update({ music: value })}
            hint="Streamed media (Apple previews, YouTube) is capped at 100% by the browser."
          />
          <VolumeSlider
            label={t("voice_tts")}
            value={settings.voice}
            effective={voiceEffective}
            onChange={(value) => update({ voice: value })}
          />
          <VolumeSlider
            label={t("voice_notif_sounds")}
            value={settings.notifications}
            effective={notificationsEffective}
            onChange={(value) => update({ notifications: value })}
            hint="Alert tones are generated here, so they do go above 100%."
          />
        </div>
      </SettingsCard>

      <SettingsCard>
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Mic className="h-4 w-4 text-primary" /> Microphone
        </h2>
        <div className="mt-3 space-y-4">
          <DevicePicker
            label={t("voice_input_device")}
            value={settings.inputDeviceId}
            fallback="System default"
            devices={inputs}
            onChange={(value) => update({ inputDeviceId: value })}
          />
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">{t("voice_mic_sensitivity")}</span>
              <span className="text-sm font-bold tabular-nums">{Math.round(settings.micSensitivity * 100)}%</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              How loud you must be before the green speaking ring lights up.
            </p>
            <MicSensitivitySlider
              value={settings.micSensitivity}
              onCommit={(v) => update({ micSensitivity: v })}
              ariaLabel={t("voice_mic_sensitivity")}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="sound-denoise" className="min-w-0">
              <span className="block text-sm font-semibold">{t("voice_noise")}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Removes background hiss on the next call you join.
              </span>
            </label>
            <Switch
              id="sound-denoise"
              checked={settings.noiseSuppression}
              onCheckedChange={(checked) => update({ noiseSuppression: checked })}
            />
          </div>

          <MicLiveMeter
            inputDeviceId={settings.inputDeviceId}
            noiseSuppression={settings.noiseSuppression}
            sensitivity={settings.micSensitivity}
          />
        </div>
      </SettingsCard>

      <SettingsCard>
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Headphones className="h-4 w-4 text-primary" /> Speakers
        </h2>
        <div className="mt-3 space-y-3">
          <DevicePicker
            label={t("voice_output_device")}
            value={settings.outputDeviceId}
            fallback="System default"
            devices={outputs}
            disabled={!sinkSupported}
            hint={
              sinkSupported
                ? "Applies to calls and music in this browser."
                : "This browser can't choose an output device; use your system sound settings."
            }
            onChange={(value) => update({ outputDeviceId: value })}
          />
        </div>
      </SettingsCard>

      <SettingsCard>
        <h2 className="text-sm font-bold">Per-realm bot volume</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Turn one realm's music bot up or down without touching your global level.
        </p>
        {realms.isLoading && <p className="mt-3 text-xs text-muted-foreground">Loading your realms…</p>}
        {realms.isError && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-2.5">
            <span className="text-xs">Your realms couldn't be loaded.</span>
            <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => void realms.refetch()}>
              Retry
            </Button>
          </div>
        )}
        {!realms.isLoading && !realms.isError && (realms.data ?? []).length === 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Join a realm to give its music bot its own volume.
          </p>
        )}
        <ul className="mt-3 space-y-3">
          {(realms.data ?? []).slice(0, 12).map((realm) => {
            const override = settings.realmOverrides[realm.id];
            return (
              <li key={realm.id} className="rounded-2xl border border-white/5 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-semibold">{realm.name}</span>
                  <span className="shrink-0 text-xs font-bold tabular-nums">
                    {override === undefined ? "Default" : formatVolume(override)}
                  </span>
                </div>
                <RealmVolumeSlider
                  realmName={realm.name}
                  value={override ?? 1}
                  onCommit={(v) => setRealmVolume(realm.id, Math.round(v * 100))}
                  ariaLabel={tf("voice_bot_volume_for", { name: realm.name })}
                />
                {override !== undefined && (
                  <button
                    type="button"
                    onClick={() => resetRealm(realm.id)}
                    className="mt-1.5 text-[11px] font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    Reset to default
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {overriddenRealms.length > 0 && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            {overriddenRealms.length} realm{overriddenRealms.length === 1 ? "" : "s"} tuned. Stored with your
            preferences in <span className="font-mono">{SOUND_SETTINGS_KEY}</span>.
          </p>
        )}
      </SettingsCard>

      {labelsHidden && (
        <p className="text-[11px] text-muted-foreground">
          Device names are hidden until you allow microphone access — join a call or allow the
          permission prompt, then come back.
        </p>
      )}
    </SettingsSubPage>
  );
}

/** Per-realm bot volume: local draft while dragging, commit on release. */
function RealmVolumeSlider({
  realmName,
  value,
  onCommit,
  ariaLabel,
}: {
  realmName: string;
  value: number;
  onCommit: (v: number) => void;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  return (
    <Slider
      className="mt-2"
      value={[Math.round((draft ?? value) * 100)]}
      min={0}
      max={200}
      step={5}
      onValueChange={([v]) => setDraft((v ?? 100) / 100)}
      onValueCommit={([v]) => {
        setDraft(null);
        onCommit((v ?? 100) / 100);
      }}
      aria-label={ariaLabel ?? `${realmName} bot volume`}
    />
  );
}

/** 0–100% mic threshold: local draft while dragging, commit on release. */
function MicSensitivitySlider({
  value,
  onCommit,
  ariaLabel,
}: {
  value: number;
  onCommit: (v: number) => void;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  return (
    <Slider
      className="mt-2"
      value={[Math.round((draft ?? value) * 100)]}
      min={0}
      max={100}
      step={5}
      onValueChange={([v]) => setDraft((v ?? 50) / 100)}
      onValueCommit={([v]) => {
        setDraft(null);
        onCommit((v ?? 50) / 100);
      }}
      aria-label={ariaLabel ?? "Mic sensitivity"}
    />
  );
}

/** A 0–200% slider with the saved value and the effective (multiplied) level.
 *  Drags update a local draft; the global store commits on release so one
 *  slider can't re-render every sound subscriber per tick. */
function VolumeSlider({
  label,
  value,
  effective,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  effective?: number;
  hint?: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? value;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-sm font-bold tabular-nums">
          {formatVolume(shown)}
          {effective !== undefined && Math.abs(effective - value) > 0.001 && (
            <span className="ml-1 text-[11px] font-medium text-muted-foreground">
              → {formatVolume(effective)}
            </span>
          )}
        </span>
      </div>
      <Slider
        className="mt-2"
        value={[Math.round(shown * 100)]}
        min={0}
        max={200}
        step={5}
        onValueChange={([next]) => setDraft((next ?? 100) / 100)}
        onValueCommit={([next]) => {
          const v = (next ?? 100) / 100;
          setDraft(null);
          onChange(v);
        }}
        aria-label={label}
      />
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function DevicePicker({
  label,
  value,
  fallback,
  devices,
  disabled = false,
  hint,
  onChange,
}: {
  label: string;
  value: string | null;
  fallback: string;
  devices: MediaDeviceInfo[];
  disabled?: boolean;
  hint?: string;
  onChange: (value: string | null) => void;
}) {
  return (
    <div>
      <span className="block text-sm font-semibold">{label}</span>
      <Select
        value={value ?? "default"}
        onValueChange={(next) => onChange(next === "default" ? null : next)}
        disabled={disabled}
      >
        <SelectTrigger className="mt-1.5 h-11 border-white/10 bg-white/5">
          <SelectValue placeholder={fallback} />
        </SelectTrigger>
        <SelectContent className="glass-strong border-white/10">
          <SelectItem value="default">{fallback}</SelectItem>
          {devices.map((device, index) => (
            <SelectItem key={device.deviceId || `device-${index}`} value={device.deviceId}>
              {device.label || `${label} ${index + 1}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
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
      streamRef.current.getTracks().forEach((t: MediaStreamTrack) => t.stop());
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
    <div className="mt-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3 space-y-2">
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

      <div className="relative h-3 w-full overflow-hidden rounded-full bg-surface-2 border border-border">
        <div
          className={`h-full transition-all duration-75 rounded-full ${isAboveThreshold ? "bg-primary" : "bg-primary/50"}`}
          style={{ width: `${level}%` }}
        />
        {/* Speaking threshold marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/70 shadow-sm"
          style={{ left: `${Math.round(sensitivity * 100)}%` }}
          title={`Activation threshold: ${Math.round(sensitivity * 100)}%`}
        />
      </div>

      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>0%</span>
        <span>Threshold: {Math.round(sensitivity * 100)}%</span>
        <span>100%</span>
      </div>
    </div>
  );
}
