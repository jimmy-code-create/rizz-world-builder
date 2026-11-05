// Rizz emoji panel: realm-aware picker with sections, search, recents,
// favorites, per-realm emoji, and a reactions mode for reuse.

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { useEmojiPreferences, recordEmojiUse } from '@/lib/emoji-recents';
import {
  type EmojiEntry,
  emojiCategory,
  search,
  withSkinTone,
} from '@/lib/emoji-data';

type EmojiInput =
  | string
  | { native?: string; unicode?: string; id?: string };

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
  mode?: 'normal' | 'reactions';
  className?: string;
}

export function rememberEmojiPick(
  emoji: EmojiInput,
  realmId?: string,
): void {
  const token =
    typeof emoji === 'string'
      ? emoji
      : emoji.native || emoji.unicode || emoji.id || '';
  if (token) {
    recordEmojiUse(token, realmId);
  }
}

export function RizzEmojiPanel({
  realmKey,
  realmId,
  onPick,
  onEmoji,
  onClose,
  mode = 'normal',
}: RizzEmojiPanelProps) {
  const id = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const prefs = useEmojiPreferences();

  const results = search(query);

  const insertEmoji = useCallback(
    (token: string, emoji?: EmojiInput) => {
      if (token) {
        onEmoji?.(token);
        setSelected?.(token);
        onPick?.(token, emoji ?? token);
      }
    },
    [onEmoji, onPick],
  );

  const clearSearch = useCallback(() => {
    setQuery('');
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    if (mode === 'reactions' && searchRef.current) {
      searchRef.current.focus();
    }
  }, [mode]);

  const topEmoji = prefs.top.slice(0, 8);
  const recentEmoji = prefs.recents.slice(0, 12);
  const favoriteEmoji = prefs.favorites.slice(0, 12);

  const onSelectEmoji = (
    token: string,
    emoji: EmojiInput,
  ) => {
    insertEmoji(token, emoji);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Emoji picker">
      <div aria-labelledby={`${id}-label`}>
        <h2 id={`${id}-label`}>
          {mode === 'reactions' ? 'Add reaction' : 'Select emoji'}
        </h2>
        <input
          ref={searchRef}
          type="search"
          placeholder="Find the perfect emoji"
          value={query ?? ''}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search emoji"
        />
        {query ? (
          <button type="button" onClick={clearSearch} aria-label="Clear search">
            Clear
          </button>
        ) : null}
      </div>

      <section aria-label="Top emoji">
        <h3>Top emoji</h3>
        <ul>            {topEmoji.map((emoji: string) => (
              <li key={emoji}>
                <button
                  type="button"
                  aria-label={emoji}
                  onClick={() => onSelectEmoji(emoji, emoji)}
                >
                  {emoji}
                </button>
              </li>
            ))}
        </ul>
      </section>

      <section aria-label="Recently used">
        <h3>Recently used</h3>
        <ul>
          {recentEmoji.map((emoji: string) => (
            <li key={emoji}>
              <button
                type="button"
                aria-label={emoji}
                onClick={() => onSelectEmoji(emoji, emoji)}
              >
                {emoji}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Favorites">
        <h3>Favorites</h3>
        <ul>
          {favoriteEmoji.map((emoji: string) => (
            <li key={emoji}>
              <button
                type="button"
                aria-label={emoji}
                onClick={() => onSelectEmoji(emoji, emoji)}
              >
                {emoji}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {(realmKey && realmKey.length > 0) || (realmId && realmId.length > 0) ? (
        <section aria-label={`Emoji for ${realmKey ?? realmId}`}>
          <h3>Realm emoji</h3>
          <ul>
            {results.slice(0, 12).map((entry) => (
              <li key={entry.char}>
                <button
                  type="button"
                  aria-label={entry.name}
                  onClick={() => onSelectEmoji(entry.char, entry.char)}
                >
                  {entry.char}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Categories">
        <h3>Categories</h3>
        <ul>            {results.map((entry) => {
              const cat = emojiCategory(entry.char);
              if (!cat) return null;
              return (
                <li key={entry.char}>
                  <button
                    type="button"
                    aria-label={entry.name}
                    onClick={() => onSelectEmoji(entry.char, entry.char)}
                  >
                    {entry.char}
                  </button>
                </li>
              );
            })}
        </ul>
      </section>

      {onClose ? (
        <button type="button" onClick={onClose}>
          Close
        </button>
      ) : null}
    </div>
  );
}
