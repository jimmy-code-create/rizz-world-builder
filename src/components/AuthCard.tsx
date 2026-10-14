import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The one card the whole auth flow wears.
 *
 * Solid surface, 1px hairline, tight radius, no glow halo, no frosted glass and
 * no gradient. Sign-up, log-in, password reset and the onboarding steps all
 * render through here, so they restyle together and the flow looks like one
 * screen repeated, not three different designs.
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
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 inline-flex items-center gap-2.5" aria-label="RIZZ home">
          <img src="/brand/rizz-cat-logo.svg" alt="" className="h-7 w-7 shrink-0" />
          <span className="font-display text-lg font-bold tracking-tight">RIZZ</span>
        </Link>
        <div
          className={cn(
            "rounded-[10px] border border-border bg-card p-6 shadow-[var(--shadow-1)] sm:p-8",
            className,
          )}
        >
          <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}
