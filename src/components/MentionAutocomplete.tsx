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
  const popupRef = useRef<HTMLDivElement>(null);

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
      // Only a real text field (or the story editor's contentEditable text) is
      // ours. A window-level listener used to swallow Enter and the arrow keys
      // pressed anywhere else on the page while a half-typed mention sat in the
      // composer.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && target?.isContentEditable !== true) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // stopPropagation matters: the composer sends on Enter, so picking with
      // Enter without it posted the half-typed "@name" and wiped the composer.
      const consume = () => { e.preventDefault(); e.stopPropagation(); };
      if (e.key === "ArrowDown") { consume(); setActive((a) => (a + 1) % hits.length); }
      else if (e.key === "ArrowUp") { consume(); setActive((a) => (a - 1 + hits.length) % hits.length); }
      else if (e.key === "Enter" || e.key === "Tab") {
        // Shift+Enter stays a newline in a textarea; only a plain pick consumes it.
        if (e.shiftKey) return;
        consume();
        onPick(hits[Math.min(active, hits.length - 1)].username);
      } else if (e.key === "Escape") {
        consume();
        setHits([]);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [query, hits, active, onPick]);

  useEffect(() => {
    if (query === null || hits.length === 0) return;
    const onDown = (e: PointerEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) setHits([]);
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [query, hits]);

  if (query === null || hits.length === 0) return null;

  // Discord-style picker: one row per member — avatar, bold name, handle pushed
  // to the right edge — under a small section label. With nothing typed the list
  // is "frequently used" (top rizz), otherwise it is a member search.
  const heading = query.trim() ? "Members" : "Frequently used";

  return (
    <div
      ref={popupRef}
      role="listbox"
      aria-label="Mention someone"
      className="glass-strong absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-2xl border border-white/10 shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.95)] sm:right-auto sm:w-[21rem]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[var(--rizz-pink)]/45 to-transparent"
      />
      <p className="px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {heading}
      </p>
      <div className="max-h-[min(38dvh,13rem)] overflow-y-auto px-1 pb-1">
        {hits.map((p, i) => (
          <button
            key={p.id}
            type="button"
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => { e.preventDefault(); onPick(p.username); }}
            className={`flex w-full min-h-11 items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors ${
              i === active ? "bg-white/[0.07] shadow-[inset_2px_0_0_var(--rizz-pink)]" : "hover:bg-white/[0.05]"
            }`}
          >
            <Avatar className="h-7 w-7 shrink-0 ring-1 ring-white/10">
              <AvatarImage src={p.avatar_url ?? undefined} />
              <AvatarFallback className="bg-gradient-primary text-primary-foreground text-[10px] font-bold">
                {(p.display_name || p.username).charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold leading-tight">
                {p.display_name || p.username}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">@{p.username}</p>
            </div>
            {i === active && (
              <span className="shrink-0 rounded border border-white/10 bg-white/5 px-1 text-[10px] text-muted-foreground">
                ↵
              </span>
            )}
          </button>
        ))}
      </div>
      <p className="hidden items-center gap-1.5 border-t border-white/5 px-3 py-1.5 text-[10px] text-muted-foreground sm:flex">
        <kbd className="rounded border border-white/10 bg-white/5 px-1 font-sans">↑↓</kbd> browse
        <kbd className="rounded border border-white/10 bg-white/5 px-1 font-sans">↵</kbd> mention
      </p>
    </div>
  );
}