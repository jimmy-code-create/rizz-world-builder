import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Phone, PhoneOff, Video as VideoIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import { Nameplate } from "@/components/profile/Nameplate";
import { useEquipped } from "@/lib/useEquipped";

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
  const nav = useNavigate();
  const [call, setCall] = useState<Incoming | null>(null);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`call:incoming:${user.id}`, {
      config: { broadcast: { self: false, ack: false } },
    });
    ch.on("broadcast", { event: "ring" }, ({ payload }) => {
      if (!payload?.fromId || payload.fromId === user.id) return;
      setCall(payload as Incoming);
      // Auto-dismiss after 30s
      setTimeout(() => setCall((c) => (c?.fromId === payload.fromId ? null : c)), 30_000);
    }).on("broadcast", { event: "cancel" }, ({ payload }) => {
      setCall((c) => (c && c.fromId === payload?.fromId ? null : c));
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const accept = () => {
    if (!call) return;
    const target = call;
    setCall(null);
    nav({ to: "/call/$userId", params: { userId: target.fromId }, search: { video: target.video } });
  };
  const decline = () => {
    if (!call || !user) return;
    try {
      supabase.channel(`call:incoming:${call.fromId}`).send({
        type: "broadcast", event: "declined", payload: { fromId: user.id },
      });
    } catch {}
    setCall(null);
  };

  const eq = useEquipped(call?.fromId);
  const decor = (eq.data as any)?.avatar_decoration;
  const namep = (eq.data as any)?.nameplate;

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
              effectSlug={decor?.slug}
              accent={decor?.preview_color}
            />
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">
                <Nameplate
                  name={call.fromDisplayName || call.fromUsername || "Someone"}
                  slug={namep?.slug}
                  accent={namep?.preview_color}
                />
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