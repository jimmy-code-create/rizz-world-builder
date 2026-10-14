import { useEffect, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { createRealmPoll } from "@/lib/realm-polls";

type PollDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  realmId: string;
  roomId: string | null;
  onCreated?: () => void;
};

const CLOSES_OPTIONS = [
  { label: "No closing time", minutes: 0 },
  { label: "1 hour", minutes: 60 },
  { label: "8 hours", minutes: 480 },
  { label: "24 hours", minutes: 1440 },
  { label: "3 days", minutes: 4320 },
];

/** Creates a poll; the RPC validates the shape again before anything is stored. */
export function PollDialog({ open, onOpenChange, realmId, roomId, onCreated }: PollDialogProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState("\n");
  const [multi, setMulti] = useState(false);
  const [minutes, setMinutes] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setQuestion("");
      setOptions("\n");
      setMulti(false);
      setMinutes(0);
    }
  }, [open]);

  const optionList = options
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const valid = question.trim().length > 0 && optionList.length >= 2 && optionList.length <= 6;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await createRealmPoll({ realmId, roomId, question: question.trim(), options: optionList, multi, minutes });
      toast.success("Poll posted");
      onOpenChange(false);
      onCreated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't start that poll");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <BarChart3 className="h-5 w-5 text-primary" /> New poll
          </DialogTitle>
        </DialogHeader>

        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Question
          <Input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Pizza tonight?"
            maxLength={200}
            className="glass mt-1.5 border-white/10"
          />
        </label>

        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Options <span className="normal-case text-muted-foreground/70">— one per line, 2 to 6</span>
          <textarea
            value={options}
            onChange={(event) => setOptions(event.target.value)}
            rows={4}
            maxLength={400}
            placeholder={"Yes\nNo\nOnly if it is free"}
            className="glass mt-1.5 w-full resize-none rounded-xl border border-white/10 px-3 py-2 text-sm text-foreground"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={multi} onChange={(event) => setMulti(event.target.checked)} className="h-4 w-4 accent-primary" />
            Allow multiple picks
          </label>
          <label className="ml-auto text-sm text-muted-foreground">
            Closes{" "}
            <select
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
              className="glass ml-1 rounded-lg border border-white/10 px-2 py-1 text-sm text-foreground"
            >
              {CLOSES_OPTIONS.map((option) => (
                <option key={option.minutes} value={option.minutes}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        <Button
          className="w-full bg-primary text-primary-foreground border-0 shadow-md"
          disabled={!valid || busy}
          onClick={() => void submit()}
        >
          {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Post poll
        </Button>
      </DialogContent>
    </Dialog>
  );
}
