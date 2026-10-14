/**
 * The app's background texture.
 *
 * It used to be three blurred colour orbs, two sweeping light beams and a noise
 * film — the glow-blob look that made every screen read as generic. What is left
 * is a static halftone dot grid drawn from the brand tokens: one paint, no
 * animation, no blur, no colour cast, and it can never sit opaque over the page
 * background. The layer is deliberately inert: no pointer listeners, so it costs
 * nothing while you scroll.
 */
export function NightclubCanvas() {
  return <div aria-hidden className="nightclub-canvas" />;
}
