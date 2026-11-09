/**
 * The door into live, drawn as part of RIZZ rather than as a red icon button.
 *
 * On a phone it is a lens: an ink orb with a lime rim, one slow arc of light
 * travelling around it, and the LIVE label sitting in the nav row like every
 * other tab. The block is sized so the bar keeps the same height it has on
 * Feed and Messages — the orb rises 12px above it instead of growing it.
 *
 * While you are on air the same orb turns red and the label reads "On air",
 * so "can start" and "already live" are never the same colour.
 */
import { ArrowUpRight } from "lucide-react";
import { RizzLiveIcon } from "@/components/live/RizzLiveIcon";
import { useVoiceCallContext } from "@/components/voice/VoiceCallProvider";

function LiveOrb({ size, onAir }: { size: "mobile" | "sidebar"; onAir: boolean }) {
  const mobile = size === "mobile";
  return (
    <span
      className={`live-orb relative grid shrink-0 place-items-center rounded-full border ${
        onAir ? "live-orb--on-air border-[#ff5d68]/45" : "border-primary/40"
      } ${
        onAir
          ? "shadow-[0_10px_30px_-12px_rgba(255,93,104,0.55),inset_0_1px_0_rgba(255,255,255,0.12)]"
          : "shadow-[0_10px_30px_-12px_rgba(201,255,61,0.55),inset_0_1px_0_rgba(255,255,255,0.12)]"
      } ${mobile ? "h-12 w-12" : "h-10 w-10"}`}
    >
      <span className="live-orb__sweep" aria-hidden="true" />
      <span
        className="live-fab__halo pointer-events-none absolute inset-0 rounded-full border border-primary/25"
        aria-hidden="true"
      />
      <RizzLiveIcon
        className={`relative ${onAir ? "text-[#ff5d68]" : "text-primary"} ${
          mobile ? "h-6 w-6" : "h-5 w-5"
        }`}
      />
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
  // The shell is rendered inside VoiceCallProvider, so the launch control can
  // read the real call state instead of guessing from the route.
  const { call } = useVoiceCallContext();
  const onAir = call?.kind === "live";

  if (variant === "mobile") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group -mt-3 flex min-h-[48px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        aria-label={onAir ? "You are live — open your room" : "Go live"}
        title={onAir ? "On air" : "Go live"}
      >
        <span className="transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
          <LiveOrb size="mobile" onAir={onAir} />
        </span>
        <span
          className={`text-[10px] font-black uppercase leading-[14px] tracking-[0.16em] ${
            onAir ? "text-[#ff5d68]" : "text-primary"
          }`}
        >
          {onAir ? "On air" : "Live"}
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
      <LiveOrb size="sidebar" onAir={onAir} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-[12px] font-black uppercase tracking-[0.13em] text-foreground">
            {onAir ? "You’re live" : "Go live"}
          </span>
          {!onAir && (
            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-primary">
              New
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
          {onAir ? "Return to your room" : "Camera · screen · live chat"}
        </span>
      </span>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-primary/60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  );
}
