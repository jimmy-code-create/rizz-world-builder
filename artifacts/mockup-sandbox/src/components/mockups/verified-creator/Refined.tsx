import { BadgeCheck } from "lucide-react";
import "./_group.css";

export function Refined() {
  return (
    <main className="flex min-h-[140px] items-center justify-center px-5 py-8">
      <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] px-3 py-2 shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-pink-500 to-violet-600 text-sm font-bold text-white">
          M
        </div>
        <span className="text-sm font-semibold text-white">mira</span>
        <span
          role="img"
          aria-label="Verified creator"
          title="Verified Creator"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-cyan-300/30 bg-gradient-to-r from-cyan-400/15 via-sky-400/10 to-violet-400/15 px-1.5 py-1 text-[10px] font-bold leading-none text-cyan-100 shadow-[0_0_12px_rgba(56,189,248,0.16)] backdrop-blur-sm"
        >
          <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-cyan-300/15 ring-1 ring-cyan-200/20">
            <BadgeCheck className="h-3 w-3 text-cyan-200 drop-shadow-[0_0_4px_rgba(103,232,249,0.65)]" aria-hidden="true" />
          </span>
          Creator
        </span>
      </div>
    </main>
  );
}
