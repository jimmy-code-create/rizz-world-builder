import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";

type Mode = "followers" | "following";

type Row = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export function FollowListDialog({
  open, onOpenChange, userId, mode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  mode: Mode;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const col = mode === "followers" ? "follower_id" : "following_id";
      const filter = mode === "followers" ? "following_id" : "follower_id";
      const { data } = await supabase
        .from("follows")
        .select(`${col}, p:profiles!follows_${col}_fkey(id, username, display_name, avatar_url)`)
        .eq(filter, userId)
        .limit(200);
      const list = (data ?? [])
        .map((r: any) => r.p)
        .filter(Boolean) as Row[];
      // fallback if FK alias not set up
      if (list.length === 0 && (data ?? []).length > 0) {
        const ids = (data ?? []).map((r: any) => r[col]);
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", ids);
        setRows((profs ?? []) as Row[]);
      } else {
        setRows(list);
      }
      setLoading(false);
    })();
  }, [open, userId, mode]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-white/10 max-w-md">
        <DialogTitle className="font-display capitalize">{mode}</DialogTitle>
        <div className="max-h-[60vh] overflow-y-auto -mx-2">
          {loading && <p className="text-sm text-muted-foreground p-4">Loading…</p>}
          {!loading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground p-4 text-center">No one yet.</p>
          )}
          {rows.map((p) => (
            <Link
              key={p.id}
              to="/u/$username"
              params={{ username: p.username }}
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={p.avatar_url ?? undefined} />
                <AvatarFallback className="bg-gradient-primary text-sm font-bold">
                  {(p.display_name || p.username).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{p.display_name || p.username}</p>
                <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
              </div>
            </Link>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}