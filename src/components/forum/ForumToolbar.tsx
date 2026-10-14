import { Bell, BellOff, Eye, EyeOff, LayoutGrid, List, Rows3, Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TagChip } from "@/components/forum/ForumBits";
import {
  FORUM_FONT_SCALES,
  FORUM_LAYOUTS,
  FORUM_SORTS,
  type ForumDensity,
  type ForumLayout,
  type ForumSort,
} from "@/lib/forum-prefs";
import type { ForumFilters, ForumStatus, ForumTag } from "@/lib/forums";
import { cn } from "@/lib/utils";

/**
 * The forum's control strip: search, sort, tag chips, layout, and the reader's
 * own view options.
 *
 * Everything here writes to one place — filters to the container, view choice to
 * the reader's forum preferences — so the list, the cards and the next visit all
 * agree about how the forum is being read.
 */

export function ForumSearchField({
  value,
  onChange,
  placeholder = "Search this forum",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label="Search this forum"
        maxLength={80}
        className="h-10 border-[var(--forum-border)] bg-[var(--forum-surface-sunken)] pl-9 pr-9"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function ForumSortMenu({
  sort,
  onChange,
}: {
  sort: ForumSort;
  onChange: (sort: ForumSort) => void;
}) {
  const current = FORUM_SORTS.find((entry) => entry.id === sort) ?? FORUM_SORTS[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-[var(--forum-border)] bg-[var(--forum-surface-sunken)] px-3 text-[12px] font-semibold transition-colors hover:border-[var(--forum-accent)]"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">{current.label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass-strong w-52 border-white/10">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Sort threads
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={sort} onValueChange={(next) => onChange(next as ForumSort)}>
          {FORUM_SORTS.map((entry) => (
            <DropdownMenuRadioItem key={entry.id} value={entry.id} className="text-[13px]">
              {entry.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const LAYOUT_ICONS: Record<ForumLayout, typeof List> = {
  card: Rows3,
  compact: List,
  gallery: LayoutGrid,
};

export function ForumLayoutSwitcher({
  layout,
  onChange,
}: {
  layout: ForumLayout;
  onChange: (layout: ForumLayout) => void;
}) {
  return (
    <div
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-[var(--forum-border)] bg-[var(--forum-surface-sunken)] p-0.5"
      role="group"
      aria-label="Thread layout"
    >
      {FORUM_LAYOUTS.map((entry) => {
        const Icon = LAYOUT_ICONS[entry.id];
        const active = layout === entry.id;
        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => onChange(entry.id)}
            aria-pressed={active}
            title={`${entry.label} — ${entry.hint}`}
            className={cn(
              "grid h-9 w-9 place-items-center rounded-full transition-colors",
              active
                ? "bg-[var(--forum-accent-soft)] text-[var(--forum-accent)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span className="sr-only">{entry.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The reader's own controls: density, text size, hide-read, follows and mute. */
export function ForumViewOptions({
  density,
  fontScale,
  hideRead,
  statuses,
  statusId,
  archive,
  onDensity,
  onFontScale,
  onHideRead,
  onStatus,
  onArchive,
  tags,
  followingTags,
  onToggleFollow,
  muted,
  onToggleMute,
}: {
  density: ForumDensity;
  fontScale: number;
  hideRead: boolean;
  statuses: ForumStatus[];
  statusId: string | null;
  archive: ForumFilters["archive"];
  onDensity: (density: ForumDensity) => void;
  onFontScale: (scale: number) => void;
  onHideRead: (value: boolean) => void;
  onStatus: (statusId: string | null) => void;
  onArchive: (archive: ForumFilters["archive"]) => void;
  tags: ForumTag[];
  followingTags: Set<string>;
  onToggleFollow: (tagId: string) => void;
  muted: boolean;
  onToggleMute: (muted: boolean) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="View options"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--forum-border)] bg-[var(--forum-surface-sunken)] text-muted-foreground transition-colors hover:text-foreground"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="glass-strong max-h-[70dvh] w-72 overflow-y-auto border-white/10 p-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          How you read this forum
        </p>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px]">Compact rows</span>
            <Switch
              checked={density === "compact"}
              onCheckedChange={(value) => onDensity(value ? "compact" : "comfortable")}
              aria-label="Compact rows"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px]">Hide threads you've read</span>
            <Switch checked={hideRead} onCheckedChange={onHideRead} aria-label="Hide read threads" />
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-[13px]">
              {hideRead ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
              Text size
            </span>
            <div className="flex items-center gap-1">
              {FORUM_FONT_SCALES.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onFontScale(entry.id)}
                  aria-pressed={Math.abs(fontScale - entry.id) < 0.001}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] font-bold",
                    Math.abs(fontScale - entry.id) < 0.001
                      ? "border-[var(--forum-accent)] bg-[var(--forum-accent-soft)]"
                      : "border-[var(--forum-border)] text-muted-foreground",
                  )}
                >
                  {entry.label.charAt(0)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px]">Mute this forum</span>
            <Switch checked={muted} onCheckedChange={onToggleMute} aria-label="Mute this forum" />
          </div>

          {statuses.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => onStatus(null)}
                  aria-pressed={statusId === null}
                  className={cn(
                    "forum-chip",
                    statusId === null ? "border-[var(--forum-accent)] bg-[var(--forum-accent-soft)]" : "text-muted-foreground",
                  )}
                >
                  Any
                </button>
                {statuses.map((status) => (
                  <button
                    key={status.id}
                    type="button"
                    onClick={() => onStatus(statusId === status.id ? null : status.id)}
                    aria-pressed={statusId === status.id}
                    className={cn(
                      "forum-chip",
                      statusId === status.id ? "border-[var(--forum-accent)]" : "text-muted-foreground",
                    )}
                  >
                    {status.emoji} {status.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Archived</p>
            <div className="flex flex-wrap gap-1.5">
              {([
                { id: "hide", label: "Hide" },
                { id: "only", label: "Only archived" },
                { id: "all", label: "Show all" },
              ] as const).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onArchive(option.id)}
                  aria-pressed={archive === option.id}
                  className={cn(
                    "forum-chip",
                    archive === option.id
                      ? "border-[var(--forum-accent)] bg-[var(--forum-accent-soft)]"
                      : "text-muted-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {tags.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Tags you follow
              </p>
              <p className="mb-2 text-[11px] text-muted-foreground">
                We'll notify you when someone posts in a tag you follow.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const following = followingTags.has(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => onToggleFollow(tag.id)}
                      aria-pressed={following}
                      className={cn("forum-chip gap-1", following ? "border-[var(--forum-accent)]" : "text-muted-foreground")}
                    >
                      {following ? <Bell className="h-3 w-3" aria-hidden /> : <BellOff className="h-3 w-3" aria-hidden />}
                      {tag.emoji} {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** The whole sticky bar: search, sort, layout, chips and options. */
export function ForumToolbar({
  search,
  onSearch,
  sort,
  onSort,
  layout,
  onLayout,
  tags,
  activeTagIds,
  onToggleTag,
  leading,
  trailing,
}: {
  search: string;
  onSearch: (value: string) => void;
  sort: ForumSort;
  onSort: (sort: ForumSort) => void;
  layout: ForumLayout;
  onLayout: (layout: ForumLayout) => void;
  tags: ForumTag[];
  activeTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onClearTags?: () => void;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      className="space-y-2 border-b px-3 py-2"
      style={{ borderColor: "var(--forum-border)", background: "var(--surface-bar)" }}
    >
      <div className="flex items-center gap-2">
        {leading}
        <ForumSearchField value={search} onChange={onSearch} />
        <ForumSortMenu sort={sort} onChange={onSort} />
        <ForumLayoutSwitcher layout={layout} onChange={onLayout} />
        {trailing}
      </div>

      {tags.length > 0 && (
        <div className="no-scrollbar -mx-3 flex items-center gap-1.5 overflow-x-auto px-3">
          {activeTagIds.length > 0 && (
            <button
              type="button"
              onClick={onClearTags ?? (() => activeTagIds.forEach(onToggleTag))}
              className="forum-chip shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" aria-hidden />
              Clear
            </button>
          )}
          {tags.map((tag) => (
            <TagChip
              key={tag.id}
              tag={tag}
              active={activeTagIds.includes(tag.id)}
              onClick={() => onToggleTag(tag.id)}
              className="shrink-0"
            />
          ))}
        </div>
      )}
    </div>
  );
}
