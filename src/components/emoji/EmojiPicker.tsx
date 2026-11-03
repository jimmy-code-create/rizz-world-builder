import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, Smile, Sparkles, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  DEFAULT_EMOJI,
  groupByRealm,
  readRecentEmoji,
  rememberEmoji,
  searchEmoji,
  sharedEmojiKey,
  useJoinedEmoji,
  type SharedEmoji,
} from "@/lib/emoji-shared";
import { removeSharedEmoji, reportRealmEmoji } from "@/lib/realm-emoji-actions";
import { CatEmoji } from "@/components/emoji/CatEmoji";
import { CAT_EMOJI_MANIFEST } from "@/components/emoji/cat-emoji-manifest";

export type EmojiPick =
  | { kind: "unicode"; value: string }
  | { kind: "custom"; emoji: SharedEmoji };

/**
 * The one emoji picker in the app.
 *
 * Tabs are Recent, Default, one per joined realm, and the RIZZ cat pack last,
 * with a shortcode search across all of them. It returns what was picked and
 * nothing else, so the same sheet serves a caption (`<:cat:id>`), a reaction
 * (`ce:<id>`) and a chat message without three copies of this UI.
 *
 * Super-reaction mode (`accent`) opens on the RIZZ pack, but every tab stays
 * available: a super can be a cat, a plain glyph or a realm upload. The mode
 * changes how a pick is sent, never which emoji are allowed.
 */
const RIZZ_TAB = "rizz";
export function EmojiPicker({
  open,
  onOpenChange,
  realmId = null,
  onPick,
  canManage = false,
  title = "Emojis",
  footer,
  accent = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The realm being viewed; its emoji are offered even if not shared. */
  realmId?: string | null;
  onPick: (pick: EmojiPick) => void;
  /** Owners and admins see remove; everyone sees report. */
  canManage?: boolean;
  title?: string;
  /** Optional row under the grid — e.g. the post card's super-reaction switch. */
  footer?: React.ReactNode;
  /** Marks a mode that changes what a pick means, e.g. super reactions. */
  accent?: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const emoji = useJoinedEmoji(realmId);
  const rows = emoji.data ?? [];
  const groups = useMemo(() => groupByRealm(rows), [rows]);
  const [tab, setTab] = useState<string>("default");
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    if (open) setRecent(readRecentEmoji());
    else setQuery("");
  }, [open]);

  // Super mode opens on the cat pack, but the other tabs stay selectable.
  useEffect(() => {
    if (accent) setTab(RIZZ_TAB);
  }, [accent]);

  const rizzEntries = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return CAT_EMOJI_MANIFEST;
    return CAT_EMOJI_MANIFEST.filter((entry) =>
      `${entry.name} ${entry.label} ${entry.tags.join(" ")} ${entry.shortcode}`
        .toLowerCase()
        .includes(term),
    );
  }, [query]);

  const recentRows = useMemo(
    () => recent.map((id) => rows.find((row) => row.id === id)).filter(Boolean) as SharedEmoji[],
    [recent, rows],
  );

  const showing = useMemo(() => {
    if (query.trim()) return searchEmoji(rows, query);
    if (tab === "recent") return recentRows;
    if (tab === "default") return [];
    return groups.find((group) => group.id === tab)?.emoji ?? [];
  }, [groups, query, recentRows, rows, tab]);

  const chooseUnicode = (value: string) => {
    onPick({ kind: "unicode", value });
    onOpenChange(false);
  };

  const chooseCustom = (row: SharedEmoji) => {
    if (!user) return;
    rememberEmoji(row.id);
    onPick({ kind: "custom", emoji: row });
    onOpenChange(false);
  };

  const remove = async (row: SharedEmoji) => {
    try {
      await removeSharedEmoji(row.id);
      await qc.invalidateQueries({ queryKey: sharedEmojiKey(realmId) });
      toast.success(`:${row.shortcode}: removed`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't remove that emoji");
    }
  };

  const report = async (row: SharedEmoji) => {
    try {
      await reportRealmEmoji(row.id, "Reported from the picker");
      toast.success("Reported — a moderator will look at it");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't report that emoji");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="glass-strong max-h-[76dvh] rounded-t-3xl border-white/10 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] sm:mx-auto sm:max-w-md"
      >
        <SheetHeader className="px-1 text-left">
          <SheetTitle className="flex items-center gap-2 font-display text-base">
            <Smile className="h-4 w-4 text-primary" /> {title}
            {accent ? (
              <span className="ml-auto flex items-center gap-1 rounded-full border border-[var(--super-edge-soft)] bg-[var(--super-wash)] px-2 py-0.5 text-[9px] font-semibold text-[var(--super-paper)]">
                <Sparkles className="h-2.5 w-2.5" aria-hidden="true" /> Super
              </span>
            ) : null}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-2 space-y-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search shortcodes"
              className="glass h-10 border-white/10 pl-9"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>

          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabChip active={tab === "recent" && !query} onClick={() => { setTab("recent"); setQuery(""); }}>
              Recent
            </TabChip>
            <TabChip active={tab === "default" && !query} onClick={() => { setTab("default"); setQuery(""); }}>
              Default
            </TabChip>
            {groups.map((group) => (
              <TabChip
                key={group.id}
                active={tab === group.id && !query}
                onClick={() => { setTab(group.id); setQuery(""); }}
                title={group.name}
              >
                {group.name}
              </TabChip>
            ))}
            {/* The RIZZ pack is a tab like any other; in super mode it is simply
                the one selected first. */}
            <TabChip active={tab === RIZZ_TAB && !query} onClick={() => { setTab(RIZZ_TAB); setQuery(""); }}>
              RIZZ
            </TabChip>
          </div>

          {tab === RIZZ_TAB ? (
            <div className="grid max-h-[38dvh] grid-cols-8 gap-1 overflow-y-auto pb-2">
              {rizzEntries.length ? (
                rizzEntries.map((entry) => (
                  <button
                    key={entry.shortcode}
                    type="button"
                    onClick={() => chooseUnicode(entry.shortcode)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg transition-transform hover:scale-110 active:scale-95 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title={`${entry.label} ${entry.shortcode}`}
                    aria-label={`${entry.label} ${entry.shortcode}`}
                  >
                    <CatEmoji name={entry.name} size={30} animate="hover" />
                  </button>
                ))
              ) : (
                <p className="col-span-8 py-8 text-center text-sm text-muted-foreground">
                  No cat matches “{query.trim()}”.
                </p>
              )}
            </div>
          ) : emoji.isLoading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : query || tab === "recent" ? (
            <div className="grid max-h-[38dvh] grid-cols-8 gap-1 overflow-y-auto pb-2">
              {showing.length === 0 ? (
                <p className="col-span-8 py-8 text-center text-sm text-muted-foreground">
                  {query ? `No emoji match “${query}”` : "Emoji you use will show up here."}
                </p>
              ) : (
                showing.map((row) => (
                  <CustomTile
                    key={row.id}
                    row={row}
                    canManage={canManage}
                    onPick={() => chooseCustom(row)}
                    onRemove={() => void remove(row)}
                    onReport={() => void report(row)}
                  />
                ))
              )}
            </div>
          ) : tab === "default" ? (
            <div className="grid max-h-[38dvh] grid-cols-8 gap-1 overflow-y-auto pb-2">
              {DEFAULT_EMOJI.map((glyph) => (
                <button
                  key={glyph}
                  type="button"
                  onClick={() => chooseUnicode(glyph)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-xl transition-transform hover:scale-110 active:scale-95 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={glyph}
                >
                  {glyph}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid max-h-[38dvh] grid-cols-8 gap-1 overflow-y-auto pb-2">
              {(groups.find((group) => group.id === tab)?.emoji ?? []).map((row) => (
                <CustomTile
                  key={row.id}
                  row={row}
                  canManage={canManage}
                  onPick={() => chooseCustom(row)}
                  onRemove={() => void remove(row)}
                  onReport={() => void report(row)}
                />
              ))}
            </div>
          )}

          {footer ? <div className="pt-1">{footer}</div> : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TabChip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-white/[0.06] text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function CustomTile({
  row,
  canManage,
  onPick,
  onRemove,
  onReport,
}: {
  row: SharedEmoji;
  canManage: boolean;
  onPick: () => void;
  onRemove: () => void;
  onReport: () => void;
}) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onPick}
        onContextMenu={(event) => {
          event.preventDefault();
          setMenu((value) => !value);
        }}
        className="flex h-10 w-10 items-center justify-center rounded-lg transition-transform hover:scale-110 active:scale-95 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title={`:${row.shortcode}:`}
        aria-label={`:${row.shortcode}:`}
      >
        <img
          src={row.url}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-7 w-7 object-contain"
        />
      </button>
      <button
        type="button"
        onClick={() => setMenu((value) => !value)}
        aria-label={`More for :${row.shortcode}:`}
        className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-white/15 text-[9px] text-white group-hover:flex"
      >
        ⋯
      </button>
      {menu ? (
        <div className="absolute right-0 top-9 z-20 w-36 overflow-hidden rounded-xl border border-white/10 bg-card text-[11px] shadow-xl">
          <button
            type="button"
            onClick={() => {
              setMenu(false);
              onReport();
            }}
            className="block w-full px-3 py-2 text-left hover:bg-white/[0.06]"
          >
            Report
          </button>
          {canManage ? (
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                onRemove();
              }}
              className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-red-300 hover:bg-white/[0.06]"
            >
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
