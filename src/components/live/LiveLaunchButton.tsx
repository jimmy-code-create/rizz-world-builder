import { ArrowUpRight, Radio } from "lucide-react";

/**
 * The door into live, redrawn as a control people want to press instead of a
 * destructive-looking outline. The pulse is the only motion in the shell and
 * stands down under prefers-reduced-motion.
 */
export function LiveLaunchButton({
  onClick,
  variant,
}: {
  onClick: () => void;
  variant: "sidebar" | "mobile";
}) {
  if (variant === "mobile") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center -mt-4 focus-visible:outline-none"
        aria-label="Go live"
        title="Go live"
      >
        <span className="live-fab relative grid h-14 w-14 min-h-[44px] min-w-[44px] place-items-center rounded-full border border-[#ff5d68]/45 bg-[#151016] shadow-[0_12px_30px_-14px_rgba(255,93,104,.75)] transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
          <span className="live-fab__halo pointer-events-none absolute inset-0 rounded-full border border-[#ff5d68]/25" />
          <span className="relative flex flex-col items-center leading-none">
            <Radio className="h-5 w-5 text-[#ff8a91]" />
            <span className="mt-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-[#ffb0b5]">
              Live
            </span>
          </span>
          <span className="live-dot absolute -right-0.5 -top-0.5 h-3 w-3 ring-2 ring-background" />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="live-launch group mb-4 flex w-full items-center gap-3 rounded-xl border border-[#ff5d68]/25 bg-[#151016] p-2.5 text-left transition-colors hover:border-[#ff5d68]/45 hover:bg-[#1b1219] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#ff5d68]/25 bg-[#ff5d68]/10 text-[#ff8a91]">
        <Radio className="h-4 w-4" />
        <span className="live-dot absolute -right-0.5 -top-0.5 h-2 w-2 ring-2 ring-[#151016]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-[12px] font-black uppercase tracking-[0.13em] text-foreground">
            Go live
          </span>
          <span className="rounded bg-[#ff5d68]/12 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-[#ff9aa1]">
            New
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
          Camera · screen · live chat
        </span>
      </span>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
    </button>
  );
}
