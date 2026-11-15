/**
 * The composer's panel state machine.
 *
 * One panel at a time, and the keyboard counts as one of them. Keeping this
 * pure (no React, no DOM) is what makes "opening the emoji panel hides the
 * keyboard but keeps the field's height" testable instead of a pile of booleans
 * spread across four screens.
 *
 * States:
 *   none      — the row at rest, keyboard down.
 *   keyboard  — the field is focused.
 *   attach    — the "+" sheet.
 *   emoji     — the emoji panel.
 *   stickers  — stickers and GIFs.
 */
export type ComposerPanel = "none" | "keyboard" | "attach" | "emoji" | "stickers";

/** The panels that are drawn above the row, as opposed to the OS keyboard. */
export type ComposerSheetPanel = Exclude<ComposerPanel, "none" | "keyboard">;

export type ComposerPanelEvent =
  /** A trigger button: same panel again closes it. */
  | { type: "toggle"; panel: ComposerSheetPanel }
  | { type: "open"; panel: ComposerPanel }
  | { type: "close" }
  /** The field was focused or tapped. */
  | { type: "focus-field" }
  /** The field lost focus, usually because a panel took it. */
  | { type: "blur-field" }
  /** Android back button. */
  | { type: "back" };

export function nextPanel(panel: ComposerPanel, event: ComposerPanelEvent): ComposerPanel {
  switch (event.type) {
    case "toggle":
      return panel === event.panel ? "none" : event.panel;
    case "open":
      return event.panel;
    case "close":
    case "back":
      return "none";
    case "focus-field":
      // Tapping the field always returns to typing, whatever was open.
      return "keyboard";
    case "blur-field":
      // A panel taking the focus is not a reason to close itself.
      return panel === "keyboard" ? "none" : panel;
    default:
      return panel;
  }
}

export const DEFAULT_KEYBOARD_HEIGHT = 300;
export const MIN_KEYBOARD_HEIGHT = 280;
/** Never more than half the viewport, or the field and the row are gone. */
const MAX_KEYBOARD_RATIO = 0.5;

/**
 * The height to remember for the panel: the OS keyboard's real height, kept
 * between 280 and half the viewport, defaulting to 300 when the browser never
 * reported one (desktop, or a keyboard that never opened).
 */
export function clampKeyboardHeight(height: number | null | undefined, viewportHeight: number) {
  const max = Math.max(MIN_KEYBOARD_HEIGHT, Math.round(viewportHeight * MAX_KEYBOARD_RATIO));
  if (!height || !Number.isFinite(height) || height <= 0) {
    return Math.min(DEFAULT_KEYBOARD_HEIGHT, max);
  }
  return Math.round(Math.min(Math.max(height, MIN_KEYBOARD_HEIGHT), max));
}

/** The height the panel area should occupy, or null when nothing is open. */
export function panelHeight(
  panel: ComposerPanel,
  keyboardHeight: number,
  viewportHeight: number,
): number | null {
  if (panel === "none" || panel === "keyboard") return null;
  return clampKeyboardHeight(keyboardHeight, viewportHeight);
}

/** True when the emoji trigger should draw a keyboard instead of a smiley. */
export function emojiTriggerShowsKeyboard(panel: ComposerPanel) {
  return panel === "emoji";
}

/**
 * Back closes a panel first, and only then leaves the screen. The keyboard does
 * not count: Android already dismisses it on back.
 */
export function backShouldClosePanel(panel: ComposerPanel) {
  return panel !== "none" && panel !== "keyboard";
}
