import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Eye, RefreshCw } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CloseButton } from "@/components/ui/close-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/avatar";
import { RizzCat } from "@/components/RizzCat";
import { RizzLiveIcon } from "@/components/live/RizzLiveIcon";
import { OPEN_LIVE_STUDIO_EVENT } from "@/components/live/LiveNowChip";
import { useVoiceCallContext } from "@/components/voice/VoiceCallProvider";
import { useLiveAndVibing, type LiveStream } from "@/lib/live-and-vibing";

/**
 * The Live browser.
 *
 * Tapping the Live chip opens this full-screen list of every host who is on air
 * right now. A row is a direct door: one tap joins that host's room and opens
 * the dedicated /live/$roomId audience viewer, where people watch/listen and
 * can raise a hand if they want to come on stage.
 *
 * Only live streams are listed. The sheet deliberately does not mix in voice
 * channels or vibing statuses: this surface answers one question, "who is live?"
 */
export function LiveBrowserSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading, isError, refetch } = useLiveAndVibing({ open });
  const { call, leaveCall } = useVoiceCallContext();
  const navigate = useNavigate();
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);

  const streams = data.streams;

  const openRoom = (roomId: string) => {
    onOpenChange(false);
    void navigate({ to: "/live/$roomId", params: { roomId } });
  };

  const requestJoin = (stream: LiveStream) => {
    if (call?.roomId === stream.roomId) {
      openRoom(stream.roomId);
      return;
    }
    if (call) {
      setPendingRoomId(stream.roomId);
      return;
    }
    openRoom(stream.roomId);
  };

  const goLive = () => {
    onOpenChange(false);
    window.dispatchEvent(new Event(OPEN_LIVE_STUDIO_EVENT));
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          hideClose
          className="live-browser-sheet flex h-[100dvh] max-h-[100dvh] flex-col gap-0 border-0 p-0"
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#ff5d68]/30 bg-[#ff5d68]/10 text-[#ff8a91]">
              <RizzLiveIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="font-display text-xl leading-tight">Live now</SheetTitle>
              <SheetDescription className="mt-0.5 text-xs">
                {streams.length
                  ? `${streams.length} ${streams.length === 1 ? "host" : "hosts"} on air · tap one to join`
                  : "Tap a host to join their live."}
              </SheetDescription>
            </div>
            <SheetClose asChild>
              <CloseButton />
            </SheetClose>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {isLoading && !streams.length && (
              <div className="space-y-2.5">
                {[0, 1, 2, 3, 4].map((index) => (
                  <Skeleton key={index} className="h-[86px] w-full rounded-2xl" />
                ))}
              </div>
            )}

            {isError && !streams.length && !isLoading && (
              <div className="py-16 text-center">
                <p className="text-sm text-muted-foreground">Couldn&apos;t load who&apos;s live.</p>
                <Button
                  variant="outline"
                  className="mt-3 h-10 gap-2"
                  onClick={() => void refetch()}
                >
                  <RefreshCw className="h-4 w-4" /> Retry
                </Button>
              </div>
            )}

            {!isLoading && !isError && !streams.length && (
              <div className="py-12 text-center">
                <RizzCat mood="peek" size={112} className="mx-auto" />
                <p className="mt-3 text-sm text-muted-foreground">No one is live right now.</p>
                <Button className="mt-4 h-11 bg-primary text-primary-foreground" onClick={goLive}>
                  <RizzLiveIcon className="h-4 w-4" />
                  Go live
                </Button>
              </div>
            )}

            {!!streams.length && (
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {streams.map((stream) => (
                  <button
                    key={stream.roomId}
                    type="button"
                    onClick={() => requestJoin(stream)}
                    aria-label={`Join ${stream.host.name}'s live: ${stream.title}`}
                    className="live-row group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition-colors hover:border-[#ff5d68]/40 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                  >
                    <span className="relative shrink-0">
                      <UserAvatar
                        src={stream.host.avatarUrl ?? undefined}
                        fallback={stream.host.name}
                        size={56}
                      />
                      <span
                        aria-hidden="true"
                        className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-background bg-[#ff5d68] text-white"
                      >
                        <RizzLiveIcon className="h-2.5 w-2.5" />
                      </span>
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm font-bold text-foreground">
                          {stream.host.name}
                        </span>
                        {stream.host.friend && (
                          <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-primary">
                            Friend
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {stream.title}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Eye className="h-3 w-3" aria-hidden="true" />
                          {stream.viewers} watching
                        </span>
                        <span className="inline-flex items-center gap-1 text-[#ff8a91]">
                          <span className="live-dot h-1.5 w-1.5" aria-hidden="true" />
                          Live
                        </span>
                      </span>
                    </span>

                    <span className="shrink-0 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground">
                      Watch
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!pendingRoomId}
        onOpenChange={(next) => {
          if (!next) setPendingRoomId(null);
        }}
        title="Leave current call and join?"
        description="You'll leave your current call to watch this live."
        confirmLabel="Leave and watch"
        onConfirm={async () => {
          const roomId = pendingRoomId;
          if (!roomId) return;
          setPendingRoomId(null);
          await leaveCall();
          openRoom(roomId);
        }}
      />
    </>
  );
}
