import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ArrowUp, Cat, Mic, Smile, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The chat composer, in one row.
 *
 * DM and group chat share this component so the two can never drift: a 44px
 * attach circle, a 44px-tall pill holding the emoji trigger, the textarea and
 * the cat pack trigger, and a 44px lime action circle that is a mic when the
 * box is empty and an arrow when there is something to send.
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
const MAX_INPUT_HEIGHT = 120;
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
  textareaRef,
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
  onFocus,
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
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
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
  onKeyUp?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Runs before the composer's own Enter-to-send, for slash menus and the like. */
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onTextareaClick?: (event: React.MouseEvent<HTMLTextAreaElement>) => void;
  onFocus?: () => void;
}) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const field = textareaRef ?? localRef;
  const pressRef = useRef<{ x: number } | null>(null);
  const [sliding, setSliding] = useState(false);
  const hasText = value.trim().length > 0;
  // A photo with no caption is still sendable, so the screen decides whether
  // the action is a send arrow; text alone is the default.
  const canSendNow = canSend ?? hasText;

  // Auto-grow to five lines, then scroll. `height:auto` first is what lets the
  // box shrink again after a deletion.
  useEffect(() => {
    const node = field.current;
    if (!node) return;
    node.style.height = "auto";
    const next = Math.min(node.scrollHeight, MAX_INPUT_HEIGHT);
    node.style.height = `${next}px`;
    node.style.overflowY = node.scrollHeight > MAX_INPUT_HEIGHT ? "auto" : "hidden";
  }, [value, field]);

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
    field.current?.focus({ preventScroll: true });
  };

  return (
    <div
      className={cn(
        "chat-bar relative z-20 shrink-0 border-t border-[#1c1c1c] bg-black px-3 pt-2",
        "pb-[max(env(safe-area-inset-bottom,0px),0.5rem)]",
      )}
    >
      <div className="mx-auto w-full max-w-3xl">
        {above}

        {reply ? (
          // 40px strip: a lime bar, the target of the reply, and one line of
          // the message. The whole middle is a jump link on replies.
          <div className="mb-2 flex h-10 items-stretch overflow-hidden rounded-lg border border-white/10 bg-[#0f0f0f]">
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
                field.current?.focus({ preventScroll: true });
              }}
              aria-label="Cancel reply"
              className="grid w-10 shrink-0 place-items-center text-[#8f8f8f] transition-colors hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          {attach}

          {/* The pill: 44px minimum, 22px radius, and the focus state lives on
              the wrapper so the ring hugs the whole field, not the caret box. */}
          <div
            className={cn(
              "relative flex min-w-0 flex-1 items-center rounded-[22px] border transition-colors duration-150",
              "motion-reduce:transition-none",
              disabled
                ? "border-white/[0.08] bg-[#0d0d0d]"
                : "border-white/[0.14] bg-[#121212] focus-within:border-primary/75 focus-within:ring-[3px] focus-within:ring-primary/[0.16]",
            )}
            style={{ minHeight: 44 }}
          >
            {recording ? (
              <div className="flex h-11 w-full items-center gap-2.5 px-3" aria-live="polite">
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
                  aria-label="Emoji"
                  title="Emoji"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-primary transition-opacity disabled:opacity-40"
                >
                  <Smile className="h-[22px] w-[22px]" strokeWidth={2} />
                </button>
                <textarea
                  ref={field}
                  value={value}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange(event.target.value, event.target.selectionStart ?? event.target.value.length)
                  }
                  onKeyUp={onKeyUp}
                  onClick={onTextareaClick}
                  onFocus={onFocus}
                  onKeyDown={(event) => {
                    onKeyDown?.(event);
                    if (event.defaultPrevented) return;
                    // Desktop: Enter sends, Shift+Enter breaks the line.
                    // Phones keep Enter as a newline — the action button sends.
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      window.matchMedia("(pointer: fine)").matches
                    ) {
                      event.preventDefault();
                      submit();
                    }
                  }}
                  placeholder={disabled ? disabledHint : placeholder}
                  maxLength={maxLength}
                  rows={1}
                  enterKeyHint="send"
                  aria-label={placeholder}
                  className={cn(
                    "min-h-11 min-w-0 flex-1 resize-none bg-transparent py-[11px] pr-1 text-[16px] leading-6",
                    "caret-primary placeholder:text-[#8c8c8c] focus:outline-none focus-visible:outline-none",
                    disabled ? "text-[#6f6f6f]" : "text-[#f2f2f2]",
                  )}
                  style={{ maxHeight: MAX_INPUT_HEIGHT }}
                />
                <button
                  type="button"
                  onClick={onStickers}
                  disabled={disabled}
                  aria-label="Stickers"
                  title="Cat stickers"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#8f8f8f] transition-colors hover:text-[#d6d6d6] disabled:opacity-40"
                >
                  <Cat className="h-[22px] w-[22px]" strokeWidth={1.8} />
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
                "grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-[#0b0b0b]",
                "transition-transform duration-150 active:scale-[0.94] motion-reduce:transition-none",
                "disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              )}
            >
              <span key={canSendNow ? "send" : "idle"} className="composer-action-swap grid place-items-center">
                <ArrowUp className="h-5 w-5" strokeWidth={2.6} />
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
                recording ? "h-14 w-14" : "h-11 w-11",
              )}
            >
              <span
                key={recording ? "rec" : "mic"}
                className="composer-action-swap grid place-items-center"
              >
                <Mic className={recording ? "h-6 w-6" : "h-5 w-5"} strokeWidth={2.4} />
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
