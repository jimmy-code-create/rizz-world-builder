/**
 * The one and only loading screen: brand mark + lime progress bar on
 * near-black. Used for the auth gate and route transitions so opening the
 * app never flashes competing loaders. Ambient lazy chunks mount with a
 * null fallback instead of ever showing UI.
 */
export function AppLoader() {
  return (
    <div
      role="status"
      aria-label="Loading RIZZ"
      className="grid min-h-dvh place-items-center bg-[#0b0b0c]"
    >
      <div className="flex flex-col items-center gap-4">
        <img
          src="/brand/rizz-cat-logo.svg"
          alt=""
          aria-hidden
          className="h-12 w-12 object-contain"
        />
        <div
          aria-hidden
          className="h-1 w-32 overflow-hidden rounded-full bg-white/10"
        >
          <div className="h-full w-1/2 rounded-full bg-[#c8ff3d] animate-shimmer-sweep" />
        </div>
      </div>
    </div>
  );
}
