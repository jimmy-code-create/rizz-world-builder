import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock3, Search, Smile, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { readRecentEmoji } from "@/lib/emoji-shared";
import { recordEmojiUse, useEmojiPreferences } from "@/lib/emoji-recents";

/**
 * The emoji tab of the composer sheet: smileys, and only smileys.
 *
 * The old panel carried the whole Unicode catalogue (750 glyphs in nine
 * sections), every joined realm's custom pack and a preview overlay. Opening it
 * meant building ~800 items, measuring nine virtualised sections and firing a
 * network request per visible face. This is one flat table of faces instead:
 * no query, no sections to measure, no image requests. A cell is a text glyph,
 * so the first frame is the finished frame — that is the whole lag fix.
 *
 * What a pick returns is unchanged (a raw glyph, or a `:shortcode:` token),
 * so every composer keeps working without knowing the panel got simpler.
 */

type Smiley = { char: string; name: string; tags?: string };

/**
 * The faces, in the order people look for them: grins, love, tongues, hands
 * over faces, neutral, sad, angry, then the cats the app is named after.
 * `name` is also the search text, so it is written the way someone types it.
 */
export const SMILEY_EMOJI: readonly Smiley[] = [
  { char: "😀", name: "grinning", tags: "smile happy" },
  { char: "😃", name: "grin big eyes", tags: "smile happy" },
  { char: "😄", name: "grin smiling eyes", tags: "smile happy" },
  { char: "😁", name: "beaming", tags: "smile teeth" },
  { char: "😆", name: "laughing squint", tags: "lol happy" },
  { char: "😅", name: "sweat smile", tags: "nervous relief" },
  { char: "🤣", name: "rolling laughing", tags: "rofl lol" },
  { char: "😂", name: "tears of joy", tags: "laugh cry funny" },
  { char: "🙂", name: "slight smile", tags: "polite fine" },
  { char: "🙃", name: "upside down", tags: "silly sarcasm" },
  { char: "🫠", name: "melting", tags: "hot overwhelmed" },
  { char: "😉", name: "wink", tags: "flirt tease" },
  { char: "😊", name: "blush", tags: "smile shy" },
  { char: "😇", name: "halo angel", tags: "innocent good" },
  { char: "🥰", name: "hearts smile", tags: "love adore" },
  { char: "😍", name: "heart eyes", tags: "love crush" },
  { char: "🤩", name: "star struck", tags: "wow amazed" },
  { char: "😘", name: "blowing a kiss", tags: "love kiss" },
  { char: "😗", name: "kissing", tags: "kiss" },
  { char: "☺️", name: "relaxed", tags: "smile blush" },
  { char: "😚", name: "kiss closed eyes", tags: "kiss shy" },
  { char: "😙", name: "kiss smiling eyes", tags: "kiss" },
  { char: "🥲", name: "happy tear", tags: "cry proud" },
  { char: "😋", name: "yum", tags: "tongue tasty" },
  { char: "😛", name: "tongue out", tags: "silly" },
  { char: "😜", name: "wink tongue", tags: "silly crazy" },
  { char: "🤪", name: "zany", tags: "crazy silly" },
  { char: "😝", name: "squint tongue", tags: "silly" },
  { char: "🤑", name: "money mouth", tags: "rich cash" },
  { char: "🤗", name: "hug", tags: "warm comfort" },
  { char: "🤭", name: "giggle", tags: "oops laugh" },
  { char: "🫢", name: "gasp", tags: "shock oops" },
  { char: "🫣", name: "peeking", tags: "shy scared" },
  { char: "🤫", name: "shush", tags: "quiet secret" },
  { char: "🤔", name: "thinking", tags: "hmm maybe" },
  { char: "🫡", name: "salute", tags: "yes sir respect" },
  { char: "🤐", name: "zipper mouth", tags: "quiet secret" },
  { char: "🤨", name: "raised brow", tags: "sus doubt" },
  { char: "😐", name: "neutral", tags: "meh blank" },
  { char: "😑", name: "expressionless", tags: "meh done" },
  { char: "😶", name: "no mouth", tags: "speechless" },
  { char: "🫥", name: "dotted out", tags: "invisible gone" },
  { char: "😏", name: "smirk", tags: "sus smug" },
  { char: "😒", name: "unamused", tags: "side eye meh" },
  { char: "🙄", name: "eye roll", tags: "whatever" },
  { char: "😬", name: "grimace", tags: "awkward yikes" },
  { char: "😮‍💨", name: "exhale", tags: "sigh relief" },
  { char: "🤥", name: "lying", tags: "pinocchio" },
  { char: "😌", name: "relieved", tags: "calm peace" },
  { char: "😔", name: "pensive", tags: "sad down" },
  { char: "😪", name: "sleepy", tags: "tired" },
  { char: "🤤", name: "drool", tags: "tasty sleep" },
  { char: "😴", name: "sleeping", tags: "tired zzz" },
  { char: "😷", name: "mask", tags: "sick covid" },
  { char: "🤒", name: "thermometer", tags: "sick ill" },
  { char: "🤕", name: "bandage", tags: "hurt ouch" },
  { char: "🤢", name: "nauseated", tags: "sick gross" },
  { char: "🤮", name: "vomit", tags: "sick gross" },
  { char: "🤧", name: "sneeze", tags: "sick bless you" },
  { char: "🥵", name: "hot", tags: "sweat heat" },
  { char: "🥶", name: "cold", tags: "freezing" },
  { char: "🥴", name: "woozy", tags: "drunk dizzy" },
  { char: "😵", name: "dizzy", tags: "dead knocked out" },
  { char: "😵‍💫", name: "spiral eyes", tags: "confused dizzy" },
  { char: "🤯", name: "mind blown", tags: "wow shock" },
  { char: "🤠", name: "cowboy", tags: "yeehaw hat" },
  { char: "🥳", name: "party", tags: "celebrate birthday" },
  { char: "🥸", name: "disguised", tags: "incognito" },
  { char: "😎", name: "cool", tags: "sunglasses swag" },
  { char: "🤓", name: "nerd", tags: "glasses smart" },
  { char: "🧐", name: "monocle", tags: "hm inspect" },
  { char: "😕", name: "confused", tags: "unsure" },
  { char: "🫤", name: "diagonal mouth", tags: "meh unsure" },
  { char: "😟", name: "worried", tags: "concern" },
  { char: "🙁", name: "frown", tags: "sad" },
  { char: "☹️", name: "very sad", tags: "frown" },
  { char: "😮", name: "surprised", tags: "oh wow" },
  { char: "😯", name: "hushed", tags: "oh" },
  { char: "😲", name: "astonished", tags: "shock wow" },
  { char: "😳", name: "flushed", tags: "blush embarrassed" },
  { char: "🥺", name: "pleading", tags: "please puppy" },
  { char: "🥹", name: "holding tears", tags: "cry touched" },
  { char: "😦", name: "frowning open mouth", tags: "sad shock" },
  { char: "😧", name: "anguished", tags: "worried" },
  { char: "😨", name: "fearful", tags: "scared" },
  { char: "😰", name: "anxious sweat", tags: "nervous" },
  { char: "😥", name: "sad relieved", tags: "phew sad" },
  { char: "😢", name: "cry", tags: "sad tear" },
  { char: "😭", name: "sob", tags: "cry loud sad" },
  { char: "😱", name: "scream", tags: "shock scared" },
  { char: "😖", name: "confounded", tags: "frustrated" },
  { char: "😣", name: "persevere", tags: "struggle" },
  { char: "😞", name: "disappointed", tags: "sad" },
  { char: "😓", name: "downcast sweat", tags: "sad tired" },
  { char: "😩", name: "weary", tags: "tired ugh" },
  { char: "😫", name: "tired", tags: "exhausted" },
  { char: "🥱", name: "yawn", tags: "bored tired" },
  { char: "😤", name: "triumph", tags: "huff proud" },
  { char: "😡", name: "angry", tags: "mad rage" },
  { char: "😠", name: "mad", tags: "angry" },
  { char: "🤬", name: "cursing", tags: "angry swearing" },
  { char: "😈", name: "smiling devil", tags: "naughty" },
  { char: "👿", name: "angry devil", tags: "evil" },
  { char: "💀", name: "skull", tags: "dead gone" },
  { char: "🤡", name: "clown", tags: "fool" },
  { char: "👻", name: "ghost", tags: "boo" },
  { char: "👽", name: "alien", tags: "space" },
  { char: "🤖", name: "robot", tags: "bot" },
  { char: "😺", name: "cat grin", tags: "cat kitty" },
  { char: "😸", name: "cat smile", tags: "cat kitty" },
  { char: "😹", name: "cat tears of joy", tags: "cat laugh" },
  { char: "😻", name: "cat heart eyes", tags: "cat love" },
  { char: "😼", name: "cat smirk", tags: "cat smug" },
  { char: "😽", name: "cat kiss", tags: "cat kiss" },
  { char: "🙀", name: "cat wow", tags: "cat shock" },
  { char: "😿", name: "cat crying", tags: "cat sad" },
  { char: "😾", name: "cat pout", tags: "cat angry" },
] as const;

const SMILEY_CHARS = new Set(SMILEY_EMOJI.map((entry) => entry.char));
const RECENT_LIMIT = 16;

function matches(entry: Smiley, term: string): boolean {
  if (!term) return true;
  const haystack = `${entry.char} ${entry.name} ${entry.tags ?? ""}`.toLowerCase();
  return term.split(/\s+/).every((word) => haystack.includes(word));
}

export type RizzEmojiPanelProps = {
  /** Kept for callers that still pass it; the panel no longer reads a realm. */
  realmKey?: string;
  realmId?: string;
  realmName?: string;
  /** Controlled when the sheet owns the sticky search field. */
  query?: string;
  onQueryChange?: (query: string) => void;
  onPick?: (token: string, emoji: string) => void;
  /** Legacy single-callback form: only used when `onPick` is absent. */
  onEmoji?: (emoji: string) => void;
  onClose?: () => void;
  /** Kept for the sheet's menu affordance; the panel shows only smileys. */
  onManage?: () => void;
  mode?: "normal" | "reactions";
  className?: string;
  initialScrollTop?: number;
  onScrollTopChange?: (scrollTop: number) => void;
};

export function RizzEmojiPanel({
  realmId,
  query,
  onQueryChange,
  onPick,
  onEmoji,
  mode = "normal",
  className,
  initialScrollTop = 0,
  onScrollTopChange,
}: RizzEmojiPanelProps) {
  const prefs = useEmojiPreferences();
  const [localQuery, setLocalQuery] = useState("");
  const [storedRecents, setStoredRecents] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const controlledSearch = query !== undefined;
  const searchValue = controlledSearch ? (query ?? "") : localQuery;
  const term = searchValue.trim().toLowerCase();

  // Both stores are written on every pick; reading them on mount keeps the
  // recent row honest without a subscription on the hot path.
  useEffect(() => {
    setStoredRecents(readRecentEmoji());
  }, [prefs.updatedAt]);

  const recents = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const token of [...prefs.recents, ...storedRecents]) {
      if (!SMILEY_CHARS.has(token) || seen.has(token)) continue;
      seen.add(token);
      out.push(token);
      if (out.length >= RECENT_LIMIT) break;
    }
    return out;
  }, [prefs.recents, storedRecents]);

  // 100-ish faces filter in well under a frame, so the field stays local and
  // instant: no debounce, no deferred value, no worker.
  const results = useMemo(() => SMILEY_EMOJI.filter((entry) => matches(entry, term)), [term]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTop = initialScrollTop;
    // Only the remembered position matters; the sheet remounts on each open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = useCallback(
    (char: string) => {
      recordEmojiUse(char, realmId);
      // Exactly one callback per tap. Calling both used to insert the same
      // emoji twice in the composer (two `onSelect` calls, one draft append).
      if (onPick) onPick(char, char);
      else onEmoji?.(char);
    },
    [onEmoji, onPick, realmId],
  );

  const renderCell = (char: string, name: string) => (
    <button
      key={char}
      type="button"
      className="emoji-cell emoji-cell--smiley"
      aria-label={`${name} emoji`}
      title={name}
      onClick={() => pick(char)}
    >
      <span className="emoji-cell__glyph" aria-hidden="true">
        {char}
      </span>
    </button>
  );

  const heading = term ? "Results" : "Smileys";
  const shown = term ? results.length : SMILEY_EMOJI.length;

  return (
    <div
      className={cn("rizz-picker relative flex h-full min-h-0 flex-col", className)}
      data-mode={mode}
    >
      {!controlledSearch && (
        <div className="shrink-0 px-4 pb-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              value={searchValue}
              onChange={(event) => setLocalQuery(event.target.value)}
              placeholder="Search smileys"
              aria-label="Search smileys"
              className="h-10 w-full rounded-[10px] border border-white/[0.08] bg-white/[0.04] pl-9 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-white/25"
              autoFocus={mode === "reactions"}
            />
            {searchValue && (
              <button
                type="button"
                aria-label="Clear search"
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
                onClick={() => setLocalQuery("")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        className="rizz-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4"
        onScroll={(event) => onScrollTopChange?.(event.currentTarget.scrollTop)}
      >
        {!term && recents.length > 0 && (
          <section className="emoji-smiley-group" aria-label="Recent smileys">
            <div className="emoji-smiley-head">
              <span className="flex items-center gap-1.5">
                <Clock3 className="h-3 w-3" aria-hidden="true" /> Recent
              </span>
            </div>
            <div className="rizz-emoji-grid rizz-emoji-grid--smileys">
              {recents.map((char) => renderCell(char, "recent"))}
            </div>
          </section>
        )}

        <section className="emoji-smiley-group" aria-label={heading}>
          <div className="emoji-smiley-head">
            <span className="flex items-center gap-1.5">
              <Smile className="h-3 w-3" aria-hidden="true" /> {heading}
            </span>
            <span className="emoji-smiley-count">{shown}</span>
          </div>
          {results.length ? (
            <div className="rizz-emoji-grid rizz-emoji-grid--smileys">
              {results.map((entry) => renderCell(entry.char, entry.name))}
            </div>
          ) : (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              No smiley matches “{searchValue.trim()}”.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
