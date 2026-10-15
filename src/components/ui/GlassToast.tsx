import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, Info, LoaderCircle, XCircle } from "lucide-react";

/**
 * The one toast card for the whole app (see src/lib/toast.tsx for the API).
 *
 * Glass on purpose: translucent dark fill + blur, a 16px radius and a coloured
 * accent rail on the leading edge, so the type reads at a glance without the
 * card fighting whatever is behind it.
 *
 * Behaviour that lives here rather than in sonner:
 * - the auto-dismiss countdown, so it can pause while the card is pressed or
 *   focused (3.5s, or 5s when there is an action),
 * - tap anywhere on the card to dismiss,
 * - the optional action button ("Retry", "Undo", ...).
 * Swiping, stacking (max 3 at the host) and enter/exit motion are sonner's.
 */

export type GlassToastType = "success" | "error" | "info" | "warning" | "loading";

export type GlassToastAction = { label: string; onClick: () => void };

type TypeStyle = { accent: string; icon: ReactNode };

const TYPE_STYLES: Record<GlassToastType, TypeStyle> = {
  success: { accent: "#c8ff3d", icon: <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.6} /> },
  error: { accent: "#ff6a55", icon: <XCircle aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.4} /> },
  info: { accent: "#7dd3fc", icon: <Info aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.4} /> },
  warning: { accent: "#ffc457", icon: <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.4} /> },
  loading: { accent: "#c8ff3d", icon: <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" strokeWidth={2.4} /> },
};

export function GlassToast({
  type,
  title,
  message,
  action,
  icon,
  duration,
  onClose,
}: {
  type: GlassToastType;
  title: string;
  message?: string;
  action?: GlassToastAction;
  /** Optional custom glyph replacing the type icon. */
  icon?: ReactNode;
  /** Milliseconds until auto-dismiss; Infinity keeps it until dismissed. */
  duration: number;
  onClose: () => void;
}) {
  const style = TYPE_STYLES[type];
  const [pressed, setPressed] = useState(false);
  const remaining = useRef(duration);
  const startedAt = useRef(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!Number.isFinite(duration)) return;
    if (pressed) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => onCloseRef.current(), Math.max(0, remaining.current));
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    };
  }, [pressed, duration]);

  const pause = () => setPressed(true);
  const resume = () => setPressed(false);

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "error" ? "assertive" : "polite"}
      data-toast-type={type}
      className="pointer-events-auto relative flex w-full cursor-default touch-pan-y items-start gap-3 overflow-hidden rounded-2xl border border-white/[0.12] bg-[#141416]/85 py-3 pl-4 pr-3 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.85)] backdrop-blur-xl"
      onPointerDown={pause}
      onPointerUp={resume}
      onPointerCancel={resume}
      onPointerLeave={resume}
      onFocusCapture={pause}
      onBlurCapture={resume}
      onClick={(event) => {
        // Buttons and links inside the card keep their own behaviour.
        if ((event.target as HTMLElement).closest("button, a")) return;
        onCloseRef.current();
      }}
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: style.accent }} />
      <span
        aria-hidden="true"
        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full"
        style={{ color: style.accent, backgroundColor: `${style.accent}22` }}
      >
        {icon ?? style.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-snug text-[#f2efe6] [overflow-wrap:anywhere]">{title}</p>
        {message ? <p className="mt-0.5 text-xs leading-snug text-white/60 [overflow-wrap:anywhere]">{message}</p> : null}
      </div>
      {action ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            action.onClick();
            onCloseRef.current();
          }}
          className="min-h-8 shrink-0 rounded-full bg-[#c8ff3d] px-3 py-1.5 text-[12px] font-bold text-[#0b0b0c] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c8ff3d]"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
