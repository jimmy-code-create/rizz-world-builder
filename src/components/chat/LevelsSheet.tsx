import { Crown, Loader2, Trophy } from "lucide-react";
import { UserAvatar } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { levelProgress, useLeaderboard, useMyXp } from "@/lib/realm-xp";

type LevelsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  realmId: string;
};

const MEDALS = ["🥇", "🥈", "🥉"];

/** The standings board: my level first, then the top of the realm. */
export function LevelsSheet({ open, onOpenChange, realmId }: LevelsSheetProps) {
  const board = useLeaderboard(realmId, open);
  const mine = useMyXp(realmId, open);
  const progress = levelProgress(mine.data?.xp ?? 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="glass-strong flex w-full flex-col gap-0 border-white/10 p-0 sm:max-w-md">
        <SheetHeader className="shrink-0 border-b border-white/10 px-4 py-3 text-left">
          <SheetTitle className="flex items-center gap-2 font-display text-base">
            <Trophy className="h-4 w-4 text-primary" /> Levels
          </SheetTitle>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="rounded-2xl border border-primary/30 bg-primary/[0.07] p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Your level</p>
            <div className="mt-1 flex items-end justify-between gap-3">
              <p className="font-display text-2xl font-extrabold">Level {progress.level}</p>
              <p className="text-xs text-muted-foreground">
                {mine.data?.xp ?? 0} XP{mine.data?.rank ? ` · rank #${mine.data.rank}` : ""}
              </p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/30">
              <div
                className="h-full rounded-full bg-primary text-primary-foreground transition-all"
                style={{ width: `${Math.min(100, Math.round((progress.intoLevel / progress.needed) * 100))}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {Math.max(0, progress.needed - progress.intoLevel)} XP to level {progress.level + 1} ·{" "}
              {mine.data?.messages ?? 0} messages counted
            </p>
          </div>

          {board.isLoading && (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading standings…
            </p>
          )}
          {board.isError && (
            <p className="py-8 text-center text-sm text-destructive">Couldn't load the leaderboard.</p>
          )}
          {(board.data ?? []).length === 0 && !board.isLoading && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nobody has earned XP here yet. Start chatting.
            </p>
          )}

          <ol className="mt-3 space-y-2">
            {(board.data ?? []).map((row, index) => (
              <li
                key={row.user_id}
                className={`flex items-center gap-3 rounded-2xl border p-2.5 ${
                  row.is_me ? "border-primary/50 bg-primary/10" : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <span className="w-7 shrink-0 text-center text-sm font-bold text-muted-foreground">
                  {MEDALS[index] ?? row.rank}
                </span>
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={row.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                    {(row.username ?? "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate text-sm font-semibold">
                    {row.display_name || row.username || "Member"}
                    {row.is_me && <span className="text-[10px] text-muted-foreground">(you)</span>}
                    {index === 0 && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-300" />}
                  </span>
                  <span className="block text-xs text-muted-foreground">{row.messages} messages</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-bold">Lv {row.level}</span>
                  <span className="block text-[11px] text-muted-foreground">{row.xp} XP</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </SheetContent>
    </Sheet>
  );
}
