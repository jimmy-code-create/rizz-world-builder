import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Camera,
  Check,
  Copy,
  Eye,
  Loader2,
  LogOut,
  MessageCircle,
  Mic,
  MicOff,
  MonitorUp,
  Music2,
  Radio,
  ScreenShare,
  Sparkles,
  Users,
  Video,
  WandSparkles,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CloseButton } from "@/components/ui/close-button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { useVoiceCallContext } from "@/components/voice/VoiceCallProvider";
import {
  LIVE_MODE_OPTIONS,
  LIVE_SOUND_BEDS,
  liveModeLabel,
  liveSoundBedLabel,
  type LiveChatScope,
  type LiveMode,
  type LiveSettings,
  type LiveSoundBed,
} from "@/lib/live-studio";

const MODE_ICONS = {
  camera: Video,
  screen: MonitorUp,
  both: ScreenShare,
} as const;

export function LiveStudioSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, profile } = useAuth();
  const { call, busy, startLiveRoom, joinLiveRoom, openView, leaveCall } = useVoiceCallContext();
  const [title, setTitle] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<LiveMode>("camera");
  const [soundBed, setSoundBed] = useState<LiveSoundBed>("off");
  const [chatAudience, setChatAudience] = useState<LiveChatScope>("everyone");
  const [requests, setRequests] = useState(true);
  const [startMuted, setStartMuted] = useState(true);

  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewRef = useRef<HTMLVideoElement>(null);

  const live = call?.kind === "live" ? call : null;
  const hosting = live?.isHost === true;
  const roomLink = live && origin ? `${origin}/live/${live.roomId}` : "";
  const hostName = profile?.display_name || profile?.username || "You";

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const stopPreview = useCallback(() => {
    setPreviewStream((stream) => {
      stream?.getTracks().forEach((track) => track.stop());
      return null;
    });
    setPreviewLoading(false);
  }, []);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      setError(null);
      setJoinInput("");
      stopPreview();
      setTitle("");
    }
  }, [open, stopPreview]);

  useEffect(() => {
    if (live) stopPreview();
  }, [live, stopPreview]);

  useEffect(() => {
    if (!previewStream || !previewRef.current) return;
    previewRef.current.srcObject = previewStream;
    void previewRef.current.play().catch(() => {});
  }, [previewStream]);

  useEffect(
    () => () => {
      previewStream?.getTracks().forEach((track) => track.stop());
    },
    [previewStream],
  );

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const testCamera = async () => {
    if (previewStream) {
      stopPreview();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("This browser can't open a camera preview");
      return;
    }
    setPreviewLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      setPreviewStream(stream);
    } catch {
      toast.error("Camera permission was not granted", {
        description: "You can still go live — the camera stays off until you turn it on.",
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const copyLink = async () => {
    if (!roomLink) return;
    if (!navigator.clipboard?.writeText) {
      toast.error("Copy isn't available in this browser");
      return;
    }
    try {
      await navigator.clipboard.writeText(roomLink);
      setCopied(true);
      toast.success("Live link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  const settings: LiveSettings = useMemo(
    () => ({
      mode,
      soundBed,
      chatAudience,
      requests,
      startMuted,
    }),
    [mode, soundBed, chatAudience, requests, startMuted],
  );

  const goLive = async () => {
    setError(null);
    const roomId = await startLiveRoom(title, settings);
    if (!roomId) {
      setError("Couldn't start the live room. Check your microphone permission and try again.");
      return;
    }
    stopPreview();
    setTitle("");
    onOpenChange(false);
    openView();
    toast.success("You're live", {
      description:
        mode === "camera"
          ? "Your room is open. The camera is yours to turn on."
          : "Use Pick a screen in the studio to choose what the room sees.",
    });
  };

  const parseRoomId = (raw: string) => {
    const value = raw.trim();
    if (!value) return "";
    const room = value.includes("/live/") ? (value.split("/live/").pop() ?? "") : value;
    return room.split(/[?#]/)[0].replace(/\/+$/, "");
  };

  const join = async () => {
    setError(null);
    const roomId = parseRoomId(joinInput);
    if (!roomId) return;
    const joined = await joinLiveRoom(roomId);
    if (!joined) {
      setError("That live room has ended, or the link is wrong.");
      return;
    }
    setJoinInput("");
    onOpenChange(false);
  };

  const endLive = () => {
    leaveCall();
    onOpenChange(false);
  };

  const previewBody = previewStream ? (
    <video
      ref={previewRef}
      muted
      playsInline
      autoPlay
      aria-label="Camera preview"
      className="h-full w-full scale-x-[-1] object-cover"
    />
  ) : (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]">
        <Camera className="h-6 w-6 text-muted-foreground" />
      </span>
      <p className="text-[11px] font-semibold text-muted-foreground">Your camera preview</p>
      <p className="max-w-[15rem] text-[10px] leading-relaxed text-muted-foreground/70">
        Nobody sees this yet. Check your look before you open the room.
      </p>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        hideClose
        className="glass-strong max-h-[90dvh] overflow-y-auto rounded-t-3xl border-white/10 pb-[max(1rem,env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-lg"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        <div className="flex items-start justify-between gap-3">
          <SheetHeader className="min-w-0 text-left">
            <SheetTitle className="flex items-center gap-2 font-display text-xl text-white">
              <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#ff5d68]/35 bg-[#ff5d68]/12 text-[#ff8a91]">
                <Radio className="h-4 w-4" />
                <span className="live-dot absolute -right-0.5 -top-0.5 h-2 w-2" />
              </span>
              Live
            </SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              Camera, screen and a room that talks back.
            </SheetDescription>
          </SheetHeader>
          <SheetClose asChild>
            <CloseButton className="-mr-2 -mt-2 shrink-0" />
          </SheetClose>
        </div>

        {live ? (
          <div className="mt-5 space-y-3">
            <div className="relative overflow-hidden rounded-2xl border border-[#ff5d68]/25 bg-[#160f15] p-4">
              <div className="flex items-start gap-3">
                <Avatar className="h-11 w-11 ring-2 ring-[#ff5d68]/30">
                  <AvatarImage src={profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-[#ff5d68]/15 text-sm font-black text-[#ff9aa1]">
                    {(hostName || "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#ff8a91]">
                    <span className="live-dot h-1.5 w-1.5" />
                    {hosting ? "You're live" : "You're watching"}
                  </p>
                  <p className="mt-1 truncate font-display text-lg font-bold text-white">
                    {live.channelName}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {hosting
                      ? "Your audience can chat, and ask to come on stage."
                      : "The host controls the room. Say hi in the audience chat."}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 p-2">
                <Input
                  readOnly
                  value={roomLink}
                  onFocus={(event) => event.currentTarget.select()}
                  aria-label="Live invite link"
                  className="h-9 min-w-0 flex-1 border-white/10 bg-white/5 font-mono text-[11px] text-white/70"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void copyLink()}
                  className="h-9 shrink-0 border-0 bg-primary text-primary-foreground shadow-md"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    openView();
                  }}
                  className="h-11 border-0 bg-primary text-primary-foreground shadow-md"
                >
                  <Video className="h-4 w-4" />
                  {hosting ? "Open studio" : "Join studio"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={endLive}
                  className="h-11 border-white/10 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  {hosting ? "End live" : "Leave room"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <LiveStat label="Sharing" value={liveModeLabel(live.liveSettings?.mode ?? "camera")} />
              <LiveStat label="Sound bed" value={liveSoundBedLabel(live.liveSettings?.soundBed ?? "off")} />
              <LiveStat
                label="Chat"
                value={live.liveSettings?.chatAudience === "stage" ? "Stage only" : "Everyone"}
              />
              <LiveStat label="Requests" value={live.liveSettings?.requests === false ? "Off" : "On"} />
            </div>

            {hosting && (
              <p className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
                The room ends when you leave. Camera stays off until you turn it on; the
                audience joins muted. Change the sound bed, chat or requests from Live chat in
                the studio.
              </p>
            )}
          </div>
        ) : call ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-bold text-white">You're already in a call</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Leave the current call before starting or joining a live room.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                type="button"
                onClick={() => {
                  openView();
                  onOpenChange(false);
                }}
                className="h-11 border-0 bg-primary text-primary-foreground shadow-md"
              >
                Open call
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={leaveCall}
                className="h-11 border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
              >
                Leave call
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {/* ---------- Pre-live: the host sees the room before anyone else ---------- */}
            <section className="rounded-2xl border border-white/10 bg-[#110e17] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/[0.08] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-primary">
                  <Sparkles className="h-3 w-3" />
                  Pre-live
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Only you see this
                </span>
              </div>
              <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                <div className="relative aspect-[16/9]">{previewBody}</div>
                <div className="flex items-center gap-2 border-t border-white/10 bg-black/25 px-2.5 py-2">
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="live-dot h-1.5 w-1.5" />
                    {liveModeLabel(mode)}
                    {startMuted && (
                      <span className="ml-1 inline-flex items-center gap-1">
                        <MicOff className="h-3 w-3" /> starts muted
                      </span>
                    )}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void testCamera()}
                    className="h-7 border-white/10 bg-white/[0.03] px-2 text-[10px] text-foreground hover:bg-white/[0.08]"
                  >
                    {previewLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : previewStream ? (
                      <MicOff className="h-3 w-3" />
                    ) : (
                      <Camera className="h-3 w-3" />
                    )}
                    {previewStream ? "Stop test" : "Check camera"}
                  </Button>
                </div>
              </div>
              <label className="mt-3 block text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Room title
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={`${hostName} is live`}
                  maxLength={80}
                  aria-label="Live room title"
                  className="glass mt-1.5 h-11 border-white/10 text-sm"
                />
              </label>
            </section>

            <section>
              <div className="flex items-end justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  What are you sharing?
                </p>
                <span className="text-[9px] text-muted-foreground/70">Camera stays opt-in</span>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {LIVE_MODE_OPTIONS.map((option) => {
                  const Icon = MODE_ICONS[option.id];
                  const selected = mode === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setMode(option.id)}
                      aria-pressed={selected}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        selected
                          ? "border-primary/50 bg-primary/[0.08]"
                          : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                      }`}
                    >
                      <span
                        className={`grid h-8 w-8 place-items-center rounded-lg ${
                          selected ? "bg-primary text-primary-foreground" : "bg-white/[0.05] text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="mt-2 block text-[11px] font-bold text-foreground">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                        {option.blurb}
                      </span>
                      {selected && (
                        <span className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.12em] text-primary">
                          <Check className="h-3 w-3" /> Selected
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                The room
              </p>
              <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-white/8 bg-black/20 px-3 py-2.5">
                <Eye className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-foreground">Anyone with the link</p>
                  <p className="text-[10px] text-muted-foreground">
                    Share it in a DM, realm or group chat.
                  </p>
                </div>
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setRequests((value) => !value)}
                  aria-pressed={requests}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    requests
                      ? "border-primary/35 bg-primary/[0.06]"
                      : "border-white/10 bg-white/[0.02]"
                  }`}
                >
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${requests ? "bg-primary/15 text-primary" : "bg-white/[0.04] text-muted-foreground"}`}>
                    <Users className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-bold text-foreground">Join requests</span>
                    <span className="block text-[10px] text-muted-foreground">
                      {requests ? "Audience can ask to come on" : "Only you can invite"}
                    </span>
                  </span>
                  <span className={`text-[9px] font-black uppercase tracking-[0.12em] ${requests ? "text-primary" : "text-muted-foreground"}`}>
                    {requests ? "On" : "Off"}
                  </span>
                </button>

                <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-foreground">
                      <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      Chat
                    </span>
                    <span className="text-[9px] text-muted-foreground">Who can type</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {([
                      { id: "everyone", label: "Everyone" },
                      { id: "stage", label: "Stage only" },
                    ] as const).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setChatAudience(option.id)}
                        aria-pressed={chatAudience === option.id}
                        className={`rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition-colors ${
                          chatAudience === option.id
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-white/8 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-end justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Background sound
                </p>
                <span className="text-[9px] text-muted-foreground/70">Plays on every device</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {LIVE_SOUND_BEDS.map((bed) => {
                  const selected = soundBed === bed.id;
                  return (
                    <button
                      key={bed.id}
                      type="button"
                      onClick={() => setSoundBed(bed.id)}
                      aria-pressed={selected}
                      className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors ${
                        selected
                          ? "border-primary/45 bg-primary/[0.07]"
                          : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                      }`}
                    >
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${selected ? "bg-primary text-primary-foreground" : "bg-white/[0.05] text-muted-foreground"}`}>
                        {bed.id === "off" ? <MicOff className="h-3.5 w-3.5" /> : <Music2 className="h-3.5 w-3.5" />}
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-[10px] font-bold ${selected ? "text-primary" : "text-foreground"}`}>
                          {bed.label}
                        </span>
                        <span className="block truncate text-[9px] text-muted-foreground">{bed.blurb}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Pre-live check
              </p>
              <button
                type="button"
                onClick={() => setStartMuted((value) => !value)}
                aria-pressed={startMuted}
                className="mt-2 flex w-full items-center gap-2.5 rounded-xl border border-white/8 px-2.5 py-2 text-left transition-colors hover:bg-white/[0.04]"
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${startMuted ? "bg-primary/15 text-primary" : "bg-white/[0.04] text-muted-foreground"}`}>
                  {startMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-bold text-foreground">Mic starts muted</span>
                  <span className="block text-[10px] text-muted-foreground">
                    {startMuted ? "Open the mic when you're ready" : "The room hears you on arrival"}
                  </span>
                </span>
                <span className={`text-[9px] font-black uppercase tracking-[0.12em] ${startMuted ? "text-primary" : "text-muted-foreground"}`}>
                  {startMuted ? "On" : "Off"}
                </span>
              </button>
              <div className="mt-2 flex items-start gap-2 px-1 text-[10px] leading-relaxed text-muted-foreground">
                <WandSparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <p>
                  You can mute, flip the camera or share your screen at any time in the studio.
                  People join the audience first; you decide who comes on stage.
                </p>
              </div>
            </section>

            <Button
              type="button"
              onClick={() => void goLive()}
              disabled={!user || busy}
              className="h-12 w-full border-0 bg-primary text-[12px] font-black text-primary-foreground shadow-[0_10px_30px_-12px_var(--brand-signal)]"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
              {busy
                ? "Opening the room…"
                : mode === "camera"
                  ? "Start camera live"
                  : mode === "screen"
                    ? "Start screen live"
                    : "Start camera + screen"}
            </Button>
            {!user && (
              <p className="text-center text-[11px] text-muted-foreground">
                <Link to="/login" className="font-semibold text-primary hover:underline">
                  Sign in
                </Link>{" "}
                to go live.
              </p>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-[9px] font-black uppercase tracking-[0.22em] text-white/35">
                  or join a room
                </span>
              </div>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void join();
              }}
              className="flex gap-2"
            >
              <Input
                value={joinInput}
                onChange={(event) => setJoinInput(event.target.value)}
                placeholder="Paste a live link or room ID"
                aria-label="Live room link or room ID"
                autoComplete="off"
                spellCheck={false}
                className="glass h-11 border-white/10 text-sm"
              />
              <Button
                type="submit"
                disabled={!joinInput.trim() || busy || !user}
                className="h-11 shrink-0 border-0 bg-white/10 px-5 text-white hover:bg-white/15"
              >
                Join
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
            <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">
              Live rooms are not recorded. The room closes when the host leaves.
            </p>
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}

function LiveStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
      <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-[11px] font-bold text-foreground">{value}</p>
    </div>
  );
}
