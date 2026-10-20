import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Phone, PhoneOff, Video as VideoIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import { Nameplate } from "@/components/profile/Nameplate";
import { isSelfDoNotDisturb } from "@/lib/presence";
import { callTopic, findJoinedChannel, subscribeSafely } from "@/lib/realtime";

/** Vibration fallback for the ringtone — browsers without it simply stay silent. */
function vibrateRing() {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate([380, 200, 380, 900]);
  } catch {
    /* haptics are a bonus, never a failure */
  }
}

/** How long a ring is offered before it is treated as missed. */
const RING_TIMEOUT_MS = 45_000;

type Incoming = {
  fromId: string;
  fromUsername?: string | null;
  fromDisplayName?: string | null;
  fromAvatar?: string | null;
  video: boolean;
};

/** Global listener — plays an incoming-call sheet when another user rings this account. */
export function IncomingCallRinger() {
  const { user } = useAuth();
  const incomingUserId = user?.id;
  const nav = useNavigate();
  const [call, setCall] = useState<Incoming | null>(null);

  useEffect(() => {
    if (!incomingUserId) return;
    const ch = supabase.channel(`call:incoming:${incomingUserId}`, {
      config: { broadcast: { self: false, ack: false } },
    });
    ch.on("broadcast", { event: "ring" }, ({ payload }) => {
      if (!payload?.fromId || payload.fromId === incomingUserId) return;
      // Do not disturb silences calls too.
      if (isSelfDoNotDisturb()) return;
      setCall(payload as Incoming);
      vibrateRing();
      // Auto-dismiss after the 45s ring window (the call itself becomes missed).
      setTimeout(() => setCall((c) => (c?.fromId === payload.fromId ? null : c)), RING_TIMEOUT_MS);
    }).on("broadcast", { event: "cancel" }, ({ payload }) => {
      setCall((c) => (c && c.fromId === payload?.fromId ? null : c));
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [incomingUserId]);

  // Keep buzzing while the sheet is up so the phone ring is hard to miss.
  useEffect(() => {
    if (!call) return;
    vibrateRing();
    const timer = window.setInterval(vibrateRing, 2_200);
    return () => {
      window.clearInterval(timer);
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(0);
    };
  }, [call]);

  const accept = () => {
    if (!call) return;
    const target = call;
    setCall(null);
    nav({ to: "/call/$userId", params: { userId: target.fromId }, search: { video: target.video } });
  };
  const decline = () => {
    if (!call || !user) return;
    const meId = user.id;
    const roomId = [meId, call.fromId].sort().join("_");
    const topic = callTopic(roomId);

    // Whoever already holds this topic (the call screen while it is open) gets
    // the decline sent straight over their live channel: subscribing again would
    // throw "tried to subscribe multiple times", and removing their channel
    // afterwards would drop a call that is still running.
    const existing = findJoinedChannel(supabase, topic);
    if (existing) {
      void existing
        .send({ type: "broadcast", event: "declined", payload: { from: meId } })
        .catch((error) => console.debug("Couldn't send the decline signal", error));
      setCall(null);
      return;
    }

    const ch = supabase.channel(topic, {
      config: { broadcast: { self: false, ack: false } },
    });
    subscribeSafely(ch, (status) => {
      if (status !== "SUBSCRIBED") return;
      void ch.send({
        type: "broadcast",
        event: "declined",
        payload: { from: meId },
      }).finally(() => {
        window.setTimeout(() => { void supabase.removeChannel(ch); }, 500);
      });
    });
    setCall(null);
  };

  return (
    <AnimatePresence>
      {call && (
        <motion.div
          initial={{ y: -80, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -80, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-md"
        >
          <div className="glass-strong rounded-3xl border border-white/10 p-3 flex items-center gap-3 shadow-2xl">
            <AvatarDecoration
              src={call.fromAvatar}
              fallback={(call.fromUsername ?? "?").charAt(0).toUpperCase()}
              size={48}
            />
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">
                <Nameplate name={call.fromDisplayName || call.fromUsername || "Someone"} />
              </p>
              <p className="text-xs text-muted-foreground">
                Incoming {call.video ? "video" : "voice"} call…
              </p>
            </div>
            <button
              onClick={decline}
              aria-label="Decline"
              className="h-11 w-11 rounded-full bg-red-500 hover:bg-red-600 grid place-items-center shadow-lg"
            >
              <PhoneOff className="h-5 w-5 text-white" />
            </button>
            <button
              onClick={accept}
              aria-label="Accept"
              className="h-11 w-11 rounded-full bg-emerald-500 hover:bg-emerald-600 grid place-items-center shadow-lg animate-pulse"
            >
              {call.video ? <VideoIcon className="h-5 w-5 text-white" /> : <Phone className="h-5 w-5 text-white" />}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}