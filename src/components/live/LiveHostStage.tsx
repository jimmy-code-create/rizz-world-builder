import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Check,
  Heart,
  Mic,
  MicOff,
  MonitorUp,
  PawPrint,
  PhoneOff,
  Settings,
  Share2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VideoTile } from "@/components/voice/VideoTile";
import { LiveAudienceDock } from "@/components/live/LiveAudienceDock";
import type { LiveRoomState } from "@/components/live/useLiveRoom";
import { EmojiText } from "@/components/emoji/EmojiText";

type Person = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

function initial(name: string) {
  return (name || "?").charAt(0).toUpperCase();
}

function compact(value: number) {
  if (value < 1000) return String(value);
  if (value < 10_000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${Math.round(value / 1000)}K`;
}

/**
 * The host's side of a live room.
 *
 * A host is not in a call either: their camera (or their screen) is the page,
 * the room's chat lives on top of it, and the controls are the broadcast ones —
 * mic, camera, screen, settings, end. The studio grid, deafen button and tile
 * layout belong to voice channels; a live room never shows them to its host.
 */
export function LiveHostStage({
  live,
  title,
  host,
  cameraStream,
  screenStream,
  viewers,
  guests,
  muted,
  cameraOn,
  sharingScreen,
  screenSupported,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onOpenSettings,
  onMinimize,
  onEnd,
}: {
  live: LiveRoomState;
  title: string;
  host: Person & { username: string };
  cameraStream: MediaStream | null;
  screenStream: MediaStream | null;
  viewers: Person[];
  /** People the host brought on stage: they keep their camera and their voice. */
  guests: Array<{ id: string; name: string; stream: MediaStream | null }>;
  muted: boolean;
  cameraOn: boolean;
  sharingScreen: boolean;
  screenSupported: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onOpenSettings: () => void;
  onMinimize: () => void;
  onEnd: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [hearts, setHearts] = useState<Array<{ id: number; drift: number }>>([]);
  const heartSeq = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  const comments = useMemo(() => live.messages.slice(-5), [live.messages]);
  const background = sharingScreen ? screenStream : cameraOn ? cameraStream : null;

  const saySomething = (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (live.sendChat(text)) setDraft("");
  };

  const tapHeart = () => {
    live.sendHeart();
    const id = ++heartSeq.current;
    setHearts((current) => [...current.slice(-11), { id, drift: Math.round(Math.random() * 28 - 14) }]);
    const timer = window.setTimeout(
      () => setHearts((current) => current.filter((heart) => heart.id !== id)),
      1900,
    );
    timers.current.push(timer);
  };

  const control =
    "grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-md transition active:scale-95 disabled:opacity-40";

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-black text-white">
      <div className="absolute inset-0">
        {background ? (
          <VideoTile
            stream={background}
            className={sharingScreen ? "object-contain! bg-black" : "scale-x-[-1]"}
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-[radial-gradient(120%_90%_at_20%_0%,rgba(201,255,61,0.14),transparent_55%),radial-gradient(90%_80%_at_90%_100%,rgba(139,124,246,0.2),transparent_60%)]">
            <Avatar className="h-24 w-24 ring-2 ring-primary/60">
              <AvatarImage src={host.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-primary text-3xl font-black text-primary-foreground">
                {initial(host.name)}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/65 via-transparent to-black/85" />
      </div>

      {/* ---------- top row ---------- */}
      <div className="relative z-20 flex items-start justify-between gap-2 px-3 pt-3">
        <div className="flex min-w-0 items-center gap-2 rounded-full bg-black/55 py-1 pl-1 pr-1.5 backdrop-blur-md">
          <Avatar className="h-9 w-9 ring-2 ring-primary">
            <AvatarImage src={host.avatarUrl ?? undefined} />
            <AvatarFallback className="bg-primary text-sm font-black text-primary-foreground">
              {initial(host.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="max-w-[7.5rem] truncate text-[12px] font-bold leading-tight">{host.name}</p>
            <p className="flex items-center gap-1 text-[10px] leading-tight text-white/70">
              <Heart className="h-2.5 w-2.5 fill-[#ff5d8f] text-[#ff5d8f]" />
              <span className="tabular-nums">{compact(live.heartCount)}</span>
            </p>
          </div>
          <span className="ml-1 inline-flex h-7 items-center rounded-full border border-white/20 bg-white/10 px-2 text-[10px] font-black uppercase tracking-[0.1em] text-white/80">
            Host
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {viewers.length > 0 ? (
            <div className="flex items-center">
              {viewers.slice(0, 3).map((person, index) => (
                <Avatar
                  key={person.id}
                  className="h-7 w-7 border-2 border-black"
                  style={{ marginLeft: index === 0 ? 0 : -10, zIndex: 3 - index }}
                >
                  <AvatarImage src={person.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-[#2a2a2a] text-[9px] font-bold text-white">
                    {initial(person.name)}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
          ) : null}
          <span className="inline-flex h-7 items-center gap-1 rounded-full bg-black/55 px-2.5 text-[11px] font-semibold backdrop-blur-md">
            <Users className="h-3 w-3" />
            <span className="tabular-nums">{compact(live.viewerCount)}</span>
          </span>
          <button
            type="button"
            onClick={onMinimize}
            aria-label="Minimize live"
            className="grid h-9 w-9 place-items-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ---------- live badge + title ---------- */}
      <div className="relative z-20 mt-2 flex min-w-0 items-center gap-2 px-3">
        <span className="inline-flex h-[22px] shrink-0 items-center gap-1 rounded-md bg-[#ff2d55] px-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-white">
          <span className="live-dot h-1.5 w-1.5 bg-white" />
          Live
        </span>
        <h1 className="truncate text-[12px] font-semibold text-white/90">{title}</h1>
      </div>

      {guests.length > 0 ? (
        <div className="relative z-20 mt-2 flex gap-2 overflow-x-auto px-3 no-scrollbar">
          {guests.map((guest) => (
            <div
              key={guest.id}
              className="relative h-24 w-[68px] shrink-0 overflow-hidden rounded-xl border border-white/15 bg-black/50"
            >
              {guest.stream ? (
                <VideoTile stream={guest.stream} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-[#2a2a2a] text-[10px] font-bold text-white">
                      {initial(guest.name)}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[9px] font-semibold text-white">
                {guest.name}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {/* ---------- hearts ---------- */}
      <div className="pointer-events-none absolute bottom-28 right-2 z-20 h-56 w-10" aria-hidden="true">
        {hearts.map((heart) => (
          <span
            key={heart.id}
            className="live-heart-float absolute bottom-0 right-2"
            style={{ marginRight: heart.drift }}
          >
            <Heart className="h-6 w-6 fill-[#ff4d6d] text-[#ff4d6d] drop-shadow-[0_2px_8px_rgba(255,77,109,0.5)]" />
          </span>
        ))}
      </div>

      {/* ---------- join requests, pinned bounty, comments ---------- */}
      <div className="relative z-20 mt-auto flex min-h-0 flex-col gap-2 px-3 pb-2">
        {live.requests.slice(0, 2).map((request) => (
          <div
            key={request.userId}
            className="flex items-center gap-2 rounded-2xl border border-primary/40 bg-black/65 p-2 backdrop-blur-md"
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={request.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-[#2a2a2a] text-[10px] font-bold text-white">
                {initial(request.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-bold text-white">
                {request.name} wants to come on
              </p>
              <p className="truncate text-[10px] text-white/60">{request.note || "Tap to bring them up"}</p>
            </div>
            <button
              type="button"
              onClick={() => live.approve(request)}
              aria-label={`Bring ${request.name} on stage`}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => live.decline(request)}
              aria-label={`Decline ${request.name}`}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/20 text-white/75"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}

        {live.pinnedBounty ? (
          <div className="rounded-2xl border border-primary/70 bg-black/55 p-2.5 backdrop-blur-md">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
              <PawPrint className="h-3 w-3" />
              Pinned
            </p>
            <div className="mt-1 flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-[15px] font-black leading-tight text-white">
                  <PawPrint className="h-4 w-4 text-primary" />
                  <span className="tabular-nums">{compact(live.pinnedBounty.paws)}</span>
                </p>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-white/75">
                  {live.pinnedBounty.title}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {comments.length > 0 ? (
          <div className="flex max-h-[26dvh] flex-col justify-end gap-1.5 overflow-hidden">
            {comments.map((message, index) =>
              message.system ? (
                <div
                  key={message.id}
                  className="live-comment-in flex w-fit max-w-full items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary ring-1 ring-inset ring-primary/30"
                  style={{ animationDelay: `${index * 20}ms` }}
                >
                  <UserPlus className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    <EmojiText text={message.body} className="truncate" />
                  </span>
                </div>
              ) : (
                <div
                  key={message.id}
                  className="live-comment-in flex w-fit max-w-full items-center gap-1.5 rounded-full bg-black/55 py-1 pl-1 pr-2.5 text-[11px] backdrop-blur-md"
                  style={{ animationDelay: `${index * 20}ms` }}
                >
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarImage src={message.avatarUrl ?? undefined} />
                    <AvatarFallback className="bg-[#2a2a2a] text-[8px] font-bold text-white">
                      {initial(message.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="shrink-0 font-bold text-white/80">{message.name}</span>
                  <span className="truncate text-white">
                    <EmojiText text={message.body} className="truncate" />
                  </span>
                </div>
              ),
            )}
          </div>
        ) : null}
      </div>

      {/* ---------- host controls ---------- */}
      <div
        className="relative z-20 flex items-center justify-center gap-2 px-3 pb-1"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.25rem)" }}
      >
        <button
          type="button"
          onClick={onToggleMute}
          aria-pressed={!muted}
          aria-label={muted ? "Unmute" : "Mute"}
          className={control}
        >
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={onToggleCamera}
          aria-pressed={cameraOn}
          aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
          className={control}
        >
          {cameraOn ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={onToggleScreenShare}
          disabled={!screenSupported}
          aria-pressed={sharingScreen}
          aria-label={sharingScreen ? "Stop sharing" : "Share screen"}
          className={control}
        >
          <MonitorUp className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          aria-label="Live room panel"
          className={`${control} relative`}
        >
          <Users className="h-5 w-5" />
          {live.requests.length > 0 ? (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-black text-primary-foreground">
              {live.requests.length}
            </span>
          ) : null}
        </button>
        <button type="button" onClick={onOpenSettings} aria-label="Voice settings" className={control}>
          <Settings className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setConfirmEnd(true)}
          aria-label="End live"
          className="grid h-11 w-14 shrink-0 place-items-center rounded-full bg-destructive text-destructive-foreground transition active:scale-95"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>

      {/* The dock still owns the host's audience list, join requests, pinned
          bounty and sound bed; it opens on demand instead of owning the page. */}
      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent
          side="right"
          className="z-[150] w-full border-white/10 bg-[#0b0714] p-0 sm:max-w-[340px]"
        >
          <SheetTitle className="sr-only">Live room</SheetTitle>
          <div className="flex h-full flex-col overflow-y-auto p-2">
            <LiveAudienceDock live={live} variant="rail" />
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent className="glass-strong z-[170] max-w-sm border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">End Live?</AlertDialogTitle>
            <AlertDialogDescription>
              You are the host. Leaving ends the room for everyone watching.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="glass border-white/10">Stay</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmEnd(false);
                onEnd();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              End Live
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---------- bottom bar ---------- */}
      <div
        className="relative z-20 flex items-center gap-2 px-3 pt-1"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
      >
        <form onSubmit={saySomething} className="min-w-0 flex-1">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Say something..."
            enterKeyHint="send"
            aria-label="Say something in live chat"
            className="h-11 w-full rounded-full border border-white/[0.14] bg-black/55 px-3.5 text-[13px] text-white placeholder:text-white/55 backdrop-blur-md focus:border-primary/70 focus:outline-none"
          />
        </form>
        <button
          type="button"
          onClick={() => void live.copyInvite()}
          aria-label="Share live"
          className={control}
        >
          <Share2 className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={tapHeart}
          aria-label="Send a heart"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#ff4d6d] text-white transition active:scale-90"
        >
          <Heart className="h-5 w-5 fill-current" />
        </button>
      </div>
    </div>
  );
}

export default LiveHostStage;
