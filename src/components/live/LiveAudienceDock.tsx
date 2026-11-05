import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronUp,
  Copy,
  MessageCircle,
  Mic,
  MicOff,
  Music2,
  PawPrint,
  Radio,
  Send,
  Sparkles,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useVoiceCallContext } from "@/components/voice/VoiceCallProvider";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toast";
import { LIVE_SOUND_BEDS, liveModeLabel, liveSoundBedLabel } from "@/lib/live-studio";
import type { LiveRoomState } from "@/components/live/useLiveRoom";

const QUICK_ASKS = ["Say hi 👋", "React to the stream", "Collab?", "Q&A"];

function initial(name: string) {
  return (name || "?").charAt(0).toUpperCase();
}

function timeLabel(at: number) {
  return new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * Live chat, the audience list and the "wanna come on?" inbox.
 *
 * Desktop gets a rail beside the stage; phones get a thumb-sized live chat pill
 * and a bottom sheet so the stage is never permanently covered. Both variants
 * read the same controller, so a message or a request appears in whichever one
 * is mounted.
 */
export function LiveAudienceDock({
  live,
  variant,
}: {
  live: LiveRoomState;
  variant: "rail" | "mobile";
}) {
  const { call, participants, muted, toggleMute } = useVoiceCallContext();
  const liveCall = call?.kind === "live" ? call : null;
  const [open, setOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  // Pinning a bounty: a host-only action, chosen from the host's own open
  // bounties. The pin itself rides the live broadcast, so it disappears with
  // the room instead of needing a table.
  const { user } = useAuth();
  const [pinOpen, setPinOpen] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinRows, setPinRows] = useState<Array<{ id: string; title: string; prize_paws: number | null }>>([]);

  useEffect(() => {
    if (!pinOpen || !live.isHost || !user?.id) return;
    let cancelled = false;
    setPinLoading(true);
    supabase
      .from("drops")
      .select("id, title, prize_paws")
      .eq("creator_id", user.id)
      .eq("state", "open")
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setPinRows([]);
          toast.error(error.message);
        } else {
          setPinRows((data ?? []) as Array<{ id: string; title: string; prize_paws: number | null }>);
        }
        setPinLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pinOpen, live.isHost, user?.id]);
  const [note, setNote] = useState("");
  const [chatBody, setChatBody] = useState("");
  const [unseen, setUnseen] = useState(0);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const previousMessages = useRef(0);

  const stagePeople = useMemo(
    () => participants.filter((participant) => live.stageSet.has(participant.user_id)),
    [participants, live.stageSet],
  );
  const audienceCount = Math.max(0, participants.length - stagePeople.length);
  const canSpeak = live.isHost || live.isOnStage;
  const nextSound = useMemo(() => {
    const index = LIVE_SOUND_BEDS.findIndex((bed) => bed.id === live.settings.soundBed);
    return LIVE_SOUND_BEDS[(index + 1) % LIVE_SOUND_BEDS.length];
  }, [live.settings.soundBed]);

  useEffect(() => {
    if (live.messages.length <= previousMessages.current) {
      previousMessages.current = live.messages.length;
      return;
    }
    const grew = live.messages.length - previousMessages.current;
    previousMessages.current = live.messages.length;
    if (variant === "rail" || open) {
      const scroller = chatScrollRef.current;
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    } else {
      setUnseen((value) => value + grew);
    }
  }, [live.messages.length, open, variant]);

  useEffect(() => {
    if (open) setUnseen(0);
  }, [open]);

  const submitChat = () => {
    if (!live.canChat || !chatBody.trim()) return;
    if (live.sendChat(chatBody)) setChatBody("");
  };

  const sendAsk = async () => {
    const sent = await live.askToJoin(note);
    if (!sent) return;
    setRequestOpen(false);
    setNote("");
    setOpen(true);
  };

  const copyLink = () => {
    void live.copyInvite();
  };

  const panel = (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3.5 py-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ff5d68]/35 bg-[#ff5d68]/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#ff8a91]">
          <span className="live-dot h-1.5 w-1.5" />
          Live chat
        </span>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Users className="h-3 w-3" />
          {live.viewerCount} here
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={copyLink}
            aria-label="Copy live invite link"
            title="Copy live invite link"
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          {canSpeak && (
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? "Unmute yourself" : "Mute yourself"}
              title={muted ? "Unmute yourself" : "Mute yourself"}
              className={`grid h-8 w-8 place-items-center rounded-lg border transition-colors ${
                muted
                  ? "border-destructive/40 bg-destructive/15 text-destructive hover:bg-destructive/25"
                  : "border-primary/40 bg-primary/15 text-primary hover:bg-primary/25"
              }`}
            >
              {muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </header>

      {live.isHost ? (
        <div className="shrink-0 border-b border-white/8 px-3.5 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => live.updateSettings({ requests: !live.settings.requests })}
              className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[10px] font-semibold transition-colors ${
                live.settings.requests
                  ? "border-primary/35 bg-primary/10 text-primary"
                  : "border-white/10 bg-white/[0.03] text-muted-foreground"
              }`}
            >
              <UserPlus className="h-3 w-3" />
              {live.settings.requests ? "Requests on" : "Requests off"}
            </button>
            <button
              type="button"
              onClick={() =>
                live.updateSettings({
                  chatAudience: live.settings.chatAudience === "everyone" ? "stage" : "everyone",
                })
              }
              className="inline-flex h-7 items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <MessageCircle className="h-3 w-3" />
              {live.settings.chatAudience === "everyone" ? "Chat: everyone" : "Chat: stage"}
            </button>
            <button
              type="button"
              onClick={() => live.updateSettings({ soundBed: nextSound.id })}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <Music2 className="h-3 w-3" />
              {liveSoundBedLabel(live.settings.soundBed)}
            </button>
            <button
              type="button"
              onClick={() => setPinOpen(true)}
              aria-pressed={Boolean(live.pinnedBounty)}
              className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[10px] font-semibold transition-colors ${
                live.pinnedBounty
                  ? "border-primary/45 bg-primary/10 text-primary"
                  : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground"
              }`}
            >
              <PawPrint className="h-3 w-3" />
              {live.pinnedBounty ? "Bounty pinned" : "Pin bounty"}
            </button>
            <button
              type="button"
              onClick={live.toggleAmbience}
              aria-label={live.ambienceMuted ? "Turn sound bed back on" : "Mute the sound bed"}
              className="grid h-7 w-7 place-items-center rounded-full border border-white/10 text-muted-foreground transition-colors hover:text-foreground"
            >
              {live.ambienceMuted ? (
                <VolumeX className="h-3 w-3" />
              ) : (
                <Volume2 className="h-3 w-3" />
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="shrink-0 border-b border-white/8 px-3.5 py-2.5">
          {live.isOnStage ? (
            <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/[0.08] px-2.5 py-2">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-primary">You're on stage</p>
                <p className="text-[10px] text-muted-foreground">
                  {muted ? "Unmute to say hi." : "You're live. Camera is yours."}
                </p>
              </div>
              <button
                type="button"
                onClick={toggleMute}
                className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-[10px] font-black text-primary-foreground"
              >
                {muted ? "Unmute" : "Mute"}
              </button>
            </div>
          ) : live.requested ? (
            <div className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.06] px-2.5 py-2">
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
              <p className="min-w-0 flex-1 text-[11px] text-muted-foreground">
                Ask sent. The host will bring you up.
              </p>
              <button
                type="button"
                onClick={() => void live.cancelAsk()}
                className="shrink-0 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          ) : live.settings.requests ? (
            <button
              type="button"
              onClick={() => setRequestOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/35 bg-primary/[0.08] px-3 py-2 text-[11px] font-bold text-primary transition-colors hover:bg-primary/15"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Wanna come on live?
            </button>
          ) : (
            <p className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-center text-[10px] text-muted-foreground">
              The host has requests off right now.
            </p>
          )}
        </div>
      )}

      {live.isHost && live.requests.length > 0 && (
        <div className="shrink-0 space-y-2 border-b border-primary/15 bg-primary/[0.035] px-3.5 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">
            Wanna come on? · {live.requests.length}
          </p>
          {live.requests.map((request) => (
            <div
              key={request.userId}
              className="rounded-xl border border-white/10 bg-[#17131f] p-2.5"
            >
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8 ring-1 ring-primary/35">
                  <AvatarImage src={request.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-primary/20 text-[10px] font-black text-primary">
                    {initial(request.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold text-foreground">{request.name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">@{request.username}</p>
                </div>
              </div>
              {request.note && (
                <p className="mt-1.5 rounded-lg bg-black/25 px-2 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
                  “{request.note}”
                </p>
              )}
              <div className="mt-2 flex gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => live.approve(request)}
                  className="h-7 flex-1 border-0 bg-primary px-2 text-[10px] font-black text-primary-foreground hover:bg-primary/90"
                >
                  <Check className="h-3 w-3" /> Bring on
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => live.decline(request)}
                  className="h-7 border-white/10 bg-transparent px-2 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" /> Not yet
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {stagePeople.length > 0 && (
        <div className="shrink-0 border-b border-white/8 px-3.5 py-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              On stage
            </span>
            <span className="flex -space-x-1.5">
              {stagePeople.slice(0, 5).map((participant) => (
                <Avatar
                  key={participant.user_id}
                  className="h-5 w-5 ring-2 ring-[#141019]"
                >
                  <AvatarImage src={participant.user?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary/20 text-[8px] font-black text-primary">
                    {initial(participant.user?.display_name || participant.user?.username || "?")}
                  </AvatarFallback>
                </Avatar>
              ))}
            </span>
            <span className="text-[9px] text-muted-foreground">
              {stagePeople.length} · {audienceCount} watching
            </span>
          </div>
        </div>
      )}

      <div
        ref={chatScrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 py-3"
      >
        {live.messages.length === 0 ? (
          <div className="grid min-h-[120px] place-items-center px-4 text-center">
            <div>
              <Radio className="mx-auto mb-2 h-5 w-5 text-muted-foreground/60" />
              <p className="text-[11px] font-semibold text-muted-foreground">
                {live.isHost ? "Your audience can talk here." : "Say hi to the room."}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground/70">
                Live chat disappears when the room ends.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {live.messages.map((message) =>
              message.system ? (
                <p
                  key={message.id}
                  className="mx-auto max-w-[95%] rounded-full border border-primary/15 bg-primary/[0.05] px-2.5 py-1 text-center text-[9px] font-semibold text-primary/80"
                >
                  {message.body}
                </p>
              ) : (
                <div key={message.id} className="flex items-start gap-2">
                  <Avatar className="mt-0.5 h-6 w-6 shrink-0">
                    <AvatarImage src={message.avatarUrl ?? undefined} />
                    <AvatarFallback className="bg-white/10 text-[9px] font-bold">
                      {initial(message.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className={`truncate text-[11px] font-bold ${
                          message.userId === liveCall?.hostId ? "text-primary" : "text-foreground"
                        }`}
                      >
                        {message.name}
                      </span>
                      <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground/70">
                        {timeLabel(message.at)}
                      </span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-foreground/85">
                      {message.body}
                    </p>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitChat();
        }}
        className="shrink-0 border-t border-white/10 bg-black/20 p-2.5"
      >
        {live.canChat ? (
          <div className="flex items-center gap-2">
            <input
              value={chatBody}
              onChange={(event) => setChatBody(event.target.value)}
              placeholder={live.isHost ? "Reply to your audience…" : "Say something nice…"}
              maxLength={500}
              enterKeyHint="send"
              aria-label="Live chat message"
              className="h-10 min-w-0 flex-1 rounded-full border border-white/10 bg-black/40 px-3.5 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={!chatBody.trim()}
              aria-label="Send live chat message"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <p className="rounded-full border border-white/8 px-3 py-2 text-center text-[10px] text-muted-foreground">
            The host opened chat to the stage only.
          </p>
        )}
      </form>
    </div>
  );

  const mobileDock = (
    <>
      <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+5.75rem)] z-[135] flex items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-full border border-white/15 bg-[#15121d]/95 px-4 text-[11px] font-bold text-foreground shadow-lg backdrop-blur-md transition active:scale-[0.99]"
        >
          <MessageCircle className="h-4 w-4 text-primary" />
          Live chat
          {unseen > 0 && (
            <span className="grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-black leading-4 text-primary-foreground">
              {unseen > 9 ? "9+" : unseen}
            </span>
          )}
          {live.isHost && live.requests.length > 0 && (
            <span className="grid min-w-4 place-items-center rounded-full bg-[#ff5d68] px-1 text-[9px] font-black leading-4 text-white">
              {live.requests.length}
            </span>
          )}
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        {!live.isHost && !live.isOnStage && live.settings.requests && !live.requested && (
          <button
            type="button"
            onClick={() => setRequestOpen(true)}
            className="grid min-h-[42px] w-[42px] shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg"
            aria-label="Ask to come on live"
          >
            <UserPlus className="h-4 w-4" />
          </button>
        )}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="z-[150] flex h-[78dvh] flex-col gap-0 overflow-hidden rounded-t-3xl border-white/10 bg-[#100d17] p-0"
        >
          <SheetHeader className="shrink-0 border-b border-white/10 px-4 py-3 text-left">
            <SheetTitle className="flex items-center gap-2 font-display text-base">
              <span className="live-dot h-2 w-2" />
              Live room
            </SheetTitle>
            <SheetDescription className="sr-only">
              Audience chat, stage and join requests
            </SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col">{panel}</div>
        </SheetContent>
      </Sheet>
    </>
  );

  const rail = (
    <aside className="sticky top-0 flex w-[300px] shrink-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#100d17] shadow-[0_20px_60px_-30px_rgba(0,0,0,.9)]">
      <div className="flex max-h-[calc(100dvh-10.5rem)] min-h-[360px] flex-col">
        {panel}
      </div>
    </aside>
  );

  return (
    <>
      {variant === "rail" ? rail : mobileDock}
      <Sheet open={pinOpen} onOpenChange={setPinOpen}>
        <SheetContent
          side="bottom"
          className="z-[160] max-h-[80dvh] overflow-y-auto rounded-t-3xl border-white/10 bg-[#100d17] pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
          <SheetHeader className="text-left">
            <SheetTitle className="font-display text-xl">Pin a bounty</SheetTitle>
            <SheetDescription>
              The card sits over your stream with a Claim button until you clear it.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-3 space-y-2">
            {live.pinnedBounty ? (
              <button
                type="button"
                onClick={() => {
                  live.pinBounty(null);
                  setPinOpen(false);
                }}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.03] text-[12px] font-semibold text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" /> Clear the pinned bounty
              </button>
            ) : null}
            {pinLoading ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Loading your bounties…</p>
            ) : null}
            {!pinLoading && pinRows.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-6 text-center text-xs text-muted-foreground">
                No open bounties right now. Post one from Drops, then pin it here.
              </p>
            ) : null}
            {pinRows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  if (!user) return;
                  live.pinBounty({
                    id: row.id,
                    title: row.title,
                    paws: Number(row.prize_paws ?? 0),
                    hostId: user.id,
                  });
                  setPinOpen(false);
                  toast.success("Pinned to your stream");
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left transition-colors hover:border-primary/35 hover:bg-primary/[0.06]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                  <PawPrint className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold">{row.title}</span>
                  <span className="block text-[10px] tabular-nums text-muted-foreground">
                    {Number(row.prize_paws ?? 0)} Paws
                  </span>
                </span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={requestOpen} onOpenChange={setRequestOpen}>
        <SheetContent
          side="bottom"
          className="z-[160] max-h-[88dvh] overflow-y-auto rounded-t-3xl border-white/10 bg-[#100d17] pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
          <SheetHeader className="text-left">
            <span className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-primary">
              <Sparkles className="h-3 w-3" />
              Stage request
            </span>
            <SheetTitle className="font-display text-2xl leading-tight text-foreground">
              Wanna come on live?
            </SheetTitle>
            <SheetDescription className="text-[12px] leading-relaxed text-muted-foreground">
              Send the host a tiny hello. If they bring you up, unmute and join the
              conversation — no pressure to turn your camera on.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex -space-x-2">
              <Avatar className="h-10 w-10 ring-2 ring-[#100d17]">
                <AvatarImage src={profileAvatarFromParticipants(participants, liveCall?.hostId)} />
                <AvatarFallback className="bg-primary/20 text-[11px] font-black text-primary">
                  {initial(hostNameFromParticipants(participants, liveCall?.hostId))}
                </AvatarFallback>
              </Avatar>
              <Avatar className="h-10 w-10 ring-2 ring-[#100d17]">
                <AvatarFallback className="bg-white/10 text-[11px] font-black text-foreground">
                  you
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-foreground">
                @{hostUsernameFromParticipants(participants, liveCall?.hostId)} is hosting
              </p>
              <p className="text-[10px] text-muted-foreground">
                {live.viewerCount} watching · {liveModeLabel(live.settings.mode)}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Give them a reason
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_ASKS.map((quick) => (
                <button
                  key={quick}
                  type="button"
                  onClick={() => setNote(quick)}
                  className={`rounded-full border px-2.5 py-1.5 text-[10px] font-semibold transition-colors ${
                    note === quick
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {quick}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value.slice(0, 140))}
              rows={3}
              placeholder="I’ve got a hot take / a question / a cat…"
              className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-[12px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <div className="mt-1 flex items-center justify-between text-[9px] text-muted-foreground">
              <span>The host can see who asked and why.</span>
              <span className="tabular-nums">{note.length}/140</span>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => void sendAsk()}
            disabled={!live.settings.requests}
            className="mt-4 h-11 w-full border-0 bg-primary text-[12px] font-black text-primary-foreground shadow-[0_10px_30px_-12px_var(--brand-signal)]"
          >
            <Send className="h-4 w-4" />
            Send the ask
          </Button>
          <p className="mt-2 text-center text-[9px] leading-relaxed text-muted-foreground">
            The room ends when the host leaves. Nothing is recorded.
          </p>
        </SheetContent>
      </Sheet>
    </>
  );
}

function hostNameFromParticipants(
  participants: ReturnType<typeof useVoiceCallContext>["participants"],
  hostId: string | null | undefined,
) {
  const host = participants.find((participant) => participant.user_id === hostId);
  return host?.user?.display_name || host?.user?.username || "The host";
}

function hostUsernameFromParticipants(
  participants: ReturnType<typeof useVoiceCallContext>["participants"],
  hostId: string | null | undefined,
) {
  return (
    participants.find((participant) => participant.user_id === hostId)?.user?.username ??
    "the host"
  );
}

function profileAvatarFromParticipants(
  participants: ReturnType<typeof useVoiceCallContext>["participants"],
  hostId: string | null | undefined,
) {
  return (
    participants.find((participant) => participant.user_id === hostId)?.user?.avatar_url ?? undefined
  );
}
