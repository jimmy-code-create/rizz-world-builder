import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, Smile, Trash2 } from "lucide-react";
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

export type EmojiPick =
  | { kind: "unicode"; value: string }
  | { kind: "custom"; emoji: SharedEmoji };

/**
 * The one emoji picker in the app.
 *
 * Tabs are Recent, Default and one per joined realm, with a shortcode search
 * across all of them. It returns what was picked and nothing else, so the same
 * sheet serves a caption (`<:cat:id>`), a reaction (`ce:<id>`) and a chat
 * message without three copies of this UI.
 */
export function EmojiPicker({
  open,
  onOpenChange,
  realmId = null,
  onPick,
  canManage = false,
  title = "Emojis",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The realm being viewed; its emoji are offered even if not shared. */
  realmId?: string | null;
  onPick: (pick: EmojiPick) => void;
  /** Owners and admins see remove; everyone sees report. */
  canManage?: boolean;
  title?: string;
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
          </div>

          {emoji.isLoading ? (
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
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-xl transition-transform hover:scale-110 active:scale-95"
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
        className="flex h-10 w-10 items-center justify-center rounded-lg transition-transform hover:scale-110 active:scale-95"
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
        <div className="absolute right-0 top-9 z-20 w-36 overflow-hidden rounded-xl border border-white/10 bg-[#141414] text-[11px] shadow-xl">
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
