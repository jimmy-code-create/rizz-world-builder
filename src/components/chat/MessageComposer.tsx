/**
 * The composer — the one message row, used by DMs, group chats, realm channels
 * and the voice-chat text chat.
 *
 * Layout is fixed on purpose, so the four places cannot drift:
 *
 *   [ Attach 44 ] [ field: emoji 36 · input · grows to 5 lines ] [ Sticker 44 ] [ Mic/ Send 44 ]
 *
 * 8px gaps, 8px 12px padding plus the safe-area inset, everything bottom-aligned
 * so a five-line message rises upward instead of pushing the buttons around.
 *
 * What the row owns:
 *  - the panel state machine (`panels.ts`): keyboard, attach, emoji, stickers —
 *    one at a time, the OS keyboard hidden while one is up, and the panel area
 *    sized to the last keyboard height so the row does not jump;
 *  - drafts (`drafts.ts`) when a `draftId` is given;
 *  - the mic → send swap, the slow-mode countdown, and the read-only reason;
 *  - voice notes: hold to record, slide left to cancel, slide up to lock.
 *
 * What it does not own: sending, uploading and the panels' contents. Screens
 * pass `renderPanel` and get a panel slot back, which is how the same row serves
 * a DM, a channel with emoji and a call with slash commands.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { ArrowUp, Mic, Smile, Sticker, Keyboard, Lock, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ComposerInput, type ComposerInputHandle } from "@/components/chat/ComposerInput";
import type { EmojiTokenParts } from "@/lib/emoji-token";
import {
  backShouldClosePanel,
  emojiTriggerShowsKeyboard,
  nextPanel,
  panelHeight,
  type ComposerPanel,
  type ComposerSheetPanel,
} from "@/features/composer/panels";
import { clearDraft, queueDraft, readDraft } from "@/features/composer/drafts";

export type ComposerReply = {
  mode?: "reply" | "edit";
  /** "Replying to Mina" / "Editing message". */
  label: string;
  /** One line of the thing being replied to or edited. */
  preview: string;
  onCancel: () => void;
  onJump?: () => void;
};

export type ComposerChatType = "dm" | "group" | "realm" | "voice";

/** Five text lines, then the field scrolls instead of growing. */
const MAX_INPUT_HEIGHT = 112;
const SLIDE_CANCEL_PX = 70;
const SLIDE_LOCK_PX = 60;
/** Tapping the field keeps the keyboard up; the row never collapses under it. */
const CONTROL = 44;

function vibrate(ms: number) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  navigator.vibrate(ms);
}

/** The last real keyboard height, so a panel can stand in exactly its place. */
function useKeyboardHeight() {
  const [height, setHeight] = useState(300);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let last = 0;
    const onResize = () => {
      const shrink = Math.round(window.innerHeight - viewport.height);
      if (shrink > 120) last = shrink;
      if (last) setHeight(Math.min(Math.max(last, 280), Math.round(window.innerHeight * 0.5)));
    };
    viewport.addEventListener("resize", onResize);
    return () => viewport.removeEventListener("resize", onResize);
  }, []);
  return height;
}

/** Phones keep Enter as a newline; this is only for the mount default. */
export function MessageComposer({
  value,
  onChange,
  onSend,
  onEmoji,
  onStickers,
  attach,
  onAttach,
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
  recordDenied = false,
  canSend,
  allowVoice = true,
  onKeyUp,
  onKeyDown,
  onTextareaClick,
  onPaste,
  onPasteFiles,
  onFocus,
  onBlur,
  chatType = "dm",
  draftId,
  slowModeSeconds,
  renderPanel,
  onPanelChange,
}: {
  value: string;
  onChange: (next: string, caret: number) => void;
  onSend: () => void;
  onEmoji?: () => void;
  onStickers?: () => void;
  /** A screen-owned attach disc. Replaced by the built-in one when omitted. */
  attach?: ReactNode;
  onAttach?: () => void;
  above?: ReactNode;
  mentions?: ReactNode;
  overlay?: ReactNode;
  reply?: ComposerReply | null;
  disabled?: boolean;
  /** Why the composer is closed, e.g. "Only owner and mods can send here". */
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
  /** The mic was refused: shown as a note inside the row. */
  recordDenied?: boolean;
  canSend?: boolean;
  allowVoice?: boolean;
  onKeyUp?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onTextareaClick?: () => void;
  onPaste?: (event: React.ClipboardEvent<Element>) => void;
  onPasteFiles?: (files: File[]) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Which context this row is in: affects labels only, never layout. */
  chatType?: ComposerChatType;
  /** Enables drafts: one per conversation, restored on open, cleared on send. */
  draftId?: string;
  /** Seconds left in slow mode, if any. */
  slowModeSeconds?: number;
  /**
   * Panel slot. Given this, the triggers open panels in place of the keyboard
   * (instead of calling onEmoji / onStickers, which stay for older screens).
   */
  renderPanel?: (panel: ComposerSheetPanel) => ReactNode;
  onPanelChange?: (panel: ComposerPanel) => void;
}) {
  const localRef = useRef<ComposerInputHandle | null>(null);
  const field = inputRef ?? localRef;
  const hadReply = useRef(false);
  const pressRef = useRef<{ x: number; y: number } | null>(null);
  const [sliding, setSliding] = useState(false);
  const [locking, setLocking] = useState(false);
  const [locked, setLocked] = useState(false);
  const [panel, setPanel] = useState<ComposerPanel>("none");
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === "undefined" ? 800 : window.innerHeight,
  );
  const keyboardHeight = useKeyboardHeight();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const hasText = value.trim().length > 0;
  const canSendNow = canSend ?? hasText;
  const slowLeft = Math.max(0, Math.round(slowModeSeconds ?? 0));

  const go = useCallback(
    (event: Parameters<typeof nextPanel>[1]) => {
      setPanel((current) => {
        const next = nextPanel(current, event);
        onPanelChange?.(next);
        return next;
      });
    },
    [onPanelChange],
  );

  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Android Back closes a panel before it leaves the screen: one history entry
  // is pushed when a panel opens, and the pop closes it.
  useEffect(() => {
    if (!panel || panel === "none" || panel === "keyboard") return;
    const onPop = () => {
      setPanel("none");
      onPanelChange?.("none");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [panel, onPanelChange]);

  // Drafts: restore once per conversation, save as you type, never on send.
  const draftIdRef = useRef(draftId);
  useEffect(() => {
    draftIdRef.current = draftId;
  }, [draftId]);
  useEffect(() => {
    if (!draftId) return;
    const saved = readDraft(draftId);
    if (saved && !value) onChange(saved, saved.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);
  useEffect(() => {
    if (!draftId) return;
    if (!value.trim()) {
      clearDraft(draftId);
      return;
    }
    queueDraft(draftId, value);
  }, [draftId, value]);

  // Auto-grow to five lines, then scroll.
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
      pressRef.current = { x: event.clientX, y: event.clientY };
      setSliding(false);
      setLocking(false);
      setLocked(false);
      vibrate(15);
      onRecordStart?.();
    },
    [disabled, sending, canRecord, canSendNow, onRecordStart],
  );

  const moveRecord = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const start = pressRef.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    setSliding(dx < -SLIDE_CANCEL_PX);
    // Slide up (and not sideways) to lock the recording hands-free.
    setLocking(dy < -SLIDE_LOCK_PX && Math.abs(dx) < SLIDE_CANCEL_PX);
  }, []);

  const finishRecord = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>, cancelled = false) => {
      const start = pressRef.current;
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      pressRef.current = null;
      const slid = dx < -SLIDE_CANCEL_PX;
      const lock = dy < -SLIDE_LOCK_PX && Math.abs(dx) < SLIDE_CANCEL_PX;
      setSliding(false);
      setLocking(false);
      if (cancelled || slid) {
        setLocked(false);
        onRecordCancel?.();
        return;
      }
      if (lock) {
        setLocked(true);
        vibrate(10);
        return;
      }
      onRecordEnd?.();
    },
    [onRecordCancel, onRecordEnd],
  );

  const submit = () => {
    if (disabled || !canSendNow) return;
    if (draftId) clearDraft(draftId);
    setLocked(false);
    onSend();
    field.current?.focus();
  };

  const openPanel = (which: ComposerSheetPanel) => {
    if (disabled) return;
    // The trigger's own callback is for screens that still own their sheets.
    const legacy = which === "emoji" ? onEmoji : which === "stickers" ? onStickers : undefined;
    if (!renderPanel && legacy) {
      legacy();
      return;
    }
    go({ type: "toggle", panel: which });
  };

  const panelSpace = useMemo(
    () => panelHeight(panel, keyboardHeight, viewportHeight),
    [panel, keyboardHeight, viewportHeight],
  );

  const showKeyboardIcon = emojiTriggerShowsKeyboard(panel);
  const isPanelOpen = backShouldClosePanel(panel) && panel !== "keyboard";
  const micActive = allowVoice && !canSendNow && !recording;

  return (
    <div
      className="composer-bar relative z-20 shrink-0 px-3 pt-2"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)" }}
    >
      <div className="mx-auto w-full max-w-3xl">
        {above}

        {reply ? (
          <div className="chat-reply-strip mb-2 flex h-9 items-stretch overflow-hidden rounded-lg border border-[#2a2a2e] bg-[#141416]">
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
              <span className="truncate text-[11px] leading-tight text-[#9a9aa0]">{reply.preview}</span>
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                reply.onCancel();
                field.current?.focus();
              }}
              aria-label="Cancel reply"
              className="grid w-11 shrink-0 place-items-center text-[#9a9aa0] transition-colors hover:text-[#f2efe6]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {/* The panel slot: exactly the keyboard's height, so nothing jumps. */}
        {panelSpace !== null && renderPanel ? (
          <div
            ref={panelRef}
            className="mb-2 overflow-y-auto overscroll-contain rounded-2xl border border-[#2a2a2e] bg-[#141416]"
            style={{ height: panelSpace }}
            role="dialog"
            aria-label={
              panel === "emoji" ? "Emoji" : panel === "stickers" ? "Stickers and GIFs" : "Attach"
            }
          >
            {renderPanel(panel as ComposerSheetPanel)}
          </div>
        ) : null}

        {recordDenied ? (
          <p className="mb-2 rounded-lg border border-[#2a2a2e] bg-[#141416] px-3 py-2 text-[11.5px] leading-snug text-[#9a9aa0]">
            Microphone access is off. Allow it in your browser site settings, then hold the mic again.
          </p>
        ) : null}

        {disabled ? (
          // Read-only: one line, the reason, no panels. Not a dead field with no
          // explanation, which is what "you can't post here" used to look like.
          <div className="flex min-h-11 items-center gap-2 rounded-[22px] border border-[#2a2a2e] bg-[#1c1c1f] px-3">
            <Lock className="h-4 w-4 shrink-0 text-[#9a9aa0]" aria-hidden="true" />
            <p className="truncate text-[13px] text-[#9a9aa0]">{disabledHint}</p>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            {attach ?? (
              <button
                type="button"
                onClick={() => (onAttach ? onAttach() : openPanel("attach"))}
                aria-label="Attach"
                aria-expanded={panel === "attach"}
                style={{ width: CONTROL, height: CONTROL }}
                className={cn(
                  "grid shrink-0 place-items-center rounded-full border transition-colors",
                  panel === "attach"
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-[#2a2a2e] bg-[#141416] text-[#9a9aa0] hover:bg-[#1c1c1f] hover:text-[#f2efe6]",
                )}
              >
                <span className="text-[20px] leading-none">+</span>
              </button>
            )}

            <div
              className={cn(
                "flex min-w-0 flex-1 items-end rounded-[22px] border bg-[#141416] transition-colors duration-150 motion-reduce:transition-none",
                panel === "keyboard"
                  ? "border-[#2a2a2e]"
                  : "border-[#2a2a2e] focus-within:border-[#3a3a40]",
              )}
              style={{ minHeight: CONTROL }}
            >
              {recording ? (
                <div className="flex h-11 w-full items-center gap-2.5 px-3" aria-live="polite">
                  <span className="composer-record-dot h-2.5 w-2.5 shrink-0 rounded-full bg-[#ff5d68]" />
                  <span className="text-[13px] font-semibold tabular-nums text-[#f2efe6]">
                    {formatTimer(recordMs)}
                  </span>
                  <span
                    className={cn(
                      "ml-auto truncate text-[11px]",
                      sliding ? "font-bold text-[#ff8a91]" : "text-[#9a9aa0]",
                    )}
                  >
                    {locked
                      ? "Locked · tap stop to send"
                      : sliding
                        ? "Release to cancel"
                        : locking
                          ? "Release to lock"
                          : "Slide to cancel · up to lock"}
                  </span>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => openPanel("emoji")}
                    aria-label={showKeyboardIcon ? "Close emoji and show keyboard" : "Emoji"}
                    aria-expanded={panel === "emoji"}
                    className={cn(
                      "m-1 grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors",
                      panel === "emoji"
                        ? "bg-primary/15 text-primary"
                        : "text-[#9a9aa0] hover:bg-[#1c1c1f] hover:text-[#f2efe6]",
                    )}
                  >
                    {showKeyboardIcon ? (
                      <Keyboard className="h-5 w-5" strokeWidth={2} />
                    ) : (
                      <Smile className="h-5 w-5" strokeWidth={2} />
                    )}
                  </button>
                  <ComposerInput
                    ref={field}
                    value={value}
                    onChange={(next) => onChange(next, next.length)}
                    onKeyUp={onKeyUp}
                    onClick={() => {
                      go({ type: "focus-field" });
                      onTextareaClick?.();
                    }}
                    onPaste={(event) => onPaste?.(event)}
                    onPasteFiles={onPasteFiles}
                    onFocus={() => {
                      go({ type: "focus-field" });
                      onFocus?.();
                    }}
                    onBlur={() => {
                      go({ type: "blur-field" });
                      onBlur?.();
                    }}
                    onEnter={submit}
                    resolveEmoji={resolveEmoji}
                    onKeyDown={(event) => {
                      onKeyDown?.(event);
                      if (event.defaultPrevented) return;
                      if (event.key === "Escape" && isPanelOpen) {
                        event.preventDefault();
                        go({ type: "close" });
                      }
                    }}
                    placeholder={placeholder}
                    ariaLabel={`Message in ${chatType === "realm" ? "channel" : chatType === "voice" ? "voice chat" : "chat"}`}
                    maxLength={maxLength}
                    enterKeyHint="send"
                    className="text-[16px] leading-[22px]"
                    style={{ maxHeight: MAX_INPUT_HEIGHT }}
                  />
                </>
              )}
              {mentions}
              {overlay}
            </div>

            <button
              type="button"
              onClick={() => openPanel("stickers")}
              aria-label="Stickers and GIFs"
              aria-expanded={panel === "stickers"}
              style={{ width: CONTROL, height: CONTROL }}
              className={cn(
                "grid shrink-0 place-items-center rounded-full border transition-colors",
                panel === "stickers"
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-[#2a2a2e] bg-[#141416] text-[#9a9aa0] hover:bg-[#1c1c1f] hover:text-[#f2efe6]",
              )}
            >
              <Sticker className="h-5 w-5" strokeWidth={1.9} />
            </button>

            {micActive && !locked ? (
              <button
                type="button"
                onPointerDown={beginRecord}
                onPointerMove={moveRecord}
                onPointerUp={(event) => finishRecord(event)}
                onPointerCancel={(event) => finishRecord(event, true)}
                onLostPointerCapture={(event) => finishRecord(event, true)}
                onContextMenu={(event) => event.preventDefault()}
                disabled={sending || !canRecord}
                aria-label={recording ? "Release to send voice message" : "Record voice message"}
                aria-pressed={recording}
                style={{ width: CONTROL, height: CONTROL }}
                className={cn(
                  "grid shrink-0 touch-none place-items-center rounded-full bg-primary text-[#0b0b0c]",
                  "transition-transform duration-150 active:scale-[0.94] motion-reduce:transition-none",
                  "disabled:opacity-40",
                )}
              >
                <Mic className="h-[18px] w-[18px]" strokeWidth={2.5} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (locked) {
                    setLocked(false);
                    onRecordEnd?.();
                    return;
                  }
                  submit();
                }}
                disabled={!locked && (sending || !canSendNow || slowLeft > 0)}
                aria-label={
                  locked
                    ? "Stop and send voice message"
                    : sending
                      ? "Sending message"
                      : slowLeft > 0
                        ? `Slow mode, wait ${slowLeft}s`
                        : "Send"
                }
                style={{ width: CONTROL, height: CONTROL }}
                className={cn(
                  "grid shrink-0 place-items-center rounded-full bg-primary text-[#0b0b0c]",
                  "transition-transform duration-150 active:scale-[0.94] motion-reduce:transition-none",
                  "disabled:opacity-40",
                )}
              >
                {locked ? (
                  <Square className="h-[16px] w-[16px]" strokeWidth={2.6} fill="currentColor" />
                ) : slowLeft > 0 ? (
                  <span className="text-[12px] font-bold tabular-nums">{slowLeft}</span>
                ) : (
                  <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.6} />
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTimer(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default MessageComposer;
