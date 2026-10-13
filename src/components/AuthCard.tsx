import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative min-h-dvh flex items-center justify-center px-4 py-12 overflow-hidden bg-background text-foreground">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-md"
      >
        <Link to="/" className="flex items-center gap-2.5 justify-center mb-6 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md p-1">
          <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-base">
            R
          </div>
          <span className="font-display text-xl font-bold tracking-tight">RIZZ</span>
        </Link>
        <div className="bg-card border border-border rounded-xl p-6 sm:p-8">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
      </motion.div>
    </div>
  );
}
