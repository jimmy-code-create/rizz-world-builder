import { useEffect, useState } from "react";
import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export type AuthErrorKind = "network" | "credentials" | "rate_limit" | "unknown";

export function classifyAuthError(message: string | undefined | null): AuthErrorKind {
  const m = (message ?? "").toLowerCase();
  if (!m) return "unknown";
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed") || m.includes("network request failed")) return "network";
  if (m.includes("rate") || m.includes("too many")) return "rate_limit";
  if (m.includes("invalid") || m.includes("credentials") || m.includes("password")) return "credentials";
  return "unknown";
}

const COPY: Record<AuthErrorKind, { title: string; body: string; hint: string; icon: typeof AlertCircle }> = {
  network: {
    title: "Can't reach RIZZ right now",
    body: "Your device sent the request, but our servers didn't answer. This usually clears up in under a minute — the backend may be waking up.",
    hint: "Auto-retrying",
    icon: WifiOff,
  },
  rate_limit: {
    title: "Whoa, slow down",
    body: "Too many attempts in a short window. Wait a moment before trying again.",
    hint: "Retry available in",
    icon: AlertCircle,
  },
  credentials: {
    title: "That didn't match",
    body: "Double-check your email and password. If you signed up with Google, use the Google button instead.",
    hint: "",
    icon: AlertCircle,
  },
  unknown: {
    title: "Something went sideways",
    body: "We hit an unexpected snag. Try again — if it keeps happening, refresh the page.",
    hint: "",
    icon: AlertCircle,
  },
};

export function AuthErrorBanner({
  kind,
  rawMessage,
  onRetry,
  retryLabel = "Try again",
  autoRetrySeconds,
}: {
  kind: AuthErrorKind;
  rawMessage?: string;
  onRetry: () => void | Promise<void>;
  retryLabel?: string;
  /** For network/rate_limit: countdown before auto-retry (or before manual retry re-enables). */
  autoRetrySeconds?: number;
}) {
  const config = COPY[kind];
  const Icon = config.icon;
  const usesCountdown = kind === "network" || kind === "rate_limit";
  const initial = autoRetrySeconds ?? (kind === "network" ? 15 : kind === "rate_limit" ? 30 : 0);
  const [seconds, setSeconds] = useState(initial);

  useEffect(() => {
    setSeconds(initial);
  }, [kind, initial]);

  useEffect(() => {
    if (!usesCountdown || seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, usesCountdown]);

  useEffect(() => {
    if (kind === "network" && seconds === 0) {
      void onRetry();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, kind]);

  const disabled = usesCountdown && seconds > 0;

  return (
    <div
      role="alert"
      className="mb-4 rounded-2xl border border-[var(--rizz-pink)]/30 bg-[var(--rizz-pink)]/10 p-4 text-sm"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-[var(--rizz-pink)]/20 flex items-center justify-center">
          <Icon className="h-4 w-4 text-[var(--rizz-pink)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground">{config.title}</p>
          <p className="mt-1 text-muted-foreground">{config.body}</p>
          {usesCountdown && seconds > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {config.hint} in <span className="font-mono font-semibold text-foreground">{seconds}s</span>
              {kind === "network" ? "…" : ""}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => onRetry()}
              disabled={disabled}
              className="h-8 gap-1.5 bg-gradient-primary border-0 shadow-glow"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${disabled ? "" : ""}`} />
              {disabled ? `Retry in ${seconds}s` : retryLabel}
            </Button>
            {kind === "network" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 glass border-white/10"
                onClick={() => window.location.reload()}
              >
                Refresh page
              </Button>
            )}
          </div>
          {rawMessage && (
            <details className="mt-2 text-xs text-muted-foreground/70">
              <summary className="cursor-pointer select-none hover:text-muted-foreground">Technical detail</summary>
              <p className="mt-1 font-mono break-all">{rawMessage}</p>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}