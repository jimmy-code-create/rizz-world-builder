import { BadgeCheck } from "lucide-react";
import "./_group.css";

export function Current() {
  return (
    <main className="flex min-h-[140px] items-center justify-center px-5 py-8">
      <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] px-3 py-2 shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-pink-500 to-violet-600 text-sm font-bold text-white">
          M
        </div>
        <span className="text-sm font-semibold text-white">mira</span>
        <span
          title="Verified Creator"
          aria-label="Verified Creator"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-pink-500/30 bg-pink-500/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-pink-400"
        >
          <BadgeCheck className="h-3 w-3" />
          Verified Creator
        </span>
      </div>
    </main>
  );
}
