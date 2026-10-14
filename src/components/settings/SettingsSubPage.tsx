import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export function SettingsSubPage({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-xl space-y-5">
      <Link
        to="/settings"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Settings
      </Link>

      <header className="flex items-start gap-3">
        {icon && (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </header>

      {children}
    </div>
  );
}

export function SettingsCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`glass rounded-3xl border border-white/5 p-5 ${className}`}>{children}</section>
  );
}
