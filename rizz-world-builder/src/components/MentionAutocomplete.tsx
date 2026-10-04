import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type ProfileHit = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

/** Detects the mention token the caret is inside, e.g. `@par|` → "par". */
export function getMentionQuery(text: string, caret: number): string | null {
  const upto = text.slice(0, caret);
  const m = upto.match(/(?:^|\s)@([a-zA-Z0-9_]{0,32})$/);
  return m ? m[1] : null;
}

export function replaceMention(text: string, caret: number, username: string) {
  const upto = text.slice(0, caret);
  const rest = text.slice(caret);
  const m = upto.match(/(?:^|\s)@([a-zA-Z0-9_]{0,32})$/);
  if (!m) return { value: text, caret };
  const start = upto.length - m[1].length;
  const insert = username + " ";
  const next = upto.slice(0, start) + insert + rest;
  return { value: next, caret: start + insert.length };
}

export function MentionAutocomplete({
  value,
  caret,
  onPick,
}: {
  value: string;
  caret: number;
  onPick: (username: string) => void;
}) {
  const query = useMemo(() => getMentionQuery(value, caret), [value, caret]);
  const [hits, setHits] = useState<ProfileHit[]>([]);
  const [active, setActive] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (query === null) { setHits([]); return; }
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    const t = window.setTimeout(async () => {
      const q = query.trim();
      let req = supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .order("rizz_score", { ascending: false })
        .limit(6);
      if (q) req = req.ilike("username", `${q}%`);
      const { data } = await req;
      if (!ctl.signal.aborted) {
        setHits((data as ProfileHit[]) ?? []);
        setActive(0);
      }
    }, 120);
    return () => { window.clearTimeout(t); ctl.abort(); };
  }, [query]);

  useEffect(() => {
    if (query === null || hits.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % hits.length); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + hits.length) % hits.length); }
      else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        onPick(hits[active].username);
      } else if (e.key === "Escape") {
        setHits([]);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [query, hits, active, onPick]);

  if (query === null || hits.length === 0) return null;

  return (
    <div className="absolute left-0 right-0 top-full mt-1 z-40 glass-strong border border-white/10 rounded-2xl p-1 shadow-glow max-h-64 overflow-y-auto">
      {hits.map((p, i) => (
        <button
          key={p.id}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onPick(p.username); }}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-left ${i === active ? "bg-white/10" : "hover:bg-white/5"}`}
        >
          <Avatar className="h-7 w-7">
            <AvatarImage src={p.avatar_url ?? undefined} />
            <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs font-bold">
              {(p.display_name || p.username).charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{p.display_name || p.username}</p>
            <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
          </div>
        </button>
      ))}
    </div>
  );
}