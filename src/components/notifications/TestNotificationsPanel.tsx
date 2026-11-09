"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Bell, Play, Volume2, Vibrate, Phone, ShieldAlert, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  dispatchInAppNotification,
  type InAppNotification,
} from "@/components/notifications/RizzInAppPill";
import { playNotificationPing } from "@/lib/notification-sound";
import { haptic } from "@/lib/haptics";
import { sendTestPush } from "@/lib/push";
import {
  aggregateNotifications,
  type AggregatedCard,
  exampleSingle,
  exampleTwo,
  exampleThree,
  exampleFifteen,
  exampleThirteenHourGap,
} from "@/lib/notifications-aggregation";

const DEV_ONLY = import.meta.env.DEV === true;
const PROD_FLAG =
  typeof import.meta.env !== "undefined" &&
  (import.meta.env as Record<string, string | undefined>)["VITE_ENABLE_NOTIF_TEST"] === "1";

export function TestNotificationsPanel() {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const lastFireRef = useRef<Record<string, number>>({});

  const log = useCallback((message: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev].slice(0, 50));
  }, []);

  const rateLimited = useCallback((key: string): boolean => {
    const now = Date.now();
    const last = lastFireRef.current[key] ?? 0;
    if (now - last < 1000) return true;
    lastFireRef.current[key] = now;
    return false;
  }, []);

  // ------------------------------------------------------------------
  // Status readout
  // ------------------------------------------------------------------
  const [status, setStatus] = useMemo(() => {
    const s: Record<string, string> = {
      permission: typeof Notification !== "undefined" ? Notification.permission : "unknown",
      sw: "checking…",
      subscription: "none",
      pwa: "no",
      audio: "unknown",
      vibrate: typeof navigator !== "undefined" && typeof navigator.vibrate === "function" ? "yes" : "no",
    };
    return s;
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        setStatus((prev) => ({ ...prev, sw: registration ? "active" : "not registered" }));
        if (registration) {
          const sub = await registration.pushManager.getSubscription();
          setStatus((prev) => ({
            ...prev,
            subscription: sub ? `endpoint: ${sub.endpoint.slice(0, 60)}…` : "none",
          }));
        }
      } catch {
        setStatus((prev) => ({ ...prev, sw: "error" }));
      }
      try {
        setStatus((prev) => ({
          ...prev,
          pwa: window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone ? "yes" : "no",
        }));
      } catch {}
      try {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        setStatus((prev) => ({
          ...prev,
          audio: Ctor ? "supported" : "not supported",
        }));
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ------------------------------------------------------------------
  // In-app pill tests
  // ------------------------------------------------------------------
  const firePill = useCallback(
    (type: InAppNotification["type"], overrides: Partial<InAppNotification> = {}) => {
      if (rateLimited("pill")) {
        log("Pill test rate-limited (1/s).");
        return;
      }
      const notification: InAppNotification = {
        id: `test-${Date.now()}`,
        type,
        actor: "alice",
        body: `This is a ${type} test notification.`,
        target_url: "/feed",
        avatar_url: null,
        created_at: new Date().toISOString(),
        is_test: true,
        ...overrides,
      };
      dispatchInAppNotification(notification);
      log(`In-app pill fired: ${type}`);
    },
    [log, rateLimited],
  );

  const fireFive = useCallback(() => {
    if (rateLimited("five")) {
      log("Fire-5 rate-limited (1/s).");
      return;
    }
    const types: InAppNotification["type"][] = ["dm", "mention", "reaction", "paws_gift", "voice_room"];
    types.forEach((type, index) => {
      setTimeout(() => {
        dispatchInAppNotification({
          id: `test-five-${index}-${Date.now()}`,
          type,
          actor: `user${index}`,
          body: `Queued pill ${index + 1} of 5 (${type}).`,
          target_url: "/feed",
          avatar_url: null,
          created_at: new Date().toISOString(),
          is_test: true,
        });
      }, index * 600);
    });
    log("Fired 5 pills at once (queue + sound throttle test).");
  }, [log, rateLimited]);

  // ------------------------------------------------------------------
  // Sound + haptic
  // ------------------------------------------------------------------
  const audioCtxRef = useRef<AudioContext | null>(null);

  const resumeAudio = useCallback(() => {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    if (!audioCtxRef.current) audioCtxRef.current = new Ctor();
    if (audioCtxRef.current.state === "suspended") {
      void audioCtxRef.current.resume();
    }
  }, []);

  const playSound = useCallback(() => {
    if (rateLimited("sound")) {
      log("Sound test rate-limited (1/s).");
      return;
    }
    resumeAudio();
    playNotificationPing();
    log("Notification ping played.");
  }, [rateLimited, resumeAudio, playNotificationPing]);

  const playHaptic = useCallback(() => {
    if (rateLimited("haptic")) {
      log("Haptic test rate-limited (1/s).");
      return;
    }
    haptic("heavy");
    log("Haptic (heavy) played.");
  }, [rateLimited]);

  // ------------------------------------------------------------------
  // OS notification tests
  // ------------------------------------------------------------------
  const [osCountdown, setOsCountdown] = useState<number | null>(null);
  const osTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendOsNotification = useCallback(
    async (tag: string, delayMs: number) => {
      if (rateLimited("os")) {
        log("OS notification rate-limited (1/s).");
        return;
      }
      if (Notification.permission !== "granted") {
        log("OS notifications not permitted.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      if (delayMs > 0) {
        setOsCountdown(delayMs / 1000);
        const tick = setInterval(() => {
          setOsCountdown((prev) => {
            const next = prev - 1;
            if (next <= 0) {
              clearInterval(tick);
              osTimerRef.current = null;
              return null;
            }
            return next;
          });
        }, 1000);
        osTimerRef.current = setTimeout(() => {
          clearInterval(tick);
          setOsCountdown(null);
          void registration.showNotification("RIZZ test", {
            body: "Delayed OS notification delivered.",
            tag,
            renotify: true,
            data: { url: "/settings", type: "test" },
          });
          log(`OS notification sent (tag: ${tag}) after ${delayMs / 1000}s.`);
        }, delayMs);
        log(`OS notification scheduled in ${delayMs / 1000}s (tag: ${tag}).`);
        return;
      }
      await registration.showNotification("RIZZ test", {
        body: "OS notification delivered now.",
        tag,
        renotify: true,
        data: { url: "/settings", type: "test" },
      });
      log(`OS notification sent now (tag: ${tag}).`);
    },
    [log, rateLimited],
  );

  const sendSameTagTwice = useCallback(async () => {
    if (rateLimited("os")) {
      log("OS notification rate-limited (1/s).");
      return;
    }
    if (Notification.permission !== "granted") {
      log("OS notifications not permitted.");
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification("RIZZ test", {
      body: "First with same tag.",
      tag: "rizz-same-tag",
      renotify: true,
      data: { url: "/settings", type: "test" },
    });
    setTimeout(async () => {
      await registration.showNotification("RIZZ test", {
        body: "Second replaces first (no stack).",
        tag: "rizz-same-tag",
        renotify: true,
        data: { url: "/settings", type: "test" },
      });
      log("Sent same tag twice — second should replace, not stack.");
    }, 800);
  }, [log, rateLimited]);

  // ------------------------------------------------------------------
  // Real push round-trip (own subscription only)
  // ------------------------------------------------------------------
  const [pushBusy, setPushBusy] = useState(false);
  const sendRealPush = useCallback(async () => {
    if (rateLimited("push")) {
      log("Real push rate-limited (1/s).");
      return;
    }
    setPushBusy(true);
    try {
      await sendTestPush();
      log("Real test push sent to your own subscription.");
    } catch (error) {
      log(`Real push failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPushBusy(false);
    }
  }, [log, rateLimited]);

  // ------------------------------------------------------------------
  // Grouping preview (real aggregation, sample data, rendered in-sheet only)
  // ------------------------------------------------------------------
  const [groupingResults, setGroupingResults] = useState<Record<string, AggregatedCard[]>>({});
  const runGrouping = useCallback((label: string, events: typeof exampleSingle) => {
    if (rateLimited("group")) {
      log("Grouping preview rate-limited (1/s).");
      return;
    }
    const now = Date.now();
    const cards = aggregateNotifications(events, now, "reacted to your post");
    setGroupingResults((prev) => ({ ...prev, [label]: cards }));
    log(`Grouping preview: ${label} → ${cards.length} card(s).`);
  }, [log, rateLimited]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  const showPanel = DEV_ONLY || PROD_FLAG;
  if (!showPanel) return null;

  const permissionDenied = status.permission === "denied";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-6 flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left text-xs text-muted-foreground hover:bg-white/[0.04]"
      >
        <span className="flex items-center gap-1.5">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          Test notifications
        </span>
        <Badge variant="outline" className="text-[10px]">
          {DEV_ONLY ? "dev" : "flag"}
        </Badge>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="border-border bg-card rounded-t-3xl max-h-[90dvh] overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
        >
          <SheetHeader className="text-left pt-2 pr-8">
            <div className="flex items-center justify-between gap-3">
              <SheetTitle className="font-display text-xl">Test notifications</SheetTitle>
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
              >
                {expanded ? "Collapse" : "Expand"}
              </button>
            </div>
            <SheetDescription>
              Dev-only safety panel. Everything here carries <code>is_test</code>: nothing is written to the
              database, nothing counts toward the unread badge, nothing reaches other users. Rate-limited to 1 per second.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 pt-2">
            {/* 1. Status readout */}
            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status readout</h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Notification permission</span>
                  <span className={`monospace text-[10px] ${cn({ "text-destructive": permissionDenied, "text-emerald-400": status.permission === "granted" }) }`}>
                    {status.permission}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Service worker</span>
                  <span className="monospace text-[10px]">{status.sw}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Push subscription</span>
                  <span className="monospace text-[10px] truncate max-w-[180px]">{status.subscription}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Standalone / PWA</span>
                  <span className="monospace text-[10px]">{status.pwa}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">AudioContext</span>
                  <span className="monospace text-[10px]">{status.audio}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Vibration</span>
                  <span className="monospace text-[10px]">{status.vibrate}</span>
                </div>
              </div>
            </section>

            {/* 2. Permission */}
            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Permission</h3>
              <Button
                onClick={async () => {
                  if (rateLimited("perm")) return;
                  try {
                    const result = await Notification.requestPermission();
                    setStatus((prev) => ({ ...prev, permission: result }));
                    log(`Notification permission: ${result}`);
                    if (result === "denied") log("Permission denied — OS notifications will not arrive.");
                  } catch (error) {
                    log(`Permission request failed: ${error instanceof Error ? error.message : String(error)}`);
                  }
                }}
                disabled={pushBusy || permissionDenied}
                className="w-full text-xs"
              >
                {permissionDenied ? (
                  <>
                    <AlertCircle className="mr-2 h-3.5 w-3.5" /> Denied — enable in browser settings
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-3.5 w-3.5" /> Request permission
                  </>
                )}
              </Button>
              {permissionDenied && (
                <p className="text-[11px] text-destructive">
                  OS notifications are denied on this device. In-app pills still work.
                </p>
              )}
            </section>

            {/* 3. In-app pill tests */}
            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">In-app pill</h3>
              <p className="text-[11px] text-muted-foreground">Fires a pill via the same bridge the service worker uses.</p>
              <div className="grid grid-cols-2 gap-2">
                {[ "dm", "mention", "reaction", "paws_gift", "voice_room" ] as const].map((type) => (
                  <Button
                    key={type}
                    onClick={() => firePill(type)}
                    className="w-full min-h-[36px] text-[11px] justify-between"
                  >
                    {type}
                    <Bell className="ml-1 h-3.5 w-3.5" />
                  </Button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button onClick={fireFive} className="w-full text-[11px]" size="sm">
                  Fire 5 at once
                </Button>
                <Button onClick={() => firePill("dm", { body: "This is a very long body that should truncate gracefully within the pill so the layout never breaks no matter how long the message text happens to be.", target_url: "/notifications" })} className="w-full text-[11px]" size="sm">
                  Long text
                </Button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button onClick={() => firePill("mention", { actor: null, body: "A notification with no actor avatar — the fallback initial should show.", target_url: "/dm/me" })} className="w-full text-[11px]" size="sm">
                  No avatar
                </Button>
              </div>
            </section>

            {/* 4. Sound + haptic */}
            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sound &amp; haptic</h3>
              <p className="text-[11px] text-muted-foreground">Taps resume the AudioContext (autoplay policy). Chime throttled 1.5s.</p>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={playSound} disabled={pushBusy} className="w-full text-[11px]" size="sm">
                  <Volume2 className="mr-1.5 h-3.5 w-3.5" /> Sound
                </Button>
                <Button onClick={playHaptic} disabled={pushBusy} className="w-full text-[11px]" size="sm">
                  <Vibrate className="mr-1.5 h-3.5 w-3.5" /> Haptic
                </Button>
              </div>
            </section>

            {/* 5. OS notification tests */}
            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">OS notification</h3>
              <p className="text-[11px] text-muted-foreground">Uses registration.showNotification with real tags, actions, deep link.</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => void sendOsNotification("rizz-os-now", 0)}
                  disabled={pushBusy || osCountdown !== null || permissionDenied}
                  className="w-full text-[11px]" size="sm"
                >
                  Send now
                </Button>
                <Button
                  onClick={() => void sendOsNotification("rizz-os-later", 5000)}
                  disabled={pushBusy || osCountdown !== null || permissionDenied}
                  className="w-full text-[11px]" size="sm"
                >
                  {osCountdown !== null ? `Send in ${osCountdown}s…` : "Send in 5s"}
                </Button>
                <Button
                  onClick={sendSameTagTwice}
                  disabled={pushBusy || osCountdown !== null || permissionDenied}
                  className="w-full text-[11px]" size="sm"
                >
                  Same tag twice
                </Button>
              </div>
              {osCountdown !== null && (
                <p className="text-[11px] text-muted-foreground">Lock the screen or background the app — the delayed notification should still arrive.</p>
              )}
            </section>

            {/* 6. Real push round-trip */}
            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Real push round-trip</h3>
              <p className="text-[11px] text-muted-foreground">Calls the existing send-push backend ({sendTestPush.name}) to your own subscription only.</p>
              <Button
                onClick={sendRealPush}
                disabled={pushBusy || status.subscription === "none" || permissionDenied}
                className="w-full text-[11px]" size="sm"
              >
                {pushBusy ? (
                  <>
                    <Play className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    <Phone className="mr-1.5 h-3.5 w-3.5" /> Send test push to me
                  </>
                )}
              </Button>
              {status.subscription === "none" && (
                <p className="text-[11px] text-muted-foreground">No push subscription — enable push in Settings first.</p>
              )}
              {permissionDenied && (
                <p className="text-[11px] text-destructive">Permission denied — push cannot be sent.</p>
              )}
            </section>

            {/* 7. Grouping preview */}
            {expanded && (
              <section className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Grouping preview</h3>
                <p className="text-[11px] text-muted-foreground">Real aggregation on sample data — rendered here only, never in the real feed.</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <Button onClick={() => runGrouping("1 reaction", exampleSingle())} className="w-full text-[10px]" size="sm">1</Button>
                  <Button onClick={() => runGrouping("2 reactions", exampleTwo())} className="w-full text-[10px]" size="sm">2</Button>
                  <Button onClick={() => runGrouping("3 reactions", exampleThree())} className="w-full text-[10px]" size="sm">3</Button>
                  <Button onClick={() => runGrouping("15 reactions", exampleFifteen())} className="w-full text-[10px]" size="sm">15</Button>
                  <Button onClick={() => runGrouping("13h gap", exampleThirteenHourGap())} className="w-full text-[10px]" size="sm">13h gap</Button>
                </div>
                <div className="space-y-1.5">
                  {Object.entries(groupingResults).map(([label, cards]) => (
                    <div key={label} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold">{label}</span>
                        <span className="text-[10px] text-muted-foreground">{cards.length} card{cards.length === 1 ? "" : "s"}</span>
                      </div>
                      {cards.map((card) => (
                        <div key={card.id} className="text-[11px] text-foreground truncate">{card.summary}</div>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Log */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 max-h-48 overflow-y-auto">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Test log</h3>
              <div className="space-y-1 text-[10px] text-muted-foreground font-mono">
                {logs.map((line, index) => (
                  <div key={index} className="truncate">
                    {line}
                  </div>
                ))}
                {logs.length === 0 && <span className="text-[10px]">(no activity yet)</span>}
              </div>
            </div>
          </div>

          <SheetFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm text-muted-foreground hover:bg-white/[0.04]"
            >
              <X className="h-4 w-4" /> Close
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
