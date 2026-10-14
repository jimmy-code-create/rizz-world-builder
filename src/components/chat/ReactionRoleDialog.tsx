import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { deleteReactionRole, setReactionRole, type ReactionRole } from "@/lib/reaction-roles";

type ReactionRoleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageId: string;
  /** Roles already configured on this message. */
  roles: ReactionRole[];
  onChanged?: () => void;
};

const SUGGESTED = ["⭐", "🎯", "🔑", "👑", "💎", "🔥"];

/**
 * Configures the two reaction-role rules the `apply_reaction_roles` trigger
 * understands: reacting with the emoji grants "member" or "mod", un-reacting
 * takes it back (never from the owner, never demoting a higher role).
 */
export function ReactionRoleDialog({ open, onOpenChange, messageId, roles, onChanged }: ReactionRoleDialogProps) {
  const [emoji, setEmoji] = useState(SUGGESTED[0]);
  const [role, setRole] = useState<"member" | "mod">("member");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setEmoji(SUGGESTED[0]); setRole("member"); }
  }, [open]);

  const mine = roles.filter((entry) => entry.message_id === messageId);

  const save = async () => {
    const trimmed = emoji.trim();
    if (!trimmed) {
      toast.error("Pick an emoji");
      return;
    }
    setBusy(true);
    try {
      await setReactionRole({ messageId, emoji: trimmed.slice(0, 16), role });
      toast.success(`${trimmed} now grants ${role === "mod" ? "moderator" : "member"}`);
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save that reaction role");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteReactionRole(id);
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't remove that rule");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <UserCog className="h-5 w-5 text-primary" /> Reaction roles
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Reacting with the emoji grants the role; removing it takes the role back. Owners and
          higher roles are never changed.
        </p>

        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED.map((candidate) => (
            <button
              key={candidate}
              type="button"
              onClick={() => setEmoji(candidate)}
              className={`h-9 w-9 rounded-xl border text-lg transition-colors ${
                emoji === candidate
                  ? "border-primary bg-primary/15"
                  : "border-white/10 bg-white/[0.04] hover:bg-white/10"
              }`}
            >
              {candidate}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            value={emoji}
            onChange={(event) => setEmoji(event.target.value)}
            maxLength={16}
            aria-label="Emoji"
            className="glass w-24 rounded-xl border border-white/10 px-3 py-2 text-center text-lg"
          />
          <div className="flex flex-1 gap-2">
            {(["member", "mod"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRole(value)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                  role === value
                    ? "border-primary bg-primary/15"
                    : "border-white/10 bg-white/[0.04] hover:bg-white/10"
                }`}
              >
                {value === "mod" ? <ShieldCheck className="h-3.5 w-3.5" /> : null}
                {value === "mod" ? "Moderator" : "Member"}
              </button>
            ))}
          </div>
        </div>

        <Button className="w-full bg-primary text-primary-foreground border-0 shadow-md" disabled={busy} onClick={() => void save()}>
          {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Save rule
        </Button>

        {mine.length > 0 && (
          <ul className="space-y-1.5">
            {mine.map((entry) => (
              <li key={entry.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                <span className="text-lg">{entry.emoji}</span>
                <span className="flex-1">grants {entry.role === "mod" ? "moderator" : "member"}</span>
                <button
                  type="button"
                  onClick={() => void remove(entry.id)}
                  aria-label={`Remove ${entry.emoji} rule`}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
