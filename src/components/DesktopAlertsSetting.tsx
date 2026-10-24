import { useState } from "react";
import { BellRing, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import {
  desktopAlertPermission,
  desktopAlertsSupported,
  requestDesktopAlerts,
  showDesktopAlert,
  type DesktopAlertPermission,
} from "@/lib/desktop-notifications";

/**
 * Discord-style desktop alerts: a system pop-up whenever a DM lands while the
 * tab is hidden. Separate from Web Push on purpose — this needs no server key,
 * so every device can turn notifications on today.
 */
export function DesktopAlertsSetting() {
  const [permission, setPermission] = useState<DesktopAlertPermission>(() => desktopAlertPermission());
  const [busy, setBusy] = useState<"enable" | "test" | null>(null);
  const supported = desktopAlertsSupported();

  const enable = async () => {
    setBusy("enable");
    try {
      const next = await requestDesktopAlerts();
      setPermission(next);
      if (next === "granted") toast.success("Desktop alerts are on");
      else if (next === "denied") toast.error("Alerts are blocked — allow notifications for this site in your browser");
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    try {
      const shown = await showDesktopAlert({
        title: "RIZZ",
        body: "Desktop alerts are working. New DMs will pop up like this.",
        tag: "rizz-test",
        url: "/dms",
      });
      if (shown) toast.success("Test alert sent");
      else toast.error("Turn on desktop alerts first");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-4 rounded-3xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <BellRing className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-sm font-bold tracking-tight">Desktop alerts</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Discord-style pop-ups for new DMs while RIZZ is open in a background tab.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {permission === "granted" ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> On for this device
            </span>
            <Button size="sm" variant="secondary" onClick={test} disabled={busy !== null}>
              {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Test alert
            </Button>
          </>
        ) : permission === "denied" ? (
          <p className="text-xs text-muted-foreground">
            Blocked in your browser settings. Allow notifications for this site to turn them back on.
          </p>
        ) : !supported ? (
          <p className="text-xs text-muted-foreground">This browser can't show desktop alerts.</p>
        ) : (
          <Button size="sm" onClick={enable} disabled={busy !== null}>
            {busy === "enable" ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
            Turn on desktop alerts
          </Button>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Alerts only fire for conversations you have not muted, and they never cover the message
        you are already reading.
      </p>
    </section>
  );
}
