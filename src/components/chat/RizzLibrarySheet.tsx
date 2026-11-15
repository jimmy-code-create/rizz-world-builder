/**
 * The Rizz Library body.
 *
 * It lives inside the composer dock — one surface, not a second sheet — and
 * gives the attach tab what a phone gallery needs: Recent / Uploads / Saved,
 * a 4-column square grid, multi-select with numbered badges, a long-press
 * preview, and the camera/upload tiles above the grid.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Download, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import {
  bucketLibrary,
  prepareLibraryFiles,
  removeLibraryItem,
  saveLibraryItem,
  savedLibrary,
  type LibraryItem,
  type LibraryTab,
  type PreparedLibraryFile,
} from "@/lib/rizz-library";

const COLLAPSED_TAB = 34;
/** Selection is capped so one send cannot become a wall of media. */
const MAX_SELECTION = 10;
const TABS: Array<{ id: LibraryTab; label: string }> = [
  { id: "recent", label: "Recent" },
  { id: "uploads", label: "Uploads" },
  { id: "saved", label: "Saved" },
];

export type RizzLibrarySheetProps = {
  userId?: string | null;
  /** Photos already in this conversation, newest first. */
  recentPhotos: { id: string; url: string }[];
  onPickPhoto: (url: string) => void;
  onPhotos: () => void;
  onCamera: () => void;
  onFiles: () => void;
  onPoll?: () => void;
  onSchedule?: () => void;
  scheduleDisabled?: boolean;
  disabled?: boolean;
};

export function RizzLibrarySheet({
  userId,
  recentPhotos,
  onPickPhoto,
  onPhotos,
  onCamera,
  onFiles,
  onPoll,
  onSchedule,
  scheduleDisabled,
  disabled,
}: RizzLibrarySheetProps) {
  const [tab, setTab] = useState<LibraryTab>("recent");
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<LibraryItem | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  // Named `offset` because it is the drag distance, in pixels, from the tab.
  const dragStart = useRef<number | null>(null);
  const pressTimer = useRef<number | null>(null);

  const [recent, setRecent] = useState<LibraryItem[]>([]);
  const [uploads, setUploads] = useState<LibraryItem[]>([]);
  const [saved, setSaved] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSaved(savedLibrary());
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    void bucketLibrary(userId, "recent")
      .then((items) => {
        if (!cancelled) setRecent(items);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const items = useMemo<LibraryItem[]>(() => {
    if (tab === "uploads") return uploads;
    if (tab === "saved") return saved;
    // Recent merges what the conversation holds with what was just prepared, so
    // a picture sent a second ago is at the top where it is expected.
    const seen = new Set<string>();
    const merged: LibraryItem[] = [];
    for (const item of [...uploads, ...recent]) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      merged.push(item);
    }
    for (const photo of recentPhotos) {
      if (seen.has(photo.url)) continue;
      seen.add(photo.url);
      merged.push({ id: photo.id, url: photo.url, kind: "image" });
    }
    return merged;
  }, [tab, uploads, recent, recentPhotos, saved]);

  const toggle = useCallback((item: LibraryItem) => {
    setSelected((current) => {
      if (current.includes(item.url)) return current.filter((value) => value !== item.url);
      if (current.length >= MAX_SELECTION) {
        toast.error(`Up to ${MAX_SELECTION} at a time`);
        return current;
      }
      return [...current, item.url];
    });
  }, []);

  const addSelected = () => {
    for (const url of selected) onPickPhoto(url);
    setSelected([]);
  };

  const savePreview = () => {
    if (!preview) return;
    setSaved(saveLibraryItem(preview));
    setPreview(null);
    toast.success("Saved to your library");
  };

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setFailure(null);
    setProgress({ done: 0, total: files.length });
    try {
      const prepared = await prepareLibraryFiles(files, (done, total) => setProgress({ done, total }));
      if (prepared.length === 0) throw new Error("None of those files could be read.");
      const mapped: (PreparedLibraryFile & { item: LibraryItem })[] = prepared.map((entry) => ({
        ...entry,
        item: {
          id: entry.id,
          url: entry.preview,
          thumb: entry.thumb,
          kind: entry.kind,
        },
      }));
      setUploads((current) => [...mapped.map((entry) => entry.item), ...current]);
      setTab("uploads");
      // Hand the compressed files to the composer, one per attachment.
      for (const entry of mapped) onPickPhoto(entry.item.url);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Could not prepare those files.");
    } finally {
      setProgress(null);
    }
  };

  const startPress = (item: LibraryItem) => {
    pressTimer.current = window.setTimeout(() => setPreview(item), 450);
  };
  const endPress = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  const active = items;
  // The drag distance as a CSS length, so the transform stays valid CSS.
  const offset = dragOffset === null || dragOffset === 0 ? "0px" : `${dragOffset}px`;
  const { done, total } = progress ?? { done: 0, total: 0 };
  const progressLabel = progress ? `Preparing ${done} of ${total}` : "";

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{
        transform: dragOffset === null ? undefined : `translate3d(0, ${offset}, 0)`,
        transition: dragOffset === null ? "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
      }}
    >
      <button
        type="button"
        aria-label={expanded ? "Shrink the library" : "Expand the library"}
        onClick={() => setExpanded((value) => !value)}
        onPointerDown={(event) => {
          dragStart.current = event.clientY;
          setDragOffset(0);
        }}
        onPointerMove={(event) => {
          if (dragStart.current === null) return;
          const delta = event.clientY - dragStart.current;
          setDragOffset(Math.max(-140, Math.min(0, delta)));
          if (delta < -28) setExpanded(true);
        }}
        onPointerUp={() => {
          dragStart.current = null;
          setDragOffset(null);
        }}
        className="mx-auto flex h-[18px] w-full max-w-[120px] items-center justify-center"
      >
        <span
          aria-hidden="true"
          className="h-1 w-10 rounded-full bg-white/20"
          style={{ marginTop: Math.max(0, COLLAPSED_TAB - 28) / 6 }}
        />
      </button>

      <div className="flex shrink-0 items-center gap-1 px-2.5 pb-1.5">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            className={cn(
              "h-8 rounded-full px-3 text-[12px] font-semibold transition-colors",
              tab === entry.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={tab === entry.id}
          >
            {entry.label}
          </button>
        ))}
        <span className="ml-auto text-[10.5px] tabular-nums text-muted-foreground">
          {String(active.length).padStart(2, "0")}
        </span>
      </div>

      <div
        className="rizz-library__grid min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2"
        style={{ maxHeight: expanded ? "none" : undefined }}
      >
        <button
          type="button"
          className="rizz-tile rizz-tile--action"
          aria-label="Take a photo or video"
          onClick={onCamera}
          disabled={disabled}
        >
          <Camera className="h-5 w-5" aria-hidden="true" />
          <span>Camera</span>
        </button>
        <button
          type="button"
          className="rizz-tile rizz-tile--action"
          aria-label="Upload from device"
          onClick={() => fileInput.current?.click()}
          disabled={disabled}
        >
          <ImagePlus className="h-5 w-5" aria-hidden="true" />
          <span>Upload</span>
        </button>

        {active.map((item) => {
          const index = selected.indexOf(item.url);
          return (
            <button
              key={item.id}
              type="button"
              className={cn("rizz-tile", index >= 0 && "is-selected")}
              onClick={() => toggle(item)}
              onPointerDown={() => startPress(item)}
              onPointerUp={endPress}
              onPointerLeave={endPress}
              aria-pressed={index >= 0}
              aria-label={`Media ${item.url}`}
            >
              {item.thumb || item.kind === "image" ? (
                <img src={item.thumb || item.url} alt="" loading="lazy" decoding="async" />
              ) : (
                <video src={item.url} muted playsInline preload="metadata" />
              )}
              {index >= 0 && (
                <span className="rizz-tile__badge" aria-hidden="true">
                  {index + 1}
                </span>
              )}
            </button>
          );
        })}

        {active.length === 0 && !loading && (
          <p className="col-span-4 px-2 py-6 text-center text-[12px] text-muted-foreground">
            {tab === "saved"
              ? "Nothing saved yet — long-press any photo to save it."
              : tab === "uploads"
                ? "Nothing uploaded in this session yet."
                : "No photos in this chat yet."}
          </p>
        )}
        {loading && (
          <p className="col-span-4 flex items-center justify-center gap-2 py-6 text-[12px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading library…
          </p>
        )}
      </div>

      {progress && (
        <p className="px-3 pb-1 text-[11px] text-muted-foreground">{progressLabel}</p>
      )}
      {failure && (
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="mx-2 mb-1 flex items-center justify-between gap-2 rounded-[10px] border border-red-400/30 bg-red-500/10 px-3 py-2 text-[11.5px] text-red-200"
        >
          <span className="truncate">{failure}</span>
          {(() => {
            const retry = { label: "Retry" };
            return (
              <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 font-semibold">
                {retry.label}
              </span>
            );
          })()}
        </button>
      )}

      <div className="flex shrink-0 items-center gap-1.5 border-t border-border px-2.5 py-1.5">
        <ActionPill label="Photo" onClick={onPhotos} disabled={disabled} />
        {onPoll && <ActionPill label="Poll" onClick={onPoll} disabled={disabled} />}
        {onSchedule && (
          <ActionPill label="Schedule" onClick={onSchedule} disabled={disabled || scheduleDisabled} />
        )}
        <ActionPill label="Files" onClick={onFiles} disabled={disabled} />
        {selected.length > 0 && (
          <button
            type="button"
            onClick={addSelected}
            className="ml-auto flex h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-[12px] font-bold text-primary-foreground"
          >
            <Check className="h-4 w-4" aria-hidden="true" /> Add {selected.length}
          </button>
        )}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void handleFiles(files);
        }}
      />

      {preview && (
        <div
          className="rizz-preview"
          role="dialog"
          aria-modal="true"
          aria-label="Media preview"
          onClick={() => setPreview(null)}
        >
          {preview.kind === "image" ? (
            <img src={preview.url} alt="" />
          ) : (
            <video src={preview.url} controls autoPlay playsInline muted />
          )}
          <div className="rizz-preview__bar" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setPreview(null)} aria-label="Close preview">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            {saved.some((item) => item.url === preview.url) ? (
              <button
                type="button"
                onClick={() => {
                  setSaved(removeLibraryItem(preview.url));
                  setPreview(null);
                }}
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" /> Unsave
              </button>
            ) : (
              <button type="button" onClick={savePreview}>
                <Download className="h-4 w-4" aria-hidden="true" /> Save
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionPill({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-9 rounded-full border border-white/12 px-3 text-[11.5px] font-semibold text-foreground disabled:opacity-40"
    >
      {label}
    </button>
  );
}
