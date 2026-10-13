import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Clock, Users } from "lucide-react";

type ProfileHit = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

/** PostgREST gets unhappy with very long in.() lists; members beyond this are
 *  still matched by typing, just not listed upfront. */
const MAX_MEMBERS = 300;
const ROW_LIMIT = 12;

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
  memberIds,
  emptyHint,
}: {
  value: string;
  caret: number;
  onPick: (username: string) => void;
  /**
   * When supplied, only these people can be mentioned — the members of the
   * realm, group or DM the composer belongs to (Discord's rule: you can @ the
   * people who are actually in the room). Undefined keeps the old behaviour of
   * searching everyone, which is what a feed post outside any server needs.
   */
  memberIds?: string[];
  emptyHint?: string;
}) {
  const query = useMemo(() => getMentionQuery(value, caret), [value, caret]);
  const [hits, setHits] = useState<ProfileHit[]>([]);
  const [active, setActive] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const scoped = memberIds !== undefined;

  useEffect(() => {
    if (query === null) { setHits([]); return; }
    if (scoped && (memberIds!.length === 0 || memberIds!.length > MAX_MEMBERS)) { setHits([]); return; }
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    const t = window.setTimeout(async () => {
      const q = query.trim();
      let req = supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .order("rizz_score", { ascending: false })
        .limit(ROW_LIMIT);
      if (scoped) req = req.in("id", memberIds!);
      if (q) req = req.ilike("username", `${q}%`);
      const { data } = await req;
      if (!ctl.signal.aborted) {
        setHits((data as ProfileHit[]) ?? []);
        setActive(0);
      }
    }, 120);
    return () => { window.clearTimeout(t); ctl.abort(); };
  }, [query, scoped, memberIds]);

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

  if (query === null) return null;
  if (hits.length === 0) {
    if (query.trim() && emptyHint && scoped) {
      return (
        <p className="absolute bottom-full left-0 right-0 z-50 mb-2 rounded-xl border border-white/5 bg-[#1e1f22] px-3 py-2 text-[12px] text-[#b5bac1] sm:right-auto sm:w-[21rem]">
          {emptyHint}
        </p>
      );
    }
    return null;
  }

  // Discord's picker: a clock-headed "frequently used" list when nothing is
  // typed, otherwise the member search — one row per person, name in white,
  // handle pushed to the right edge, selection on a soft white wash.
  const heading = query.trim() ? "Members" : "Frequently used";
  const HeadingIcon = query.trim() ? Users : Clock;

  return (
    <div
      ref={popupRef}
      role="listbox"
      aria-label="Mention someone"
      className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-2xl border border-white/5 bg-[#1e1f22] shadow-[0_18px_48px_-20px_rgba(0,0,0,0.95)] sm:right-auto sm:w-[22rem]"
    >
      <div className="flex items-center gap-1.5 px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.06em] text-[#b5bac1]">
        <HeadingIcon className="h-3.5 w-3.5" aria-hidden="true" />
        {heading}
      </div>
      <div className="max-h-[min(44dvh,17rem)] overflow-y-auto px-1.5 pb-1.5">
        {hits.map((p, i) => {
          const name = p.display_name || p.username;
          return (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); onPick(p.username); }}
              onMouseEnter={() => setActive(i)}
              className={`flex w-full min-h-[3rem] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors ${
                i === active ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"
              }`}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={p.avatar_url ?? undefined} />
                <AvatarFallback className="bg-gradient-primary text-[11px] font-bold text-primary-foreground">
                  {name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-white">{name}</span>
              <span className="shrink-0 truncate text-[13px] text-[#b5bac1]">@{p.username}</span>
            </button>
          );
        })}
      </div>
      <div className="hidden items-center gap-2 border-t border-white/5 bg-black/20 px-3 py-1.5 text-[11px] text-[#b5bac1] sm:flex">
        <span className="inline-flex items-center gap-1">
          <kbd className="rounded border border-white/10 bg-white/5 px-1 font-sans">↑↓</kbd> browse
        </span>
        <span className="inline-flex items-center gap-1">
          <kbd className="rounded border border-white/10 bg-white/5 px-1 font-sans">↵</kbd> mention
        </span>
      </div>
    </div>
  );
}
