import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ArrowUp, Cat, Mic, Smile, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ComposerInput, type ComposerInputHandle } from "@/components/chat/ComposerInput";
import type { EmojiTokenParts } from "@/lib/emoji-token";

/**
 * The chat composer, in one row.
 *
 * DM and group chat share this component so the two can never drift: a 40px
 * attach disc, a 40px-tall pill holding the emoji trigger, the textarea and
 * the cat trigger, and a 40px lime action disc that is a mic when the box is
 * empty and an arrow when there is something to send. The row owns its own
 * solid bar so screens never stack a second `chat-bar` behind it.
 *
 * Everything the composer needs to know about the world arrives as props, which
 * is why the pickers, the attach sheet and the mention popup stay owned by the
 * screen: the composer only draws the row and owns the input's own state
 * (height, focus ring, the mic slide).
 */
export type ComposerReply = {
  mode?: "reply" | "edit";
  /** "Replying to Mina" / "Editing message". */
  label: string;
  /** One line of the thing being replied to or edited. */
  preview: string;
  onCancel: () => void;
  onJump?: () => void;
};

/** Five text lines, then the textarea scrolls instead of growing. */
const MAX_INPUT_HEIGHT = 112;
const SLIDE_CANCEL_PX = 70;

function vibrate(ms: number) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  navigator.vibrate(ms);
}

export function MessageComposer({
  value,
  onChange,
  onSend,
  onEmoji,
  onStickers,
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
  /** Whether there is something to send (text *or* an attachment). */
  canSend,
  /** Groups have no voice notes yet: the action stays a send arrow. */
  allowVoice = true,
  onKeyUp,
  onKeyDown,
  onTextareaClick,
  onPaste,
  onPasteFiles,
  onFocus,
  onBlur,
}: {
  value: string;
  /** The caret is passed along, because the mention popup keys off it. */
  onChange: (next: string, caret: number) => void;
  onSend: () => void;
  onEmoji: () => void;
  onStickers: () => void;
  /** The screen's own ChatAttachButton, already styled as a 44px circle. */
  attach: ReactNode;
  /** A photo preview, an upload progress strip: anything above the row. */
  above?: ReactNode;
  /** The mention popup, rendered inside the pill's positioning context. */
  mentions?: ReactNode;
  /** Anything else that anchors above the field, e.g. the realm slash menu. */
  overlay?: ReactNode;
  reply?: ComposerReply | null;
  disabled?: boolean;
  /** Why the composer is closed: shown in place of the placeholder. */
  disabledHint?: string;
  placeholder?: string;
  maxLength?: number;
  /**
   * The field itself. It is a contenteditable div (see ComposerInput) so a
   * custom emoji can be drawn inline instead of pasting its token as text.
   */
  inputRef?: RefObject<ComposerInputHandle | null>;
  /**
   * Draws an emoji `data-token` as a picture. The screen owns this because it
   * may know about a just-uploaded emoji the shared list has not seen yet.
   */
  resolveEmoji?: (parts: EmojiTokenParts) => string | null;
  sending?: boolean;
  recording?: boolean;
  recordMs?: number;
  onRecordStart?: () => void;
  /** Released without sliding: send the clip. */
  onRecordEnd?: () => void;
  /** Slid past the cancel threshold: throw the clip away. */
  onRecordCancel?: () => void;
  canRecord?: boolean;
  canSend?: boolean;
  allowVoice?: boolean;
  onKeyUp?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  /** Runs before the composer's own Enter-to-send, for slash menus and the like. */
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onTextareaClick?: () => void;
  /** Image paste, kept exactly as it was (the screen uploads the file). */
  onPaste?: (event: React.ClipboardEvent<Element>) => void;
  onPasteFiles?: (files: File[]) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const localRef = useRef<ComposerInputHandle | null>(null);
  const field = inputRef ?? localRef;
  const hadReply = useRef(false);
  const pressRef = useRef<{ x: number } | null>(null);
  const [sliding, setSliding] = useState(false);
  const hasText = value.trim().length > 0;
  // A photo with no caption is still sendable, so the screen decides whether
  // the action is a send arrow; text alone is the default.
  const canSendNow = canSend ?? hasText;

  // Auto-grow to five lines, then scroll. `height:auto` first is what lets the
  // box shrink again after a deletion. The contenteditable measures the same
  // way a textarea did.
  useEffect(() => {
    const node = field.current?.element();
    if (!node) return;
    node.style.height = "auto";
    const next = Math.min(node.scrollHeight, MAX_INPUT_HEIGHT);
    node.style.height = `${next}px`;
    node.style.overflowY = node.scrollHeight > MAX_INPUT_HEIGHT ? "auto" : "hidden";
  }, [value, field]);

  // Entering reply/edit mode is a user intent to type, so the keyboard should
  // already be up. The ref keeps unrelated composer renders from stealing focus.
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
    // The keyboard must stay up after a send; the screen also refocuses, this
    // covers the browser that blurs the field when the button is pressed.
    field.current?.focus();
  };

  return (
    <div
      className={cn(
        // Solid, not blurred: one opaque bar is cheaper to composite on a phone
        // than a stack of translucent bars, and it cannot double up with a
        // screen's own wrapper.
        "relative z-20 shrink-0 border-t border-[#1c1c1c] bg-[#0a0a0a] px-2.5 pt-1.5",
        "pb-[max(env(safe-area-inset-bottom,0px),0.375rem)]",
      )}
    >
      <div className="mx-auto w-full max-w-3xl">
        {above}

        {reply ? (
          // 40px strip: a lime bar, the target of the reply, and one line of
          // the message. The whole middle is a jump link on replies.
          <div className="chat-reply-strip mb-1.5 flex h-9 items-stretch overflow-hidden rounded-lg border border-white/10 bg-[#0f0f0f]">
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
              <span className="truncate text-[11px] leading-tight text-[#bdbdbd]">
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
              className="grid w-10 shrink-0 place-items-center text-[#8f8f8f] transition-colors hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <div className="flex items-center gap-1.5">
          {attach}

          {/* The pill: 40px minimum, 20px radius. Focus is the caret plus a
              quiet neutral border — no lime box around the field. */}
          <div
            className={cn(
              "relative flex min-w-0 flex-1 items-center rounded-[20px] border transition-colors duration-150",
              "motion-reduce:transition-none",
              disabled
                ? "border-white/[0.08] bg-[#0d0d0d]"
                : "border-white/[0.14] bg-[#121212] focus-within:border-white/25",
            )}
            style={{ minHeight: 40 }}
          >
            {recording ? (
              <div className="flex h-10 w-full items-center gap-2.5 px-2.5" aria-live="polite">
                <span className="composer-record-dot h-2.5 w-2.5 shrink-0 rounded-full bg-[#ff5d68]" />
                <span className="text-[13px] font-semibold tabular-nums text-[#f2f2f2]">
                  {formatTimer(recordMs)}
                </span>
                <span
                  className={cn(
                    "ml-auto truncate text-[11px]",
                    sliding ? "font-bold text-[#ff8a91]" : "text-[#8c8c8c]",
                  )}
                >
                  {sliding ? "Release to cancel" : "Slide to cancel"}
                </span>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onEmoji}
                  disabled={disabled}
                  aria-label="Emoji, GIFs and stickers"
                  title="Emoji, GIFs and stickers"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-primary transition-opacity disabled:opacity-40"
                >
                  <Smile className="h-5 w-5" strokeWidth={2} />
                </button>
                <ComposerInput
                  ref={field}
                  value={value}
                  onChange={(next) => onChange(next, next.length)}
                  disabled={disabled}
                  onKeyUp={onKeyUp}
                  onClick={() => onTextareaClick?.()}
                  onPaste={(event) => onPaste?.(event)}
                  onPasteFiles={onPasteFiles}
                  onFocus={onFocus}
                  onBlur={onBlur}
                  onEnter={submit}
                  resolveEmoji={resolveEmoji}
                  onKeyDown={(event) => {
                    onKeyDown?.(event);
                    if (event.defaultPrevented) return;
                    // Enter-to-send lives inside ComposerInput: it knows about
                    // IME composition and phone keyboards. Slash menus still
                    // see the key first, through the handler above.
                  }}
                  placeholder={disabled ? disabledHint : placeholder}
                  ariaLabel={placeholder}
                  maxLength={maxLength}
                  enterKeyHint="send"
                  className={disabled ? "text-[#6f6f6f]" : undefined}
                  style={{ maxHeight: MAX_INPUT_HEIGHT }}
                />
                <button
                  type="button"
                  onClick={onStickers}
                  disabled={disabled}
                  aria-label="Cat emojis"
                  title="Cat emojis"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#8f8f8f] transition-colors hover:text-primary disabled:opacity-40"
                >
                  <Cat className="h-5 w-5" strokeWidth={1.8} />
                </button>
              </>
            )}
            {mentions}
            {overlay}
          </div>

          {(!allowVoice || canSendNow) && !recording ? (
            <button
              type="button"
              onClick={submit}
              disabled={disabled || sending || !canSendNow}
              aria-label={sending ? "Sending message" : "Send"}
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-[#0b0b0b]",
                "transition-transform duration-150 active:scale-[0.94] motion-reduce:transition-none",
                "disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              )}
            >
              <span
                key={canSendNow ? "send" : "idle"}
                className="composer-action-swap grid place-items-center"
              >
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
                "grid shrink-0 touch-none place-items-center rounded-full bg-primary text-[#0b0b0b]",
                "transition-[width,height,transform] duration-150 active:scale-[0.94] motion-reduce:transition-none",
                "disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                recording ? "h-12 w-12" : "h-10 w-10",
              )}
            >
              <span
                key={recording ? "rec" : "mic"}
                className="composer-action-swap grid place-items-center"
              >
                <Mic className={recording ? "h-5 w-5" : "h-[18px] w-[18px]"} strokeWidth={2.5} />
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTimer(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default MessageComposer;
