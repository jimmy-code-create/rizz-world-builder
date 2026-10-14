import { useEffect, useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { scheduleRealmMessage } from "@/lib/realm-schedule";

type ScheduleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  realmId: string;
  roomId: string | null;
  /** The composer draft this message is built from. */
  body: string;
  onScheduled?: () => void;
};

function defaultStamp(): string {
  const date = new Date(Date.now() + 10 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Schedules the draft instead of sending it. The RPC refuses times in the past
 * and anything more than 30 days out, and delivery happens the next time
 * anybody with the app open looks at the realm.
 */
export function ScheduleDialog({ open, onOpenChange, realmId, roomId, body, onScheduled }: ScheduleDialogProps) {
  const [when, setWhen] = useState(defaultStamp());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setWhen(defaultStamp());
  }, [open]);

  const submit = async () => {
    const at = new Date(when);
    if (Number.isNaN(at.getTime())) {
      toast.error("Pick a valid time");
      return;
    }
    if (!body.trim()) {
      toast.error("Write the message first");
      return;
    }
    setBusy(true);
    try {
      await scheduleRealmMessage({ realmId, roomId, body: body.trim(), scheduledFor: at });
      toast.success(`Scheduled for ${at.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`);
      onOpenChange(false);
      onScheduled?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't schedule that message");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <CalendarClock className="h-5 w-5 text-primary" /> Schedule message
          </DialogTitle>
        </DialogHeader>

        <p className="line-clamp-3 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-muted-foreground">
          {body.trim() || "Nothing to send yet."}
        </p>

        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Send at
          <input
            type="datetime-local"
            value={when}
            min={defaultStamp()}
            onChange={(event) => setWhen(event.target.value)}
            className="glass mt-1.5 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm text-foreground [color-scheme:dark]"
          />
        </label>

        <div className="flex gap-2">
          <Button variant="outline" className="glass border-white/10 flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1 bg-primary text-primary-foreground border-0 shadow-md" disabled={busy || !body.trim()} onClick={() => void submit()}>
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Schedule
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
