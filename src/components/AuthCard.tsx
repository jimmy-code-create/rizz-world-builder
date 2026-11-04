import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLightCanvas } from "@/lib/use-light-canvas";

/**
 * The one surface the whole auth flow wears.
 *
 * White paper, ink type, a single lime thread in the focus states. On a phone
 * it is the whole screen; on a desktop it sits as one centred, softly lifted
 * panel. Sign-up, log-in, password reset, username claim and profile setup all
 * render through here so the flow reads as one app, not five web forms.
 */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  className,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  useLightCanvas();

  return (
    <div className="rizz-auth-shell min-h-dvh bg-white text-[#15151a] lg:bg-[#f1efe8]">
      <div className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col bg-white px-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-[calc(env(safe-area-inset-top,0px)+18px)] sm:px-8 lg:my-6 lg:min-h-[calc(100dvh-3rem)] lg:rounded-[34px] lg:border lg:border-[#e6e2d8] lg:shadow-[0_40px_120px_-60px_rgba(20,20,20,0.45)]">
        <header className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2" aria-label="RIZZ home">
            <img src="/brand/rizz-cat-logo.svg" alt="" className="h-7 w-7 shrink-0" />
            <span className="font-display text-[17px] font-extrabold tracking-[-0.03em] text-[#15151a]">
              RIZZ
            </span>
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ebe8df] bg-[#f7f6f2] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#7b786f]">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            Secure
          </span>
        </header>

        <div className="flex flex-1 flex-col justify-center py-7">
          <h1 className="max-w-[380px] font-display text-[2.35rem] font-extrabold leading-[0.98] tracking-[-0.045em] text-[#111110]">
            {title}
          </h1>
          <p className="mt-2.5 max-w-[350px] text-[14px] leading-relaxed text-[#6f6c64]">
            {subtitle}
          </p>
          <div className={cn("mt-7", className)}>{children}</div>
        </div>

        {footer && (
          <div className="border-t border-[#efede6] pt-5 text-[13px] leading-relaxed text-[#6f6c64]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
