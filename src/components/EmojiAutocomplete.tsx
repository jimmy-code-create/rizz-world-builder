import { useEffect, useMemo, useRef, useState } from "react";
import { searchCatEmojis, type CatEmojiItem } from "@/lib/cat-emojis";
import { CatEmoji } from "@/components/CatEmoji";
import { Sparkles } from "lucide-react";

/** Detects emoji query token, e.g. `:cat|` -> "cat" or `:vi|` -> "vi" */
export function getEmojiQuery(text: string, caret: number): string | null {
  const upto = text.slice(0, caret);
  // Matches :word with up to 24 chars at the start or after whitespace
  const m = upto.match(/(?:^|\s):([a-z0-9_]{1,24})$/i);
  return m ? m[1].toLowerCase() : null;
}

export function replaceEmojiToken(text: string, caret: number, token: string) {
  const upto = text.slice(0, caret);
  const rest = text.slice(caret);
  const m = upto.match(/(?:^|\s):([a-z0-9_]{1,24})$/i);
  if (!m) return { value: text, caret };
  const start = upto.length - m[1].length - 1; // including the ':'
  const insert = token + " ";
  const next = upto.slice(0, start) + insert + rest;
  return { value: next, caret: start + insert.length };
}

export interface EmojiAutocompleteProps {
  value: string;
  caret: number;
  onPick: (token: string) => void;
  className?: string;
}

export function EmojiAutocomplete({
  value,
  caret,
  onPick,
  className = "",
}: EmojiAutocompleteProps) {
  const query = useMemo(() => getEmojiQuery(value, caret), [value, caret]);
  const hits = useMemo(() => {
    if (query === null) return [];
    return searchCatEmojis(query);
  }, [query]);

  const [active, setActive] = useState(0);
  const popupRef = useRef<HTMLDivElement>(null);

  // Reset active index when query changes
  useEffect(() => {
    setActive(0);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    if (query === null || hits.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && target?.isContentEditable !== true) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const consume = () => {
        e.preventDefault();
        e.stopPropagation();
      };

      if (e.key === "ArrowDown") {
        consume();
        setActive((prev) => (prev + 1) % hits.length);
      } else if (e.key === "ArrowUp") {
        consume();
        setActive((prev) => (prev - 1 + hits.length) % hits.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (e.shiftKey) return;
        consume();
        onPick(hits[Math.min(active, hits.length - 1)].token);
      } else if (e.key === "Escape") {
        consume();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [query, hits, active, onPick]);

  // Outside click dismiss
  useEffect(() => {
    if (query === null || hits.length === 0) return;
    const onDown = (e: PointerEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        // Do nothing, popup relies on query being null
      }
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [query, hits]);

  if (query === null || hits.length === 0) return null;

  return (
    <div
      ref={popupRef}
      role="listbox"
      aria-label="Cat Emojis"
      className={`absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-2xl border border-white/10 bg-[#141416] shadow-[0_18px_48px_-20px_rgba(0,0,0,0.95)] sm:right-auto sm:w-[22rem] ${className}`}
    >
      <div className="flex items-center gap-1.5 px-3 pb-1 pt-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground border-b border-white/5">
        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        <span>Cat Emojis</span>
        <span className="ml-auto text-[10px] text-muted-foreground/80 font-mono">
          {hits.length}
        </span>
      </div>

      <div className="max-h-[min(44dvh,16rem)] overflow-y-auto px-1.5 py-1.5 space-y-0.5">
        {hits.map((item, i) => (
          <button
            key={item.name}
            type="button"
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(item.token);
            }}
            onMouseEnter={() => setActive(i)}
            className={`flex w-full min-h-[44px] items-center gap-3 rounded-xl px-2.5 py-1.5 text-left transition-colors ${
              i === active ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
            }`}
          >
            <CatEmoji name={item.name} size={28} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm font-semibold text-[#f2efe6] leading-tight">
                {item.token}
              </p>
              <p className="text-[11px] text-muted-foreground truncate leading-tight">
                {item.label}
              </p>
            </div>
          </button>
        ))}
      </div>

      <div className="hidden items-center justify-between border-t border-white/5 bg-black/30 px-3 py-1.5 text-[11px] text-muted-foreground sm:flex">
        <span className="inline-flex items-center gap-1">
          <kbd className="rounded border border-white/10 bg-white/5 px-1 font-mono text-[10px]">
            ↑↓
          </kbd>{" "}
          navigate
        </span>
        <span className="inline-flex items-center gap-1">
          <kbd className="rounded border border-white/10 bg-white/5 px-1 font-mono text-[10px]">
            ↵
          </kbd>{" "}
          pick
        </span>
      </div>
    </div>
  );
}
