import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, LogOut, Radio, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVoiceCallContext } from "@/components/voice/VoiceCallProvider";

export const Route = createFileRoute("/_app/live/$roomId")({
  head: () => ({ meta: [{ title: "Live · RIZZ" }] }),
  component: LiveRoomPage,
});

/**
 * A shared live-room link. The room itself is a voice room with an opt-in
 * camera, so the global call provider owns the media and the studio overlay.
 * This page is the stable landing page behind that overlay.
 */
function LiveRoomPage() {
  const { roomId } = Route.useParams();
  const { call, joinLiveRoom, openView, leaveCall } = useVoiceCallContext();
  const [state, setState] = useState<"joining" | "joined" | "failed" | "left">("joining");
  const busyRef = useRef(false);

  const join = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setState("joining");
    const joined = await joinLiveRoom(roomId);
    busyRef.current = false;
    setState(joined ? "joined" : "failed");
  }, [joinLiveRoom, roomId]);

  useEffect(() => {
    void join();
  }, [join]);

  // Leaving from the global studio sets call to null; reflect that here instead
  // of looking like the room is still loading.
  useEffect(() => {
    if (state === "joined" && !call) setState("left");
  }, [call, state]);

  return (
    <div className="mx-auto flex min-h-[62dvh] w-full max-w-md flex-col items-center justify-center gap-4 px-5 py-10 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-destructive/15 text-destructive ring-1 ring-destructive/20">
        <Radio className="h-8 w-8" />
      </span>

      <div>
        <h1 className="font-display text-2xl text-white">
          {state === "joined"
            ? "You're in the live room"
            : state === "failed"
              ? "Live room unavailable"
              : state === "left"
                ? "You left the live room"
                : "Joining live…"}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {state === "joined"
            ? "The studio is open. Turn your camera on when you want to share, or leave whenever you're done."
            : state === "failed"
              ? "The host may have ended this room. Ask them for a fresh link."
              : state === "left"
                ? "You can hop back in while the host is still live."
                : "Connecting to the host's room."}
        </p>
      </div>

      {(state === "joining" || (state === "joined" && !call)) && (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      )}

      {state === "joined" && (
        <div className="grid w-full grid-cols-2 gap-2">
          <Button
            type="button"
            onClick={openView}
            className="h-11 border-0 bg-primary text-primary-foreground shadow-md"
          >
            <Video className="h-4 w-4" />
            Open studio
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={leaveCall}
            className="h-11 border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Leave
          </Button>
        </div>
      )}

      {state === "left" && (
        <div className="grid w-full grid-cols-2 gap-2">
          <Button type="button" onClick={() => void join()} className="h-11">
            <Radio className="h-4 w-4" />
            Rejoin
          </Button>
          <Button asChild variant="outline" className="h-11">
            <Link to="/reels">
              <ArrowLeft className="h-4 w-4" />
              Reels
            </Link>
          </Button>
        </div>
      )}

      {state === "failed" && (
        <Button asChild variant="outline" className="h-11">
          <Link to="/reels">
            <ArrowLeft className="h-4 w-4" />
            Back to Reels
          </Link>
        </Button>
      )}
    </div>
  );
}
