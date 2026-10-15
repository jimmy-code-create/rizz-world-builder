import { useMemo, useState } from "react";
import { CatEmoji } from "./CatEmoji";
import { CAT_EMOJI_MANIFEST, type CatEmojiName } from "./cat-emoji-manifest";

/** Grid of 12: never animates continuously — hover/press/focus only. */
export function CatEmojiPicker({
  value,
  onPick,
  size = 32,
}: {
  value?: string | null;
  onPick: (shortcode: string) => void;
  size?: number;
}) {
  return (
    <div role="listbox" aria-label="Cat emojis" className="grid grid-cols-6 gap-1">
      {CAT_EMOJI_MANIFEST.map((e) => {
        const selected = value === e.shortcode;
        return (
          <button
            key={e.shortcode}
            type="button"
            role="option"
            aria-selected={selected}
            aria-label={`${e.label} ${e.shortcode}`}
            title={`${e.label} ${e.shortcode}`}
            onClick={() => onPick(e.shortcode)}
            className={`grid min-h-[44px] min-w-[44px] place-items-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d] ${
              selected ? "bg-[#c8ff3d]/20 ring-1 ring-[#c8ff3d]" : "hover:bg-white/10"
            }`}
          >
            <CatEmoji name={e.name} size={size} animate="hover" />
          </button>
        );
      })}
    </div>
  );
}

/** Typing ":" in the composer opens a tiny autocomplete of the 12. */
export function getCatQuery(text: string, caret: number): string | null {
  const upto = text.slice(0, caret);
  const m = upto.match(/(?:^|\s):([a-z_]{0,16})$/);
  return m ? m[1] : null;
}

export function replaceCatShortcode(text: string, caret: number, shortcode: string) {
  const upto = text.slice(0, caret);
  const rest = text.slice(caret);
  const m = upto.match(/(?:^|\s)(:[a-z_]{0,16})$/);
  if (!m) return { value: text, caret };
  const start = upto.length - m[1].length;
  const next = `${upto.slice(0, start)}${shortcode} ${rest}`;
  return { value: next, caret: start + shortcode.length + 1 };
}

export function CatAutocomplete({
  value,
  caret,
  onPick,
}: {
  value: string;
  caret: number;
  onPick: (shortcode: string) => void;
}) {
  const query = useMemo(() => getCatQuery(value, caret), [value, caret]);
  const [active, setActive] = useState(0);
  if (query === null) return null;
  const q = query.toLowerCase();
  const hits = CAT_EMOJI_MANIFEST.filter(
    (e) => e.name.includes(q) || e.label.toLowerCase().includes(q) || e.tags.some((t) => t.includes(q)),
  );
  if (!hits.length) return null;
  return (
    <div
      role="listbox"
      aria-label="Cat emoji"
      className="absolute bottom-full left-0 z-50 mb-2 w-64 overflow-hidden rounded-xl border border-[#2a2a2e] bg-[#141416] shadow-2xl"
    >
      {hits.slice(0, 6).map((e, i) => (
        <button
          key={e.shortcode}
          type="button"
          role="option"
          aria-selected={i === active}
          onMouseEnter={() => setActive(i)}
          onMouseDown={(ev) => {
            ev.preventDefault();
            onPick(e.shortcode);
          }}
          className={`flex w-full min-h-[44px] items-center gap-2 px-2 text-left ${i === active ? "bg-white/10" : ""}`}
        >
          <CatEmoji name={e.name as CatEmojiName} size={20} animate="hover" />
          <span className="min-w-0 flex-1 truncate text-[13px] text-[#f2efe6]">{e.shortcode}</span>
          <span className="text-[11px] text-muted-foreground">{e.label}</span>
        </button>
      ))}
    </div>
  );
}
