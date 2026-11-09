import { ArrowUpRight } from "lucide-react";
import { RizzLiveIcon } from "@/components/live/RizzLiveIcon";

/**
 * The door into live, drawn as part of RIZZ rather than as a red icon button.
 *
 * The signal mark sits in an ink squircle with a lime rim, so the FAB reads as
 * the centre action of the shell and the sidebar row as a feature card. The
 * pulse is the only motion and stands down under prefers-reduced-motion.
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
        className="group flex min-h-[44px] min-w-[44px] flex-1 -mt-3.5 flex-col items-center justify-center focus-visible:outline-none"
        aria-label="Go live"
        title="Go live"
      >
        <span className="relative grid h-[52px] w-[52px] place-items-center rounded-[18px] border border-primary/35 bg-[radial-gradient(130%_120%_at_30%_0%,rgba(201,255,61,0.2),transparent_62%),linear-gradient(158deg,#171d0b,#0a0a0b_72%)] shadow-[0_12px_28px_-14px_rgba(201,255,61,0.6)] transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
          <span className="live-fab__halo pointer-events-none absolute inset-0 rounded-[18px] border border-primary/25" />
          <RizzLiveIcon className="relative h-6 w-6 text-primary" />
          <span className="relative mt-0.5 text-[7px] font-black uppercase tracking-[0.18em] text-primary/90">
            Live
          </span>
          <span className="live-signal-dot absolute -right-0.5 -top-0.5 h-2.5 w-2.5 ring-2 ring-[#0a0a0b]" />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group mb-4 flex w-full items-center gap-3 rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,rgba(201,255,61,0.09),rgba(255,255,255,0.02)_62%)] p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-[linear-gradient(135deg,rgba(201,255,61,0.13),rgba(255,255,255,0.03)_62%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
    >
      <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/[0.08] text-primary">
        <RizzLiveIcon className="h-5 w-5" />
        <span className="live-signal-dot absolute -right-0.5 -top-0.5 h-2 w-2 ring-2 ring-[#10120a]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-[12px] font-black uppercase tracking-[0.13em] text-foreground">
            Go live
          </span>
          <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-primary">
            New
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
          Camera · screen · live chat
        </span>
      </span>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-primary/60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  );
}
