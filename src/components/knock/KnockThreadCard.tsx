import { useState } from "react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { DoorOpen } from "lucide-react";
import { toast } from "@/lib/toast";
import { haptic, hapticError } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  knockResponseLabel,
  knockStatusLine,
  respondKnock,
  type Knock,
  type KnockResponse,
} from "@/lib/knock";

/**
 * A knock inside the conversation.
 *
 * Knocks are part of the thread rather than a floating toast on purpose: the
 * whole point of knocking is reaching someone who is not looking at the chat, so
 * the one that arrived while they were gone has to still be sitting there — with
 * the answer attached — instead of having flashed by.
 */
export function KnockThreadCard({
  knock,
  mine,
  peerName,
  className,
}: {
  knock: Knock;
  mine: boolean;
  peerName: string;
  className?: string;
}) {
  const qc = useQueryClient();
  const [answering, setAnswering] = useState<KnockResponse | null>(null);
  const answer = knockResponseLabel(knock.response);
  const openForMe = !mine && !knock.response;

  const answerKnock = async (response: KnockResponse) => {
    if (answering) return;
    setAnswering(response);
    if (response === "come_in") haptic("success");
    else haptic("medium");
    try {
      await respondKnock(knock.id, response);
      void qc.invalidateQueries({ queryKey: ["knocks"] });
      void qc.invalidateQueries({ queryKey: ["knock-doorbell"] });
      void qc.invalidateQueries({ queryKey: ["unread-notifs"] });
      toast.success(
        response === "come_in"
          ? "Door's open — they know you're here"
          : response === "later"
            ? "Told them you'll be right there"
            : "Told them you're busy",
      );
    } catch (error) {
      hapticError();
      toast.error(error instanceof Error ? error.message : "Couldn't answer that knock");
    } finally {
      setAnswering(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex w-full justify-center px-4 py-1.5", className)}
    >
      <div
        className={cn(
          "flex w-full max-w-sm flex-col gap-2 rounded-2xl border px-3.5 py-2.5 backdrop-blur-sm",
          openForMe
            ? "border-[var(--brand-signal,#c9ff3d)]/40 bg-[var(--brand-signal,#c9ff3d)]/[0.07]"
            : "border-white/10 bg-white/[0.03]",
        )}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-[var(--brand-signal,#c9ff3d)]"
            aria-hidden="true"
          >
            <DoorOpen className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold">
              {mine ? "You knocked" : `${peerName} knocked 👋`}
              <span className="ml-1.5 font-medium text-muted-foreground">
                {new Date(knock.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {knock.note || knockStatusLine(knock, mine)}
            </p>
          </div>
          {answer && (
            <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-foreground/90">
              {answer}
            </span>
          )}
        </div>

        {openForMe && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              className="h-8 gap-1.5 px-3 text-xs font-bold"
              disabled={!!answering}
              onClick={() => void answerKnock("come_in")}
            >
              <DoorOpen className="h-3.5 w-3.5" />
              {answering === "come_in" ? "Opening…" : "Open the door"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-3 text-xs text-muted-foreground"
              disabled={!!answering}
              onClick={() => void answerKnock("later")}
            >
              Give me a sec
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-3 text-xs text-muted-foreground"
              disabled={!!answering}
              onClick={() => void answerKnock("busy")}
            >
              Busy
            </Button>
          </div>
        )}

        {mine && !answer && (
          <p className="text-[11px] text-muted-foreground">
            {knock.seen ? "They saw the knock 👀" : "Knock delivered — it waits at their door"}
          </p>
        )}
      </div>
    </motion.div>
  );
}
