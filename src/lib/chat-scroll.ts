/**
 * Land a chat on its newest message.
 *
 * Tapping a composer means “I'm replying to now”, so every chat surface scrolls
 * to the bottom when the input is clicked or focused. The first jump is
 * immediate; the on-screen keyboard then changes the list's height (Android
 * shrinks the layout viewport, iOS pans it), so the scroll is re-applied for the
 * next frames and while the visual viewport settles. Without that second pass
 * the list is scrolled against the old height and the newest message ends up
 * just below the fold.
 */
export function scrollChatToLatest(scroller: HTMLElement | null | undefined) {
  if (!scroller) return;

  const toBottom = () => {
    scroller.scrollTop = scroller.scrollHeight;
  };

  toBottom();
  requestAnimationFrame(() => {
    toBottom();
    requestAnimationFrame(toBottom);
  });

  const viewport = typeof window === "undefined" ? null : window.visualViewport;
  if (!viewport) return;

  // Keep following the keyboard until it stops moving, then drop the listener.
  const follow = () => toBottom();
  viewport.addEventListener("resize", follow);
  window.setTimeout(() => viewport.removeEventListener("resize", follow), 700);
}
