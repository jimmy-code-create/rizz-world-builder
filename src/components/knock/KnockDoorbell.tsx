import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { DoorOpen, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { haptic, hapticError } from "@/lib/haptics";
import { playKnockSound } from "@/lib/notification-sound";
import { useDoorbell } from "@/lib/knock";

/**
 * Somebody is at the door.
 *
 * A knock is the only notification in the app that is worth interrupting for: it
 * was sent *because* the sender was unsure whether you were there, so it gets a
 * card in the corner of whatever screen you are on, with the three answers a
 * person would give in real life. Sitting at the top of the layout keeps it clear
 * of the composer, the mobile nav and the in-call bar, all of which live at the
 * bottom.
 */
export function KnockDoorbell() {
  const { knock, respond, dismiss } = useDoorbell();
  const nav = useNavigate();
  const rung = useRef<string | null>(null);

  useEffect(() => {
    if (!knock || rung.current === knock.id) return;
    rung.current = knock.id;
    playKnockSound();
    haptic("heavy");
    window.setTimeout(() => haptic("light"), 200);
  }, [knock]);

  const name = knock?.from?.display_name || knock?.from?.username || "Someone";

  const answer = async (response: "come_in" | "later" | "busy") => {
    if (!knock) return;
    try {
      await respond(response);
      if (response === "come_in") {
        toast.success("Door's open — heading to your chat");
        // Opening the door means walking in: land in the conversation.
        void nav({ to: "/dm/$userId", params: { userId: knock.from_user } });
      } else if (response === "later") {
        toast.info(`${name} knows you'll be right there`);
      } else {
        toast.info("Told them you're busy");
      }
    } catch (error) {
      hapticError();
      toast.error(error instanceof Error ? error.message : "Couldn't answer that knock");
    }
  };

  return (
    <AnimatePresence>
      {knock && (
        <motion.div
          initial={{ opacity: 0, y: -18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -14, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          role="alertdialog"
          aria-label={`${name} is knocking`}
          className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+0.6rem)] z-[95] mx-auto flex max-w-md justify-center px-3"
        >
          <div className="pointer-events-auto w-full overflow-hidden rounded-2xl border border-[var(--brand-line,#2a2a2e)] bg-[var(--brand-ink-2,#131315)]/95 p-3 shadow-2xl backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <span className="relative shrink-0">
                <Avatar className="h-11 w-11 ring-2 ring-[var(--brand-signal,#c9ff3d)]/50">
                  <AvatarImage src={knock.from?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary font-bold text-primary-foreground">
                    {name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {/* The knocking hand: a soft pulse so the card reads as a sound. */}
                <motion.span
                  animate={{ scale: [1, 1.25, 1], rotate: [0, -12, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-[var(--brand-signal,#c9ff3d)] text-[10px] text-[var(--brand-signal-ink,#0a0a0b)]"
                  aria-hidden="true"
                >
                  <DoorOpen className="h-3 w-3" />
                </motion.span>
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {name} is at your door
                  <span className="ml-1" aria-hidden="true">👋</span>
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {knock.note || "Knock knock — are you around?"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  haptic("light");
                  dismiss(knock.id);
                }}
                aria-label="Not now"
                className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <Button size="sm" className="h-8 gap-1.5 px-3 text-xs font-bold" onClick={() => void answer("come_in")}>
                <DoorOpen className="h-3.5 w-3.5" />
                Open the door
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-3 text-xs text-muted-foreground"
                onClick={() => void answer("later")}
              >
                Give me a sec
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-3 text-xs text-muted-foreground"
                onClick={() => void answer("busy")}
              >
                Busy
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
