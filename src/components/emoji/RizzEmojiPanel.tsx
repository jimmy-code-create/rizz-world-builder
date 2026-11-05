import { useCallback, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useEmojiPreferences, recordEmojiUse } from "@/lib/emoji-recents";
import { emojiCategory, search } from "@/lib/emoji-data";

type EmojiInput = string | { native?: string; unicode?: string; id?: string };

interface RizzEmojiPanelProps {
  open?: boolean;
  realmKey?: string;
  realmId?: string;
  realmName?: string;
  query?: string;
  onPick?: (token: string, emoji: EmojiInput) => void;
  onEmoji?: (emoji: string) => void;
  onClose?: () => void;
  onManage?: () => void;
  mode?: "normal" | "reactions";
  className?: string;
}

export function rememberEmojiPick(emoji: EmojiInput, realmId?: string): void {
  const token =
    typeof emoji === "string" ? emoji : emoji.native || emoji.unicode || emoji.id || "";
  if (token) {
    recordEmojiUse(token, realmId);
  }
}

export function RizzEmojiPanel({
  realmKey,
  realmId,
  onPick,
  onEmoji,
}: RizzEmojiPanelProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const prefs = useEmojiPreferences();

  const results = search(query);

  const insertEmoji = useCallback(
    (token: string) => {
      if (token) {
        rememberEmojiPick(token, realmId ?? realmKey);
        onEmoji?.(token);
        onPick?.(token, token);
      }
    },
    [onEmoji, onPick, realmId, realmKey],
  );

  const topEmoji = prefs.top.slice(0, 16);
  const recentEmoji = prefs.recents.slice(0, 16);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Search Input */}
      <div className="relative px-4 py-2.5">
        <Search className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={searchRef}
          type="search"
          placeholder="Find the perfect emoji"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-8 text-sm text-white placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {/* Emoji Scroll Area */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-6">
        {!query && recentEmoji.length > 0 && (
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Recently used
            </h3>
            <div className="grid grid-cols-8 gap-1.5">
              {recentEmoji.map((char) => (
                <button
                  key={char}
                  type="button"
                  onClick={() => insertEmoji(char)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-2xl transition-transform hover:scale-125 hover:bg-white/10 active:scale-95"
                >
                  {char}
                </button>
              ))}
            </div>
          </section>
        )}

        {!query && topEmoji.length > 0 && (
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Top emoji
            </h3>
            <div className="grid grid-cols-8 gap-1.5">
              {topEmoji.map((char) => (
                <button
                  key={char}
                  type="button"
                  onClick={() => insertEmoji(char)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-2xl transition-transform hover:scale-125 hover:bg-white/10 active:scale-95"
                >
                  {char}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Search Results or Full Catalog */}
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {query ? `Search results (${results.length})` : "All emoji"}
          </h3>
          <div className="grid grid-cols-8 gap-1.5">
            {results.slice(0, 160).map((entry) => (
              <button
                key={entry.char}
                type="button"
                onClick={() => insertEmoji(entry.char)}
                title={entry.name}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-2xl transition-transform hover:scale-125 hover:bg-white/10 active:scale-95"
              >
                {entry.char}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
