import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children in a true full-screen layer attached to <body>.
 *
 * The app shell's <main> has its own stacking context (`relative z-10`), so a
 * `fixed inset-0 z-50` overlay rendered inside it still sits *below* the
 * mobile bottom nav and top header. Portalling to body fixes that and also
 * locks background scroll while open.
 */
export function FullScreenLayer({ open, children }: { open: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!mounted || !open) return null;
  return createPortal(children, document.body);
}