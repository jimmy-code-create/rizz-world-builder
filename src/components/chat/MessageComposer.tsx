import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { ArrowUp, ImagePlus, Mic, Plus, Smile, Sticker, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ComposerInput, type ComposerInputHandle } from "@/components/chat/ComposerInput";
import type { EmojiTokenParts } from "@/lib/emoji-token";
import {
  ChatDockPanel,
  readLastChatPickerTab,
  writeLastChatPickerTab,
  type ChatPickerTab,
  type ChatPanelMode,
} from "@/components/chat/ChatDockPanel";

/**
 * The one chat composer used by DMs, groups and realm channels.
 *
 * The row is a plus, the input pill, the member's avatar and the voice/send
 * action. Emoji, GIFs, stickers and attachments open in a panel docked under
 * the row, in the same space the keyboard occupied — the transcript above
 * stays visible and scrollable instead of being covered by a dimmed sheet.
 */
export type ComposerReply = {
  mode?: "reply" | "edit";
  label: string;
  preview: string;
  onCancel: () => void;
  onJump?: () => void;
};

const MAX_INPUT_HEIGHT = 112;
const SLIDE_CANCEL_PX = 70;
const KEYBOARD_HEIGHT_KEY = "rizz:keyboard-height:v1";

function vibrate(ms: number) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  navigator.vibrate(ms);
}

function clampPanelHeight(value: number) {
  const viewport = window.visualViewport?.height ?? window.innerHeight;
  return Math.round(Math.min(viewport * 0.6, Math.max(280, value || viewport * 0.4)));
}

function readStoredKeyboardHeight() {
  try {
    const value = Number(localStorage.getItem(KEYBOARD_HEIGHT_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export type PendingComposerFile = {
  id?: string;
  name: string;
  size: number;
  preview?: string | null;
  /** 0–100 while uploading; omitted or 100 when ready. */
  progress?: number;
  status?: "uploading" | "ready" | "error";
  error?: string;
};

export type ChatComposerProps = {
  value: string;
  onChange: (next: string, caret: number) => void;
  onSend: () => void;
  /** Insert a unicode or realm emoji token at the caret. */
  onPickEmoji: (token: string) => void;
  /** A GIF or sticker was tapped: send it immediately. */
  onSendMarker: (marker: string) => void;
  onFilesSelected?: (files: File[]) => void;
  pendingFiles?: PendingComposerFile[];
  onRemovePendingFile?: (index: number) => void;
  avatarUrl?: string | null;
  scrollRef?: RefObject<HTMLDivElement | null>;
  recentPhotos?: { id: string; url: string }[];
  onPickRecentPhoto?: (url: string) => void;
  onManageEmoji?: () => void;
  onSchedule?: () => void;
  onPoll?: () => void;
  scheduleDisabled?: boolean;
  /** Legacy escape hatch; new callers let the composer draw its own plus. */
  attach?: ReactNode;
  above?: ReactNode;
  mentions?: ReactNode;
  overlay?: ReactNode;
  reply?: ComposerReply | null;
  disabled?: boolean;
  disabledHint?: string;
  placeholder?: string;
  maxLength?: number;
  inputRef?: RefObject<ComposerInputHandle | null>;
  resolveEmoji?: (parts: EmojiTokenParts) => string | null;
  sending?: boolean;
  recording?: boolean;
  recordMs?: number;
  onRecordStart?: () => void;
  onRecordEnd?: () => void;
  onRecordCancel?: () => void;
  canRecord?: boolean;
  canSend?: boolean;
  allowVoice?: boolean;
  onKeyUp?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onTextareaClick?: () => void;
  onPaste?: (event: React.ClipboardEvent<Element>) => void;
  onPasteFiles?: (files: File[]) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Kept for callers that still wire the old separate triggers. */
  onEmoji?: () => void;
  onStickers?: () => void;
};

export function ChatComposer({
  value,
  onChange,
  onSend,
  onPickEmoji,
  onSendMarker,
  onFilesSelected,
  pendingFiles = [],
  onRemovePendingFile,
  avatarUrl,
  scrollRef,
  recentPhotos = [],
  onPickRecentPhoto,
  onManageEmoji,
  onSchedule,
  onPoll,
  scheduleDisabled,
  attach,
  above,
  mentions,
  overlay,
  reply,
  disabled = false,
  disabledHint = "You can't send messages here",
  placeholder = "Message",
  maxLength,
  inputRef,
  resolveEmoji,
  sending = false,
  recording = false,
  recordMs = 0,
  onRecordStart,
  onRecordEnd,
  onRecordCancel,
  canRecord = true,
  canSend,
  allowVoice = true,
  onKeyUp,
  onKeyDown,
  onTextareaClick,
  onPaste,
  onPasteFiles,
  onFocus,
  onBlur,
  onEmoji,
  onStickers,
}: ChatComposerProps) {
  const localRef = useRef<ComposerInputHandle | null>(null);
  const field = inputRef ?? localRef;
  const hadReply = useRef(false);
  const pressRef = useRef<{ x: number } | null>(null);
  const [sliding, setSliding] = useState(false);
  const hasText = value.trim().length > 0;
  const canSendNow = canSend ?? hasText;

  const [panel, setPanel] = useState<ChatPanelMode | null>(null);
  const [renderedPanel, setRenderedPanel] = useState<ChatPanelMode | null>(null);
  const [pickerTab, setPickerTab] = useState<ChatPickerTab>(() => readLastChatPickerTab());
  const [panelHeight, setPanelHeight] = useState(0);
  const closeHistoryRef = useRef(false);
  const photosRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const filesRef = useRef<HTMLInputElement | null>(null);
  const wasNearBottomRef = useRef(true);

  // Track the keyboard by its height change. With interactive-widget=
  // resizes-content the layout viewport also shrinks, so the delta between two
  // visualViewport heights is the reliable number on Android Chrome.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let last = viewport.height;
    let lastWidth = viewport.width;
    const onResize = () => {
      const next = viewport.height;
      const nextWidth = viewport.width;
      const delta = last - next;
      // A rotation also changes the viewport height; only a height change at a
      // stable width is the keyboard.
      if (Math.abs(nextWidth - lastWidth) < 2 && delta > 120) {
        try {
          localStorage.setItem(KEYBOARD_HEIGHT_KEY, String(Math.round(delta)));
        } catch {
          // Storage is best effort.
        }
      }
      last = next;
      lastWidth = nextWidth;
    };
    viewport.addEventListener("resize", onResize);
    return () => viewport.removeEventListener("resize", onResize);
  }, []);

  // Keep the panel's content mounted for the length of the close animation:
  // collapsing an empty shell for 180ms looked like the panel vanished before
  // its box finished shrinking.
  useEffect(() => {
    if (panel) {
      setRenderedPanel(panel);
      return;
    }
    const timer = window.setTimeout(() => setRenderedPanel(null), 180);
    return () => window.clearTimeout(timer);
  }, [panel]);

  const pinBottom = useCallback(() => {
    const element = scrollRef?.current;
    if (!element || !wasNearBottomRef.current) return;
    element.scrollTop = element.scrollHeight;
  }, [scrollRef]);

  const rememberBottom = useCallback(() => {
    const element = scrollRef?.current;
    if (!element) return;
    wasNearBottomRef.current =
      element.scrollTop + element.clientHeight >= element.scrollHeight - 120;
  }, [scrollRef]);

  useLayoutEffect(() => {
    if (!panel) return;
    const frame = requestAnimationFrame(() => pinBottom());
    return () => cancelAnimationFrame(frame);
  }, [panel, panelHeight, pinBottom]);

  // The transcript's height animates while the dock opens, so one rAF is not
  // enough to hold it at the bottom: the tallest scroll offset keeps growing
  // for the whole 180ms. Observe the scroller and pin on every frame it resizes.
  useEffect(() => {
    if (!panel) return;
    const element = scrollRef?.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (wasNearBottomRef.current) element.scrollTop = element.scrollHeight;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [panel, scrollRef]);

  // Rotation and browser chrome both change the viewport while the panel is
  // open; keep its height inside the new bounds and hold the transcript at the
  // bottom if that is where the reader was.
  useEffect(() => {
    if (!panel) return;
    let frame = 0;
    const onResize = () => {
      setPanelHeight(clampPanelHeight(readStoredKeyboardHeight()));
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        pinBottom();
      });
    };
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, [panel, pinBottom]);

  const closePanel = useCallback(
    (restoreFocus = false) => {
      if (!panel) return;
      rememberBottom();
      setPanel(null);
      requestAnimationFrame(() => pinBottom());
      if (closeHistoryRef.current) {
        closeHistoryRef.current = false;
        try {
          window.history.back();
        } catch {
          // No history entry; nothing to unwind.
        }
      }
      if (restoreFocus) requestAnimationFrame(() => field.current?.focus());
    },
    [field, panel, pinBottom, rememberBottom],
  );

  const openPanel = useCallback(
    (mode: ChatPanelMode, tab?: ChatPickerTab) => {
      if (disabled) return;
      rememberBottom();
      if (tab) {
        setPickerTab(tab);
        writeLastChatPickerTab(tab);
      }
      if (panel === mode) {
        // Avatar asks for Stickers while the picker is on another tab: switch
        // tabs instead of closing. Pressing the same trigger twice closes.
        if (mode === "picker" && tab && tab !== pickerTab) {
          setPickerTab(tab);
          writeLastChatPickerTab(tab);
          return;
        }
        closePanel();
        return;
      }
      setPanel(mode);
      const height = clampPanelHeight(readStoredKeyboardHeight());
      setPanelHeight(height);
      field.current?.blur();
      if (!closeHistoryRef.current) {
        closeHistoryRef.current = true;
        try {
          window.history.pushState({ rizzChatPanel: true }, "");
        } catch {
          // In-app WebViews can refuse history changes.
        }
      }
    },
    [closePanel, disabled, field, panel, pickerTab, rememberBottom],
  );

  const changeTab = useCallback((tab: ChatPickerTab) => {
    setPickerTab(tab);
    writeLastChatPickerTab(tab);
  }, []);

  useEffect(() => {
    if (!panel) return;
    const onKeyDownWindow = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closePanel(true);
    };
    const onPopState = () => {
      closeHistoryRef.current = false;
      rememberBottom();
      setPanel(null);
      requestAnimationFrame(() => pinBottom());
    };
    window.addEventListener("keydown", onKeyDownWindow);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("keydown", onKeyDownWindow);
      window.removeEventListener("popstate", onPopState);
    };
  }, [closePanel, panel, pinBottom, rememberBottom]);

  useEffect(() => {
    const node = field.current?.element();
    if (!node) return;
    node.style.height = "auto";
    const next = Math.min(node.scrollHeight, MAX_INPUT_HEIGHT);
    node.style.height = `${next}px`;
    node.style.overflowY = node.scrollHeight > MAX_INPUT_HEIGHT ? "auto" : "hidden";
  }, [value, field]);

  useEffect(() => {
    if (reply && !hadReply.current) {
      requestAnimationFrame(() => field.current?.focus());
    }
    hadReply.current = !!reply;
  }, [reply, field]);

  const beginRecord = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled || sending || !canRecord || canSendNow) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      pressRef.current = { x: event.clientX };
      setSliding(false);
      vibrate(15);
      onRecordStart?.();
    },
    [disabled, sending, canRecord, canSendNow, onRecordStart],
  );

  const moveRecord = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!pressRef.current) return;
    setSliding(event.clientX - pressRef.current.x < -SLIDE_CANCEL_PX);
  }, []);

  const finishRecord = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>, cancelled = false) => {
      const start = pressRef.current;
      if (!start) return;
      pressRef.current = null;
      const slid = event.clientX - start.x < -SLIDE_CANCEL_PX;
      setSliding(false);
      if (cancelled || slid) onRecordCancel?.();
      else onRecordEnd?.();
    },
    [onRecordCancel, onRecordEnd],
  );

  const submit = () => {
    if (disabled || !canSendNow) return;
    onSend();
    field.current?.focus();
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (files.length) onFilesSelected?.(files);
  };

  const openAttach = () => openPanel("attach");

  return (
    <div
      className={cn(
        // The shared glass bar from the native shell, plus the docked panel
        // below it. The bar keeps the safe-area padding only when the panel is
        // closed; the panel draws its own bottom inset.
        "composer-bar relative z-20 flex shrink-0 flex-col",
        panel ? "pb-0" : "pb-[max(env(safe-area-inset-bottom,0px),0.375rem)]",
      )}
      data-chat-panel={panel ?? "closed"}
    >
      <input
        ref={photosRef}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={handleFileInput}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={handleFileInput}
      />
      <input ref={filesRef} type="file" multiple hidden onChange={handleFileInput} />

      <div className="mx-auto w-full max-w-3xl px-2.5 pt-1.5">
        {pendingFiles.length ? (
          <div className="mb-1.5 flex gap-1.5 overflow-x-auto pb-0.5">
            {pendingFiles.map((file, index) => (
              <div key={`${file.name}-${index}`} className="chat-pending-file">
                {file.preview ? (
                  <img src={file.preview} alt="" />
                ) : (
                  <span className="chat-pending-file__icon">
                    <ImagePlus className="h-4 w-4" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-semibold text-foreground">
                    {file.name}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    {file.status === "error"
                      ? (file.error ?? "Upload failed")
                      : file.status === "uploading" || (file.progress ?? 100) < 100
                        ? `Uploading… ${file.progress ?? 0}%`
                        : formatBytes(file.size)}
                  </span>
                  {(file.status === "uploading" || (file.progress ?? 100) < 100) &&
                  file.status !== "error" ? (
                    <span className="chat-pending-file__bar" aria-hidden="true">
                      <span style={{ width: `${Math.max(3, file.progress ?? 0)}%` }} />
                    </span>
                  ) : null}
                </span>
                {onRemovePendingFile ? (
                  <button
                    type="button"
                    onClick={() => onRemovePendingFile(index)}
                    className="chat-pending-file__remove"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {above}

        {reply ? (
          <div className="chat-reply-strip mb-1.5 flex h-9 items-stretch overflow-hidden rounded-lg border border-border bg-card">
            <span className="w-[3px] shrink-0 bg-primary" aria-hidden="true" />
            <button
              type="button"
              onClick={reply.onJump}
              disabled={!reply.onJump}
              className="flex min-w-0 flex-1 flex-col justify-center px-2 text-left disabled:cursor-default"
            >
              <span className="truncate text-[10px] font-bold uppercase tracking-[0.1em] text-primary">
                {reply.label}
              </span>
              <span className="truncate text-[11px] leading-tight text-muted-foreground">
                {reply.preview}
              </span>
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                reply.onCancel();
                field.current?.focus();
              }}
              aria-label="Cancel reply"
              className="grid w-10 shrink-0 place-items-center text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <div className="flex items-center gap-1.5">
          {attach ?? (
            <button
              type="button"
              onClick={() => openPanel("attach")}
              disabled={disabled}
              aria-label="Attach a photo or file"
              title="Attach"
              aria-expanded={panel === "attach"}
              className={cn(
                "chat-composer-disc grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-secondary text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-40",
                panel === "attach" && "border-primary/60 text-primary",
              )}
            >
              <Plus
                className={cn(
                  "h-[18px] w-[18px] transition-transform duration-200 motion-reduce:transition-none",
                  panel === "attach" && "rotate-45",
                )}
                strokeWidth={2}
                strokeLinecap="round"
              />
            </button>
          )}

          <div
            className={cn(
              "relative flex min-w-0 flex-1 items-center rounded-[20px] border transition-colors duration-150",
              "motion-reduce:transition-none",
              disabled
                ? "border-border bg-muted"
                : "border-border bg-card focus-within:border-foreground/25",
            )}
            style={{ minHeight: 40 }}
          >
            {recording ? (
              <div className="flex h-10 w-full items-center gap-2.5 px-2.5" aria-live="polite">
                <span className="composer-record-dot h-2.5 w-2.5 shrink-0 rounded-full bg-[#ff5d68]" />
                <span className="text-[13px] font-semibold tabular-nums text-foreground">
                  {formatTimer(recordMs)}
                </span>
                <span
                  className={cn(
                    "ml-auto truncate text-[11px]",
                    sliding ? "font-bold text-[#ff8a91]" : "text-muted-foreground",
                  )}
                >
                  {sliding ? "Release to cancel" : "Slide to cancel"}
                </span>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onEmoji?.();
                    // The emoji button always lands on emoji, whatever was open last.
                    openPanel("picker", "emoji");
                  }}
                  disabled={disabled}
                  aria-label="Emoji, GIFs and stickers"
                  title="Emoji, GIFs and stickers"
                  aria-expanded={panel === "picker"}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-primary transition-opacity disabled:opacity-40"
                >
                  <Smile className="h-5 w-5" strokeWidth={2} />
                </button>
                <ComposerInput
                  ref={field}
                  value={value}
                  onChange={(next, nextCaret) => onChange(next, nextCaret)}
                  disabled={disabled}
                  onKeyUp={onKeyUp}
                  onClick={() => {
                    closePanel();
                    onTextareaClick?.();
                  }}
                  onPaste={(event) => onPaste?.(event)}
                  onPasteFiles={onPasteFiles}
                  onFocus={() => {
                    closePanel();
                    onFocus?.();
                  }}
                  onBlur={onBlur}
                  onEnter={submit}
                  resolveEmoji={resolveEmoji}
                  onKeyDown={(event) => {
                    onKeyDown?.(event);
                    if (event.defaultPrevented) return;
                  }}
                  placeholder={disabled ? disabledHint : placeholder?.trim() || "Message"}
                  ariaLabel={placeholder?.trim() || "Message"}
                  maxLength={maxLength}
                  enterKeyHint="send"
                  className={disabled ? "text-muted-foreground" : "text-foreground"}
                  style={{ maxHeight: MAX_INPUT_HEIGHT }}
                />
              </>
            )}
            {mentions}
            {overlay}
          </div>

          <button
            type="button"
            onClick={() => {
              onStickers?.();
              openPanel("picker", "stickers");
            }}
            disabled={disabled}
            aria-label="Stickers and GIFs"
            title="Stickers and GIFs"
            aria-expanded={panel === "picker"}
            className={cn(
              "chat-composer-avatar shrink-0 rounded-full text-primary",
              panel === "picker" && "chat-composer-avatar--active",
            )}
          >
            {/* The dock's own mark, not the member's face: this opens art, not identity. */}
            <Sticker className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>

          {(!allowVoice || canSendNow) && !recording ? (
            <button
              type="button"
              onClick={submit}
              disabled={disabled || sending || !canSendNow}
              aria-label={sending ? "Sending message" : "Send"}
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground",
                "transition-transform duration-150 active:scale-[0.94] motion-reduce:transition-none",
                "disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              )}
            >
              <span className="composer-action-swap grid place-items-center">
                <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.6} />
              </span>
            </button>
          ) : (
            <button
              type="button"
              onPointerDown={beginRecord}
              onPointerMove={moveRecord}
              onPointerUp={(event) => finishRecord(event)}
              onPointerCancel={(event) => finishRecord(event, true)}
              onLostPointerCapture={(event) => finishRecord(event, true)}
              onContextMenu={(event) => event.preventDefault()}
              disabled={disabled || sending || !canRecord}
              aria-label={recording ? "Release to send voice message" : "Voice message"}
              aria-pressed={recording}
              className={cn(
                "grid shrink-0 touch-none place-items-center rounded-full bg-primary text-primary-foreground",
                "transition-[width,height,transform] duration-150 active:scale-[0.94] motion-reduce:transition-none",
                "disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                recording ? "h-12 w-12" : "h-10 w-10",
              )}
            >
              <Mic className={recording ? "h-5 w-5" : "h-[18px] w-[18px]"} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      <div
        className={cn(
          "chat-dock-shell shrink-0 overflow-hidden max-h-[38dvh] transition-[height] duration-[180ms] ease-out motion-reduce:transition-none",
          panel ? "border-t border-border bg-background" : "border-t-0",
        )}
        style={{ height: panel ? panelHeight : 0, pointerEvents: panel ? "auto" : "none" }}
        aria-hidden={!panel}
      >
        {renderedPanel ? (
          <ChatDockPanel
            mode={renderedPanel}
            tab={pickerTab}
            onTabChange={changeTab}
            disabled={disabled}
            onPickEmoji={onPickEmoji}
            onSendMarker={onSendMarker}
            onManageEmoji={onManageEmoji}
            recentPhotos={recentPhotos}
            onPickRecentPhoto={onPickRecentPhoto}
            onPhotos={() => photosRef.current?.click()}
            onCamera={() => cameraRef.current?.click()}
            onFiles={() => filesRef.current?.click()}
            onSchedule={
              onSchedule
                ? () => {
                    closePanel();
                    onSchedule();
                  }
                : undefined
            }
            onPoll={
              onPoll
                ? () => {
                    closePanel();
                    onPoll();
                  }
                : undefined
            }
            scheduleDisabled={scheduleDisabled}
          />
        ) : null}
      </div>
    </div>
  );
}

function formatTimer(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

/** Backwards-compatible name while screens migrate to the shared component. */
export const MessageComposer = ChatComposer;

export default ChatComposer;
