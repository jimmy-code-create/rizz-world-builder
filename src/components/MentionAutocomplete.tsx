import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type ProfileHit = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

/** PostgREST gets unhappy with very long in.() lists; members beyond this are
 *  still matched by typing, just not listed upfront. */
const MAX_MEMBERS = 300;
const ROW_LIMIT = 6;
const ROW_H = 48;
const MAX_ROWS = 4;
const MIN_ROWS = 2;
const GAP = 8;

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

/** The focused text box, if any — the popup anchors to it without any
 *  caller wiring, so every composer (feed, stories, realms, groups, DMs)
 *  shares this one component. */
function currentAnchor(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const el = document.activeElement as HTMLElement | null;
  if (!el) return null;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable === true) return el;
  return null;
}

function isCoarsePointer(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

/** Matched substring in cream bold, e.g. query "par" in "Parker". */
function Hi({ text, q }: { text: string; q: string }) {
  const needle = q.trim().toLowerCase();
  if (!needle) return <>{text}</>;
  const i = text.toLowerCase().indexOf(needle);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <strong className="font-bold text-[#f2efe6]">{text.slice(i, i + needle.length)}</strong>
      {text.slice(i + needle.length)}
    </>
  );
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
  const { user } = useAuth();
  const query = useMemo(() => getMentionQuery(value, caret), [value, caret]);
  const [hits, setHits] = useState<ProfileHit[]>([]);
  const [active, setActive] = useState(0);
  const [followed, setFollowed] = useState<string[] | null>(null);
  const [tick, setTick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const scoped = memberIds !== undefined;

  // People I follow, once per mount — they sort first in every list.
  useEffect(() => {
    if (!user) {
      setFollowed([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id)
          .limit(500);
        if (!cancelled) {
          setFollowed(((data ?? []) as Array<{ following_id: string }>).map((r) => r.following_id));
        }
      } catch {
        if (!cancelled) setFollowed([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (query === null) {
      setHits([]);
      return;
    }
    if (scoped && (memberIds!.length === 0 || memberIds!.length > MAX_MEMBERS)) {
      setHits([]);
      return;
    }
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
      if (q) req = req.or(`username.ilike.${q}%,display_name.ilike.%${q}%`);
      const { data } = await req;
      if (!ctl.signal.aborted) {
        setHits((data as ProfileHit[]) ?? []);
        setActive(isCoarsePointer() ? -1 : 0);
      }
    }, 120);
    return () => {
      window.clearTimeout(t);
      ctl.abort();
    };
  }, [query, scoped, memberIds]);

  const sorted = useMemo(() => {
    if (!followed || followed.length === 0) return hits;
    const rank = new Map(followed.map((id, i) => [id, i]));
    return [...hits].sort((a, b) => {
      const ra = rank.has(a.id) ? 0 : 1;
      const rb = rank.has(b.id) ? 0 : 1;
      return ra - rb;
    });
  }, [hits, followed]);

  // ---- positioning: fixed portal attached to the text box ----
  const n = sorted.length;
  const pos = useMemo(() => {
    if (typeof window === "undefined" || query === null) return null;
    const anchor = currentAnchor();
    if (!anchor) return null;
    const box = anchor.getBoundingClientRect();
    if (box.width === 0 && box.height === 0) return null;
    const vw = window.innerWidth;
    const vvH = window.visualViewport?.height ?? window.innerHeight;
    const headerH = document.querySelector("header")?.getBoundingClientRect().height ?? 56;
    const width = Math.min(box.width, vw - 24);
    const left = Math.max(12, Math.min(box.left, vw - 12 - width));
    const rowsWanted = n === 0 ? 1 : Math.min(MAX_ROWS, n);
    const spaceAbove = box.top - headerH - GAP;
    const spaceBelow = vvH - box.bottom - GAP - 8;
    const up = spaceAbove >= spaceBelow && spaceAbove >= MIN_ROWS * ROW_H;
    const avail = up ? spaceAbove : spaceBelow;
    const fit = Math.floor(avail / ROW_H);
    const rows = n === 0 ? 1 : Math.max(MIN_ROWS, Math.min(MAX_ROWS, fit, rowsWanted));
    const height = n === 0 ? 40 : rows * ROW_H;
    const top = up
      ? Math.max(headerH + 4, box.top - GAP - height)
      : Math.min(box.bottom + GAP, vvH - 8 - height);
    return { top: Math.round(top), left: Math.round(left), width: Math.round(width), height };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, n, tick, followed]);

  useEffect(() => {
    if (query === null) return;
    const bump = () => setTick((t) => t + 1);
    window.addEventListener("resize", bump);
    window.addEventListener("scroll", bump, true);
    window.visualViewport?.addEventListener("resize", bump);
    return () => {
      window.removeEventListener("resize", bump);
      window.removeEventListener("scroll", bump, true);
      window.visualViewport?.removeEventListener("resize", bump);
    };
  }, [query ]);

  // ---- combobox wiring on the text box itself ----
  useEffect(() => {
    const el = currentAnchor();
    if (!el || query === null) return;
    el.setAttribute("role", "combobox");
    el.setAttribute("aria-expanded", n > 0 ? "true" : "false");
    el.setAttribute("aria-controls", "mention-listbox");
    el.setAttribute("aria-autocomplete", "list");
    if (active >= 0 && sorted[active]) {
      el.setAttribute("aria-activedescendant", `mention-opt-${sorted[active].username}`);
    } else {
      el.removeAttribute("aria-activedescendant");
    }
    return () => {
      el.removeAttribute("aria-activedescendant");
      el.setAttribute("aria-expanded", "false");
    };
  }, [query, n, active, sorted]);

  useEffect(() => {
    if (query === null || sorted.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && target?.isContentEditable !== true) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // stopPropagation matters: the composer sends on Enter, so picking with
      // Enter without it posted the half-typed "@name" and wiped the composer.
      const consume = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (e.key === "ArrowDown") {
        consume();
        setActive((a) => (a + 1) % sorted.length);
      } else if (e.key === "ArrowUp") {
        consume();
        setActive((a) => (a - 1 + sorted.length) % sorted.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        // Shift+Enter stays a newline in a textarea; only a plain pick consumes it.
        if (e.shiftKey) return;
        if (active < 0) return;
        consume();
        onPick(sorted[Math.min(active, sorted.length - 1)].username);
      } else if (e.key === "Escape") {
        consume();
        setHits([]);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [query, sorted, active, onPick]);

  useEffect(() => {
    if (query === null) return;
    const onDown = (e: PointerEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) setHits([]);
    };
    const onBlur = () => {
      // Keyboard hidden and focus truly gone (not just moving into the popup,
      // which never takes focus): close. Row taps use pointerdown +
      // preventDefault so they never blur the box.
      window.requestAnimationFrame(() => {
        const ae = document.activeElement as HTMLElement | null;
        if (!ae || ae === document.body) setHits([]);
      });
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("blur", onBlur);
    };
  }, [query]);

  if (query === null || typeof document === "undefined") return null;

  const q = query.trim();
  const empty = sorted.length === 0;
  const panelH = pos?.height ?? (empty ? 40 : Math.min(MAX_ROWS, Math.max(sorted.length, 1)) * ROW_H);

  return createPortal(
    <div
      ref={popupRef}
      id="mention-listbox"
      role="listbox"
      aria-label="Mention someone"
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? 12,
        width: pos?.width ?? "auto",
        maxHeight: 192,
        zIndex: "var(--z-popover, 150)",
        visibility: pos ? "visible" : "hidden",
      }}
      className="overflow-y-auto rounded-xl border border-[#2a2a2e] bg-[#141416] shadow-[0_18px_48px_-20px_rgba(0,0,0,0.95)]"
    >
      <div style={{ height: panelH, overflowY: "auto", overscrollBehavior: "contain" }}>
        {empty ? (
          <p className="flex h-10 items-center px-3 text-[13px] text-muted-foreground">
            {q && emptyHint && scoped ? emptyHint : "No people found"}
          </p>
        ) : (
          sorted.map((p, i) => {
            const name = p.display_name || p.username;
            return (
              <button
                key={p.id}
                id={`mention-opt-${p.username}`}
                type="button"
                role="option"
                aria-selected={i === active}
                onPointerDown={(e) => {
                  e.preventDefault();
                  onPick(p.username);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex h-12 w-full items-center gap-2.5 px-3 text-left transition-colors focus-visible:outline-none ${
                  i === active ? "bg-[#c8ff3d]/[0.14]" : ""
                }`}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={p.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                    {name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-bold text-[#f2efe6]">
                    <Hi text={name} q={q} />
                  </span>
                  <span className="text-muted-foreground">
                    {"  "}
                    <Hi text={`@${p.username}`} q={q} />
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>,
    document.body,
  );
}
