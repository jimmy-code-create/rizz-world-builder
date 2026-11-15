/**
 * Per-chat drafts.
 *
 * The text in the field belongs to the chat, not to the component tree: leave a
 * DM, come back, and your half-written message is still there. Writes are
 * debounced (400ms) so a fast typist does not hit storage on every keystroke,
 * and sending clears the draft in the same tick.
 */
import { clampKeyboardHeight } from "./panels.ts";

const PREFIX = "rizz:draft:";
export const DRAFT_DEBOUNCE_MS = 400;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStore(): Store | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    // Private mode, or storage disabled: drafts simply do not persist.
    return null;
  }
}

/** `dm:abc` / `group:xyz` / `realm:slug#channel` — one draft per conversation. */
export function draftKey(chatType: "dm" | "group" | "realm", chatId: string) {
  return `${PREFIX}${chatType}:${chatId}`;
}

export function readDraft(key: string, store: Store | null = defaultStore()) {
  if (!store) return "";
  try {
    return store.getItem(key) ?? "";
  } catch {
    return "";
  }
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Debounced write: the last keystroke within 400ms wins. */
export function queueDraft(
  key: string,
  value: string,
  store: Store | null = defaultStore(),
  delay = DRAFT_DEBOUNCE_MS,
) {
  if (!store) return;
  const pending = timers.get(key);
  if (pending) clearTimeout(pending);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      try {
        if (value.trim()) store.setItem(key, value);
        else store.removeItem(key);
      } catch {
        // Quota or disabled storage: a draft is not worth breaking a send.
      }
    }, delay),
  );
}

/** Write now, cancel any pending debounce (used when switching chats). */
export function flushDraft(key: string, value: string, store: Store | null = defaultStore()) {
  const pending = timers.get(key);
  if (pending) clearTimeout(pending);
  timers.delete(key);
  if (!store) return;
  try {
    if (value.trim()) store.setItem(key, value);
    else store.removeItem(key);
  } catch {
    // ignore
  }
}

export function clearDraft(key: string, store: Store | null = defaultStore()) {
  const pending = timers.get(key);
  if (pending) clearTimeout(pending);
  timers.delete(key);
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Where a panel should sit: the remembered keyboard height, so the row does not
 * move when the emoji panel replaces the keyboard.
 */
export function panelSpace(keyboardHeight: number, viewportHeight: number) {
  return clampKeyboardHeight(keyboardHeight, viewportHeight);
}
