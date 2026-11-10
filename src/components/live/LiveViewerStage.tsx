import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  Gift,
  Heart,
  PawPrint,
  Send,
  Share2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VideoTile } from "@/components/voice/VideoTile";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toast";
import { PAWS_TIP_PRESETS, sendPawsTip } from "@/lib/paws-tips";
import { dispatchGiftDrop } from "@/lib/gift-drop-bridge";
import { GIFT_CATALOG } from "@/lib/gift-catalog";
import type { LiveRoomState } from "@/components/live/useLiveRoom";

type ViewerPerson = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

type HostPerson = Omit<ViewerPerson, "id"> & {
  /** Null until the room roster names the host; the pill still draws. */
  id: string | null;
  username: string;
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
 * The live viewer, as its own screen.
 *
 * A viewer is not a meeting participant: there is no grid, no deafen/share
 * row and no camera controls. The host's video is the page, the room's life
 * happens on top of it (bounty, comments, hearts), and the only controls are
 * the ones an audience actually uses — say something, send a gift, share the
 * link, tap the heart.
 *
 * The host never sees this component; their stage and controls are unchanged.
 */
export function LiveViewerStage({
  live,
  title,
  host,
  hostStream,
  viewers,
  onClose,
}: {
  live: LiveRoomState;
  title: string;
  host: HostPerson;
  hostStream: MediaStream | null;
  viewers: ViewerPerson[];
  /** Minimize, not leave: the room keeps playing behind the app. */
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const [following, setFollowing] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const [tipAmount, setTipAmount] = useState<number>(PAWS_TIP_PRESETS[1]);
  const [tipping, setTipping] = useState(false);
  const [hearts, setHearts] = useState<Array<{ id: number; drift: number }>>([]);
  const heartSeq = useRef(0);
  const commentTimer = useRef<number[]>([]);

  const hostId = host.id;
  const isSelf = Boolean(user?.id && hostId && user.id === hostId);

  useEffect(() => {
    if (!user?.id || !hostId || isSelf) {
      setFollowing(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("following_id", hostId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setFollowing(Boolean(data));
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, hostId, isSelf]);

  useEffect(
    () => () => {
      commentTimer.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  const toggleFollow = async () => {
    if (!user?.id || !hostId || isSelf) return;
    const next = !following;
    setFollowing(next);
    try {
      if (next) {
        const { error } = await supabase
          .from("follows")
          .insert({ follower_id: user.id, following_id: hostId });
        if (error && !/duplicate|unique/i.test(error.message)) throw error;
      } else {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", hostId);
        if (error) throw error;
      }
    } catch (error) {
      setFollowing(!next);
      toast.error(error instanceof Error ? error.message : "Couldn't update that follow");
    }
  };

  const comments = useMemo(() => live.messages.slice(-5), [live.messages]);

  const saySomething = (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (!live.canChat) {
      toast("Only people on stage can chat right now");
      return;
    }
    const sent = live.sendChat(text);
    if (sent) {
      setDraft("");
      return;
    }
    toast.error("The room isn't connected yet — try again in a moment");
  };

  const tapHeart = () => {
    live.sendHeart();
    const id = ++heartSeq.current;
    setHearts((current) => [...current.slice(-11), { id, drift: Math.round(Math.random() * 28 - 14) }]);
    // One timer per heart so a burst cleans up exactly, not all at once.
    const timer = window.setTimeout(
      () => setHearts((current) => current.filter((heart) => heart.id !== id)),
      1900,
    );
    commentTimer.current.push(timer);
  };

  const tip = async () => {
    if (!hostId) return;
    setTipping(true);
    try {
      await sendPawsTip({ to: hostId, amount: tipAmount, note: `Live tip · ${title}` });
      live.sendChat(`🎁 tipped ${tipAmount} Paws`);
      toast.success(`Sent ${tipAmount} Paws to ${host.name}`);
      setTipOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send that tip");
    } finally {
      setTipping(false);
    }
  };

  const sendLuxuryGift = async (gift: (typeof GIFT_CATALOG)[number]) => {
    if (!hostId || !user?.id) return;
    setTipping(true);
    try {
      await sendPawsTip({
        to: hostId,
        amount: gift.pawsPrice,
        note: `Luxury gift · ${gift.name}`,
      });
      // Broadcast the flex so every viewer in the room plays the overlay.
      void live.sendBroadcast("gift", {
        slug: gift.slug,
        sender: user.id,
        receiver: hostId,
        message: `Sent you a ${gift.name}`,
      });
      // Local flex for the sender too.
      dispatchGiftDrop(gift.slug, user.id, hostId, `Sent you a ${gift.name}`);
      toast.success(`Sent ${gift.name} to ${host.name}`);
      setTipOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send that flex");
    } finally {
      setTipping(false);
    }
  };

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-black text-white">
      {/* The host is the page. A camera-off room still needs a face, so the
          avatar sits behind a soft lime wash instead of a blank rectangle. */}
      <div className="absolute inset-0">
        {hostStream ? (
          <VideoTile stream={hostStream} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-[radial-gradient(120%_90%_at_20%_0%,rgba(201,255,61,0.16),transparent_55%),radial-gradient(90%_80%_at_90%_100%,rgba(139,124,246,0.18),transparent_60%)]">
            <Avatar className="h-24 w-24 ring-2 ring-primary/60">
              <AvatarImage src={host.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-primary text-3xl font-black text-primary-foreground">
                {initial(host.name)}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/5 to-black/85" />
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
            <p className="max-w-[7.5rem] truncate text-[12px] font-bold leading-tight">
              {host.name}
            </p>
            <p className="flex items-center gap-1 text-[10px] leading-tight text-white/70">
              <Heart className="h-2.5 w-2.5 fill-[#ff5d8f] text-[#ff5d8f]" />
              <span className="tabular-nums">{compact(live.heartCount)}</span>
            </p>
          </div>
          {!isSelf && hostId ? (
            <button
              type="button"
              onClick={() => void toggleFollow()}
              className={`ml-1 inline-flex h-7 items-center gap-1 rounded-full px-3 text-[11px] font-bold transition-colors ${
                following
                  ? "border border-white/25 bg-white/10 text-white"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {following ? <Check className="h-3 w-3" /> : null}
              {following ? "Following" : "Follow"}
            </button>
          ) : null}
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
            onClick={onClose}
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

      {/* ---------- hearts ---------- */}
      <div className="pointer-events-none absolute bottom-24 right-2 z-20 h-56 w-10" aria-hidden="true">
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

      {/* ---------- pinned bounty, comments ---------- */}
      <div className="relative z-20 mt-auto flex min-h-0 flex-col gap-2 px-3 pb-2">
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
              <Link
                to="/drops"
                className="grid h-9 shrink-0 place-items-center rounded-full bg-primary px-4 text-[12px] font-black text-primary-foreground"
              >
                Claim
              </Link>
            </div>
          </div>
        ) : null}

        {comments.length > 0 ? (
          <div className="flex max-h-[32dvh] flex-col justify-end gap-1.5 overflow-hidden">
            {comments.map((message, index) =>
              message.system ? (
                <div
                  key={message.id}
                  className="live-comment-in flex w-fit max-w-full items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary ring-1 ring-inset ring-primary/30"
                  style={{ animationDelay: `${index * 20}ms` }}
                >
                  <UserPlus className="h-3 w-3 shrink-0" />
                  <span className="truncate">{message.body}</span>
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
                  <span className="truncate text-white">{message.body}</span>
                </div>
              ),
            )}
          </div>
        ) : null}
      </div>

      {/* ---------- bottom bar ---------- */}
      <div
        className="relative z-20 flex items-center gap-2 px-3 pt-1"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
      >
        <form onSubmit={saySomething} className="min-w-0 flex-1">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={live.canChat ? "Say something..." : "Chat is off in this room"}
            disabled={!live.canChat}
            enterKeyHint="send"
            aria-label="Say something in live chat"
            className="h-11 w-full rounded-full border border-white/[0.14] bg-black/55 px-3.5 text-[13px] text-white placeholder:text-white/55 backdrop-blur-md focus:border-primary/70 focus:outline-none disabled:opacity-60"
          />
          {draft.trim() ? (
            <button type="submit" className="sr-only">
              Send
            </button>
          ) : null}
        </form>

        <button
          type="button"
          onClick={() => setTipOpen(true)}
          aria-label="Send a Paws gift"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#8b7cf6]/50 bg-[#8b7cf6]/20 text-[#d9ccff] backdrop-blur-md transition active:scale-95"
        >
          <Gift className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => void live.copyInvite()}
          aria-label="Share live"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/[0.14] bg-black/55 text-white backdrop-blur-md transition active:scale-95"
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

      {/* ---------- Paws tip sheet ---------- */}
      <Sheet open={tipOpen} onOpenChange={setTipOpen}>
        <SheetContent
          side="bottom"
          hideClose
          className="glass-strong z-[140] rounded-t-3xl border-white/10 pb-[max(env(safe-area-inset-bottom),1rem)]"
        >
          <SheetTitle className="sr-only">Send a Paws gift</SheetTitle>
          <div className="mx-auto mb-3 mt-1 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
              <PawPrint className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-lg font-bold">Send Paws to {host.name}</p>
              <p className="text-[11px] text-muted-foreground">
                In-app only. Paws never become cash.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {PAWS_TIP_PRESETS.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setTipAmount(amount)}
                aria-pressed={tipAmount === amount}
                className={`h-12 rounded-2xl border text-sm font-black tabular-nums transition-colors ${
                  tipAmount === amount
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-white/12 bg-white/[0.04] text-foreground hover:bg-white/[0.08]"
                }`}
              >
                {amount}
              </button>
            ))}
          </div>
          <div className="mt-6 border-t border-white/10 pt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60 mb-3">
              Luxury Flexes
            </p>
            <div className="grid grid-cols-4 gap-2">
              {GIFT_CATALOG.map((gift) => (
                <button
                  key={gift.slug}
                  type="button"
                  onClick={() => void sendLuxuryGift(gift)}
                  disabled={tipping}
                  aria-label={`Send ${gift.name} (${gift.pawsPrice} Paws)`}
                  className="flex flex-col items-center gap-1 h-16 rounded-2xl border border-white/10 bg-black/40 px-2 py-2 text-xs font-black transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span className="text-[24px]">{gift.emoji}</span>
                  <span className="truncate text-[10px] leading-tight text-white">{gift.name}</span>
                  <span className="text-[10px] text-[#c9ff3d]">{gift.pawsPrice}</span>
                </button>
              ))}
            </div>
          </div>
          <Button
            type="button"
            onClick={() => void tip()}
            disabled={tipping || !hostId}
            className="mt-4 h-12 w-full rounded-2xl border-0 bg-primary text-sm font-black text-primary-foreground"
          >
            {tipping ? "Sending…" : `Tip ${tipAmount} Paws`}
          </Button>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            The tip lands in {host.name}&apos;s Paws wallet immediately.
          </p>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default LiveViewerStage;
