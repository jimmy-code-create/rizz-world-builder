import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, Info, LoaderCircle, XCircle } from "lucide-react";

/**
 * The one toast card for the whole app (see src/lib/toast.tsx for the API).
 *
 * It is deliberately a quiet pill, not a banner: a toast is a receipt for
 * something the person just did, and the app should still look like the app
 * while it is on screen. So there is no accent rail, no icon medallion and no
 * full-bleed glass sheet — just a compact ink pill (content-width, centred), a
 * 6px dot in the type's colour and one line of text. Errors are the only type
 * that earns a glyph as well, because "did that fail?" is worth a glance.
 *
 * Behaviour that lives here rather than in sonner:
 * - the auto-dismiss countdown, so it can pause while the card is pressed or
 *   focused (2.2s, or 5s when there is an action),
 * - tap anywhere on the card to dismiss,
 * - the optional action button ("Retry", "Undo", ...).
 * Swiping, stacking (max 2 at the host) and enter/exit motion are sonner's.
 *
 * The card is a pill while its sentence fits and grows a second line when it
 * does not. It used to truncate both spans (`truncate` plus a hard 46% cap on
 * the message), so a receipt like "Cancelled — 10 Paws fee / 90 Paws came back"
 * was cut in half and the numbers — the point of the toast — went first.
 */

export type GlassToastType = "success" | "error" | "info" | "warning" | "loading";

export type GlassToastAction = { label: string; onClick: () => void };

type TypeStyle = { accent: string; icon: ReactNode | null };

const TYPE_STYLES: Record<GlassToastType, TypeStyle> = {
  success: { accent: "#c8ff3d", icon: null },
  // The one type that keeps a glyph: a failed action needs an unmistakable mark.
  error: { accent: "#ff6a55", icon: <XCircle aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.4} /> },
  info: { accent: "#7dd3fc", icon: null },
  warning: { accent: "#ffc457", icon: null },
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

  const glyph = icon ?? style.icon;

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "error" ? "assertive" : "polite"}
      data-toast-type={type}
      className="pointer-events-auto relative mx-auto flex w-fit max-w-[min(23rem,calc(100vw-1.5rem))] cursor-default touch-pan-y flex-wrap items-center gap-x-2 gap-y-1 rounded-[20px] border border-white/[0.09] bg-[#111113]/92 py-2 pl-3 pr-3.5 shadow-[0_10px_30px_-16px_rgba(0,0,0,0.9)] backdrop-blur-md"
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
      {glyph ? (
        <span aria-hidden="true" className="grid h-4 w-4 shrink-0 place-items-center" style={{ color: style.accent }}>
          {glyph}
        </span>
      ) : (
        // A 6px dot says the same thing the old 24px medallion did, without
        // turning a two-word receipt into an alert card.
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: style.accent, boxShadow: `0 0 6px ${style.accent}66` }}
        />
      )}
      <span className="min-w-0 text-[12.5px] font-semibold leading-snug text-[#f2efe6] [overflow-wrap:anywhere]">
        {title}
      </span>
      {message ? (
        // `flex-1` lets the sentence take the rest of the line it lands on; when
        // it cannot share the title's line it wraps below, indented past the dot.
        <span className="min-w-[7rem] flex-1 text-[11.5px] font-medium leading-snug text-white/55 [overflow-wrap:anywhere]">
          {message}
        </span>
      ) : null}
      {action ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            action.onClick();
            onCloseRef.current();
          }}
          className="ml-0.5 min-h-7 shrink-0 rounded-full bg-[#c8ff3d] px-2.5 text-[11.5px] font-bold text-[#0b0b0c] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c8ff3d]"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
