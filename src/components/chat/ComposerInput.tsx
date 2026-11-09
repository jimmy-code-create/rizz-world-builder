import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type ClipboardEvent as ReactClipboardEvent,
  type CSSProperties,
  type FormEvent as ReactFormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";
import { parseEmojiToken, splitEmojiTokens, type EmojiTokenParts } from "@/lib/emoji-token";
import { renderGifSegments } from "@/lib/gif-content";

/**
 * The message field, with custom emoji drawn where they are typed.
 *
 * A textarea cannot show a picture, so choosing `:rizzy:` used to drop
 * `<:rizzy:6f2c…>` into the box as raw text. This is a contenteditable field
 * with one rule: an emoji is an `<img data-token="<:name:id>">`, and every plain
 * text node around it is the message text. `getValue()` walks the DOM and turns
 * the pictures back into tokens, which is exactly what the server stores.
 *
 * Constraints that keep it safe:
 *  - The value is never re-rendered from React while typing (that would reset
 *    the caret on Android); the DOM is the source of truth and `onChange`
 *    reports the token string after every input.
 *  - The selection is saved on blur and on `selectionchange`, because opening
 *    the picker blurs the field and the caret would otherwise be lost.
 *  - Enter sends (IME-safe), Shift+Enter breaks the line, paste turns tokens
 *    into pictures but leaves text/image paste to the caller.
 */
export type ComposerInputHandle = {
  /** The message text with emoji tokens, trimmed. */
  getValue: () => string;
  /** Inserts `token` (or `:name:` unicode/cat text) at the saved caret. */
  insertEmoji: (token: string, parts?: EmojiTokenParts | null) => void;
  insertText: (text: string) => void;
  clear: () => void;
  focus: () => void;
  /** The raw editable element, for surfaces that measure it. */
  element: () => HTMLDivElement | null;
  /** Caret offset in the token string, for the mention popup. */
  getCaret: () => number;
  setSelection: (offset: number) => void;
};

type ComposerInputProps = {
  /** Used only to reset the DOM when a screen swaps drafts (e.g. another DM). */
  value: string;
  onChange: (value: string, caret: number) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Inline emoji images, resolved by the owner (it may know local uploads). */
  resolveEmoji?: (parts: EmojiTokenParts) => string | null;
  /** Enter without Shift. Returning `true` means the owner handled it. */
  onEnter?: () => void;
  /** Fires first; the field's Enter handler is skipped when it calls preventDefault. */
  onKeyDown?: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onKeyUp?: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onClick?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Text paste with no files; defaults to a plain insert. */
  onPasteText?: (text: string) => boolean;
  /** Ctrl/Cmd+V with an image on the clipboard. */
  onPasteFiles?: (files: File[]) => void;
  /**
   * Runs first on every paste, for a screen that already had its own handler
   * (the realm composer's image paste). Calling `preventDefault` takes over.
   */
  onPaste?: (event: ReactClipboardEvent<HTMLDivElement>) => void;
  ariaLabel?: string;
  maxLength?: number;
  /** Exposed so a screen can scroll the chat on focus like it did before. */
  inputId?: string;
  enterKeyHint?: "send" | "enter";
};

const ZERO_WIDTH = "\u200b";
/** Empty state only; the placeholder text itself stays in `data-placeholder`. */
const EMPTY_ATTR = "data-empty";

function isEmojiNode(node: Node): node is HTMLImageElement {
  return (
    node.nodeType === 1 &&
    (node as HTMLElement).tagName === "IMG" &&
    (node as HTMLElement).dataset.token !== undefined
  );
}

/** A GIF/sticker picked from the sheet, drawn as media until it is sent. */
function isMediaNode(node: Node): node is HTMLElement {
  return node.nodeType === 1 && (node as HTMLElement).dataset.mediaToken !== undefined;
}

function createMediaElement(marker: string, url: string, isSticker: boolean): HTMLElement {
  const label = isSticker ? "Sticker" : "GIF";
  if (/\.(webm|mp4)(\?|#|$)/i.test(url)) {
    const video = document.createElement("video");
    video.dataset.mediaToken = marker;
    video.src = url;
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.contentEditable = "false";
    video.draggable = false;
    video.className = "inline-media";
    video.setAttribute("aria-label", label);
    return video;
  }
  const image = document.createElement("img");
  image.dataset.mediaToken = marker;
  image.src = url;
  image.alt = label;
  image.loading = "eager";
  image.decoding = "async";
  image.draggable = false;
  image.contentEditable = "false";
  image.className = "inline-media";
  return image;
}

function createEmojiImage(parts: EmojiTokenParts, src: string | null): HTMLImageElement {
  const image = document.createElement("img");
  image.dataset.token = parts.token;
  image.dataset.name = parts.name;
  image.alt = `:${parts.name}:`;
  image.title = `:${parts.name}:`;
  image.loading = "lazy";
  image.decoding = "async";
  image.draggable = false;
  image.contentEditable = "false";
  image.className = "inline-emoji";
  image.width = 20;
  image.height = 20;
  if (src) {
    image.src = src;
    image.addEventListener(
      "error",
      () => {
        // The file is gone: the token text is a better answer than a broken box.
        const fallback = document.createTextNode(`:${parts.name}:`);
        image.replaceWith(fallback);
      },
      { once: true },
    );
  } else {
    const fallback = document.createTextNode(`:${parts.name}:`);
    image.replaceWith(fallback);
  }
  return image;
}

/** Walks the editable DOM and rebuilds the stored token string. */
export function readComposerValue(root: Node): string {
  let out = "";
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.nodeValue ?? "";
      return;
    }
    if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      // `Range.cloneContents()` (used to measure the caret) yields a fragment.
      for (const child of Array.from(node.childNodes)) walk(child);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as HTMLElement;
    if (isMediaNode(element)) {
      out += element.dataset.mediaToken ?? "";
      return;
    }
    if (isEmojiNode(element)) {
      out += element.dataset.token ?? "";
      return;
    }
    const tag = element.tagName;
    if (tag === "BR") {
      out += "\n";
      return;
    }
    const block = tag === "DIV" || tag === "P";
    if (block && out && !out.endsWith("\n")) out += "\n";
    // A block's first <br> is Chrome's empty-line marker, not a newline.
    for (const child of Array.from(element.childNodes)) {
      if (tag === "DIV" || tag === "P") {
        if (child.nodeName === "BR" && element.childNodes.length === 1) continue;
      }
      walk(child);
    }
  };
  walk(root);
  return out.replace(/\u200b/g, "").trim();
}

/** True when the field has no text and no emoji (stray <br> does not count). */
export function isComposerEmpty(root: Node): boolean {
  const text = readComposerValue(root);
  if (text.length > 0) return false;
  return !(root as HTMLElement).querySelector?.(
    "img[data-token], img[data-media-token], video[data-media-token]",
  );
}

export const ComposerInput = forwardRef<ComposerInputHandle, ComposerInputProps>(
  function ComposerInput(
    {
      value,
      onChange,
      placeholder,
      disabled = false,
      className,
      style,
      resolveEmoji,
      onEnter,
      onKeyDown,
      onKeyUp,
      onClick,
      onFocus,
      onBlur,
      onPasteText,
      onPasteFiles,
      onPaste,
      ariaLabel,
      maxLength,
      inputId,
      enterKeyHint = "send",
    },
    ref,
  ) {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const savedRange = useRef<Range | null>(null);
    const composing = useRef(false);
    // The last value we reported, so an external reset can be told apart from
    // our own echo (which must never rewrite the DOM mid-typing).
    const lastEmitted = useRef(value);
    const resolveRef = useRef(resolveEmoji);
    resolveRef.current = resolveEmoji;

    /** Caret offset expressed in the token string, for the mention popup. */
    const caretOffset = useCallback(() => {
      const node = rootRef.current;
      if (!node) return 0;
      const range = savedRange.current;
      if (!range) return readComposerValue(node).length;
      try {
        const probe = document.createRange();
        probe.selectNodeContents(node);
        probe.setEnd(range.endContainer, range.endOffset);
        return readComposerValue(probe.cloneContents()).length;
      } catch {
        return readComposerValue(node).length;
      }
    }, []);

    const emit = useCallback(() => {
      const node = rootRef.current;
      if (!node) return;
      const next = readComposerValue(node);
      lastEmitted.current = next;
      onChange(next, caretOffset());
    }, [caretOffset, onChange]);

    const syncPlaceholder = useCallback(() => {
      const node = rootRef.current;
      if (!node) return;
      node.setAttribute(EMPTY_ATTR, isComposerEmpty(node) ? "true" : "false");
    }, []);

    const saveRange = useCallback(() => {
      const node = rootRef.current;
      const selection = window.getSelection();
      if (!node || !selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      if (!node.contains(range.commonAncestorContainer)) return;
      savedRange.current = range.cloneRange();
    }, []);

    /** Puts the caret at the end when we never had one (first open, restore). */
    const caretToEnd = useCallback(() => {
      const node = rootRef.current;
      if (!node) return;
      const range = document.createRange();
      range.selectNodeContents(node);
      range.collapse(false);
      savedRange.current = range;
      const selection = window.getSelection();
      if (document.activeElement === node && selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }, []);

    const insertNodes = useCallback(
      (nodes: Node[], { keepKeyboard = true }: { keepKeyboard?: boolean } = {}) => {
        const node = rootRef.current;
        if (!node) return;
        if (!savedRange.current) caretToEnd();
        const range = savedRange.current ?? document.createRange();
        if (!node.contains(range.commonAncestorContainer)) {
          caretToEnd();
          return;
        }
        range.deleteContents();
        const fragment = document.createDocumentFragment();
        for (const child of nodes) fragment.appendChild(child);
        const last = nodes[nodes.length - 1];
        range.insertNode(fragment);
        if (last) {
          const after = document.createRange();
          after.setStartAfter(last);
          after.collapse(true);
          savedRange.current = after;
          if (keepKeyboard) {
            const selection = window.getSelection();
            if (selection) {
              selection.removeAllRanges();
              selection.addRange(after);
            }
          }
        }
        const focusTarget = document.activeElement === node;
        if (!focusTarget && keepKeyboard) node.focus({ preventScroll: true });
        emit();
        syncPlaceholder();
      },
      [caretToEnd, emit, syncPlaceholder],
    );

    /**
     * The token string as text, emoji pictures and GIF/sticker media.
     * A picked GIF used to sit in the field as `![gif](…)`; the whole point of
     * the picker is that you see the thing you chose, so the marker becomes a
     * media element immediately and is written back on read.
     */
    const nodesForText = useCallback((text: string): Node[] => {
      const nodes: Node[] = [];
      for (const segment of renderGifSegments(text)) {
        if (segment.isGif || segment.isSticker) {
          nodes.push(
            createMediaElement(
              segment.marker ?? `![${segment.isSticker ? "sticker" : "gif"}](${segment.value})`,
              segment.value,
              segment.isSticker,
            ),
          );
          continue;
        }
        for (const piece of splitEmojiTokens(segment.value)) {
          if (piece.kind === "text") {
            nodes.push(document.createTextNode(piece.text));
            continue;
          }
          const src = resolveRef.current?.(piece) ?? null;
          nodes.push(createEmojiImage(piece, src));
        }
      }
      return nodes;
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        getValue: () => {
          const node = rootRef.current;
          return node ? readComposerValue(node) : "";
        },
        insertEmoji: (token, parts) => {
          const node = rootRef.current;
          if (!node) return;
          const parsed = parts ?? null;
          const src = parsed ? (resolveRef.current?.(parsed) ?? null) : null;
          // A zero-width space after the picture lets the caret sit outside it,
          // and is stripped from getValue() so the stored token stays clean.
          const trailing = document.createTextNode(ZERO_WIDTH);
          insertNodes(
            [
              createEmojiImage(
                parsed ??
                  parseEmojiToken(token) ?? {
                    animated: false,
                    name: "emoji",
                    id: "",
                    token,
                  },
                src,
              ),
              trailing,
            ],
            { keepKeyboard: false },
          );
        },
        insertText: (text) => {
          const node = rootRef.current;
          if (!node) return;
          insertNodes(nodesForText(text));
        },
        clear: () => {
          const node = rootRef.current;
          if (!node) return;
          node.replaceChildren();
          lastEmitted.current = "";
          savedRange.current = null;
          caretToEnd();
          syncPlaceholder();
          onChange("", 0);
        },
        focus: () => {
          const node = rootRef.current;
          if (!node) return;
          node.focus({ preventScroll: true });
          const selection = window.getSelection();
          if (savedRange.current && selection) {
            selection.removeAllRanges();
            selection.addRange(savedRange.current);
          } else {
            caretToEnd();
          }
        },
        element: () => rootRef.current,
        getCaret: () => {
          const node = rootRef.current;
          const range = savedRange.current;
          if (!node || !range) return 0;
          const probe = document.createRange();
          probe.selectNodeContents(node);
          probe.setEnd(range.endContainer, range.endOffset);
          return readComposerValue(probe.cloneContents()).length;
        },
        setSelection: (offset: number) => {
          const node = rootRef.current;
          if (!node) return;
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
          let remaining = offset;
          let target: Text | null = null;
          let targetOffset = 0;
          while (walker.nextNode()) {
            const text = walker.currentNode as Text;
            const length = text.nodeValue?.length ?? 0;
            if (remaining <= length) {
              target = text;
              targetOffset = remaining;
              break;
            }
            remaining -= length;
          }
          if (!target) {
            caretToEnd();
            return;
          }
          const range = document.createRange();
          range.setStart(target, targetOffset);
          range.collapse(true);
          savedRange.current = range;
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
        },
      }),
      [caretToEnd, insertNodes, nodesForText, onChange, syncPlaceholder],
    );

    // (1) Restore the draft / swap threads: only rewrite when the value came
    // from outside (a different DM, a restored draft), never on our own echo.
    useEffect(() => {
      const node = rootRef.current;
      if (!node) return;
      if (value === lastEmitted.current) return;
      node.replaceChildren();
      if (value) {
        for (const child of nodesForText(value)) node.appendChild(child);
      }
      lastEmitted.current = value;
      syncPlaceholder();
      caretToEnd();
    }, [caretToEnd, nodesForText, syncPlaceholder, value]);

    // (2) Remember where the caret was: the picker steals focus, and the
    // selection is the only thing that survives it.
    useEffect(() => {
      const node = rootRef.current;
      if (!node) return;
      const onSelectionChange = () => {
        if (document.activeElement === node) saveRange();
      };
      document.addEventListener("selectionchange", onSelectionChange);
      return () => document.removeEventListener("selectionchange", onSelectionChange);
    }, [saveRange]);

    useEffect(() => {
      if (disabled) return;
      const node = rootRef.current;
      if (!node) return;
      syncPlaceholder();
    }, [disabled, syncPlaceholder]);

    const handleInput = () => {
      const node = rootRef.current;
      if (!node) return;
      // Android Chrome leaves a bare <br> behind after a select-all delete;
      // dropping it is what brings the placeholder back.
      if (node.childNodes.length === 1 && node.firstChild?.nodeName === "BR") {
        node.replaceChildren();
      }
      saveRange();
      emit();
      syncPlaceholder();
    };

    const handlePaste = (event: ReactClipboardEvent<HTMLDivElement>) => {
      const data = event.clipboardData;
      if (!data) return;
      onPaste?.(event);
      if (event.defaultPrevented) return;
      const files: File[] = [];
      for (const item of Array.from(data.items ?? [])) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length) {
        // Attachments keep their old behaviour: the screen owns the upload.
        event.preventDefault();
        onPasteFiles?.(files);
        return;
      }

      const text = data.getData("text/plain");
      if (!text) return;
      event.preventDefault();
      if (onPasteText?.(text)) return;
      insertNodes(nodesForText(text));
    };

    const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;

      // An IME is mid-composition: Enter is the candidate list, not a send.
      const native = event.nativeEvent as KeyboardEvent & { isComposing?: boolean };
      if (composing.current || native.isComposing || event.keyCode === 229) return;

      // One Backspace removes a whole emoji: the picture and the zero-width
      // space that keeps the caret beside it go together.
      if (event.key === "Backspace" && !event.shiftKey && !event.altKey) {
        const range = savedRange.current;
        const node = rootRef.current;
        if (range && node && range.collapsed) {
          const before = range.startContainer;
          const offset = range.startOffset;
          const prevNode = () => {
            if (before.nodeType === Node.TEXT_NODE && offset > 0) {
              return { node: before, offset };
            }
            return null;
          };
          const spot = prevNode();
          if (spot) {
            const text = spot.node as Text;
            const chars = text.nodeValue ?? "";
            let end = spot.offset;
            let changed = false;
            if (end > 0 && chars[end - 1] === ZERO_WIDTH) {
              text.deleteData(end - 1, 1);
              end -= 1;
              changed = true;
            }
            const previous = text.previousSibling;
            if (
              end === text.nodeValue?.length &&
              previous &&
              (isEmojiNode(previous) || isMediaNode(previous)) &&
              chars.slice(0, end).trim() === ""
            ) {
              previous.remove();
              text.deleteData(0, Math.max(0, end));
              changed = true;
            }
            if (changed) {
              event.preventDefault();
              const next = document.createRange();
              next.setStart(text, Math.min(text.nodeValue?.length ?? 0, end));
              next.collapse(true);
              savedRange.current = next;
              const selection = window.getSelection();
              if (selection) {
                selection.removeAllRanges();
                selection.addRange(next);
              }
              emit();
              syncPlaceholder();
              return;
            }
          }
        }
      }

      if (event.key === "Enter" && !event.shiftKey) {
        // Phones keep Enter as a newline and send with the arrow, exactly as
        // the textarea did; a physical keyboard sends.
        const finePointer =
          typeof window !== "undefined" &&
          typeof window.matchMedia === "function" &&
          window.matchMedia("(pointer: fine)").matches;
        if (finePointer) {
          event.preventDefault();
          onEnter?.();
        }
      }
    };

    const handleBeforeInput = (event: ReactFormEvent<HTMLDivElement>) => {
      // `maxLength` on a contenteditable is advisory only; enforce it the way
      // the textarea did, so a long paste/message cannot exceed the server cap.
      if (maxLength && maxLength > 0) {
        const typed = readComposerValue(rootRef.current ?? document.createElement("div")).length;
        if (typed >= maxLength) {
          event.preventDefault();
          return;
        }
      }
      const native = event.nativeEvent as InputEvent;
      if (native.inputType === "insertParagraph" || native.inputType === "insertLineBreak") {
        const finePointer =
          typeof window !== "undefined" &&
          typeof window.matchMedia === "function" &&
          window.matchMedia("(pointer: fine)").matches;
        if (finePointer) {
          event.preventDefault();
          onEnter?.();
        }
      }
    };

    return (
      <div
        id={inputId}
        ref={rootRef}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel ?? placeholder}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        contentEditable={!disabled}
        suppressContentEditableWarning
        spellCheck
        enterKeyHint={enterKeyHint}
        data-placeholder={placeholder}
        data-empty={value ? "false" : "true"}
        data-composer-input="true"
        className={cn(
          "composer-input min-h-10 min-w-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words bg-transparent py-2 pr-1 text-[16px] leading-6",
          "caret-primary focus:outline-none focus-visible:outline-none",
          disabled ? "text-[#6f6f6f]" : "text-[#f2f2f2]",
          className,
        )}
        style={style}
        onInput={handleInput}
        onBeforeInput={handleBeforeInput}
        onKeyDown={handleKeyDown}
        onKeyUp={(event) => {
          saveRange();
          onKeyUp?.(event);
        }}
        onPaste={handlePaste}
        onClick={() => {
          saveRange();
          onClick?.();
        }}
        onFocus={() => {
          if (value && lastEmitted.current === value) {
            // A restored draft starts with the caret at the end, once.
            const node = rootRef.current;
            if (node && !savedRange.current) caretToEnd();
          }
          onFocus?.();
        }}
        onBlur={() => {
          saveRange();
          onBlur?.();
        }}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
          handleInput();
        }}
      />
    );
  },
);

export default ComposerInput;
