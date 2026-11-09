/**
 * The door into live, drawn as part of RIZZ rather than as a red icon button.
 *
 * On a phone it is a lens: an ink orb with a lime rim, one slow arc of light
 * travelling around it, and the LIVE label sitting in the nav row like every
 * other tab instead of being squeezed inside a 52px tile. On the desktop rail
 * the same orb marks the feature card. The pulse and the arc are the only
 * motion and both stand down under reduced motion.
 */
import { ArrowUpRight } from "lucide-react";
import { RizzLiveIcon } from "@/components/live/RizzLiveIcon";

function LiveOrb({ size }: { size: "mobile" | "sidebar" }) {
  const mobile = size === "mobile";
  return (
    <span
      className={`live-orb relative grid shrink-0 place-items-center rounded-full border border-primary/40 shadow-[0_10px_30px_-12px_rgba(201,255,61,0.55),inset_0_1px_0_rgba(255,255,255,0.12)] ${
        mobile ? "h-[52px] w-[52px]" : "h-10 w-10"
      }`}
    >
      <span className="live-orb__sweep" aria-hidden="true" />
      <span
        className="live-fab__halo pointer-events-none absolute inset-0 rounded-full border border-primary/25"
        aria-hidden="true"
      />
      <RizzLiveIcon className={`relative text-primary ${mobile ? "h-6 w-6" : "h-5 w-5"}`} />
      <span
        className={`live-signal-dot absolute rounded-full ring-2 ring-[#0a0a0b] ${
          mobile ? "right-0.5 top-0.5 h-2 w-2" : "-right-0.5 -top-0.5 h-[7px] w-[7px]"
        }`}
        aria-hidden="true"
      />
    </span>
  );
}

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
        className="group -mt-4 flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 focus-visible:outline-none"
        aria-label="Go live"
        title="Go live"
      >
        <span className="transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
          <LiveOrb size="mobile" />
        </span>
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">
          Live
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group mb-4 flex w-full items-center gap-3 rounded-xl border border-primary/20 bg-[linear-gradient(135deg,rgba(201,255,61,0.08),rgba(255,255,255,0.015)_62%)] p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-[linear-gradient(135deg,rgba(201,255,61,0.12),rgba(255,255,255,0.025)_62%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
    >
      <LiveOrb size="sidebar" />
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
