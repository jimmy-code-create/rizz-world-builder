import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  DEFAULT_NOTIFICATION_PREFS,
  disablePushNotifications,
  enablePushNotifications,
  saveNotificationPrefs,
  sendTestPush,
  type NotificationPrefs,
} from "@/lib/push";
import { toast } from "sonner";

export function PushNotificationSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<"enable" | "disable" | "test" | null>(null);
  const prefsKey = ["notification-prefs", user?.id] as const;
  const subscriptionKey = ["push-subscriptions", user?.id] as const;
  const prefsQuery = useQuery({
    queryKey: prefsKey,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("notification_prefs")
        .select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return {
        user_id: user!.id,
        ...DEFAULT_NOTIFICATION_PREFS,
        ...(data ?? {}),
      } as NotificationPrefs;
    },
  });
  const subscriptionQuery = useQuery({
    queryKey: subscriptionKey,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("push_subscriptions")
        .select("id, endpoint").eq("user_id", user!.id);
      if (error) throw error;
      return data as { id: string; endpoint: string }[];
    },
  });
  const prefs = prefsQuery.data;
  const supported = typeof window !== "undefined"
    && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const patchPrefs = async (patch: Partial<NotificationPrefs>) => {
    if (!user || !prefs) return;
    const next = { ...prefs, ...patch, user_id: user.id };
    queryClient.setQueryData(prefsKey, next);
    try {
      await saveNotificationPrefs(next);
    } catch (error) {
      queryClient.setQueryData(prefsKey, prefs);
      toast.error(error instanceof Error ? error.message : "Couldn't save notification settings");
    }
  };

  const withBusy = async (action: "enable" | "disable" | "test", task: () => Promise<unknown>) => {
    setBusy(action);
    try {
      await task();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: subscriptionKey }),
        queryClient.invalidateQueries({ queryKey: prefsKey }),
      ]);
      if (action === "enable") toast.success("Push notifications enabled on this device");
      if (action === "disable") toast.success("Push notifications disabled on this device");
      if (action === "test") toast.success("Test notification sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Notification action failed");
    } finally {
      setBusy(null);
    }
  };

  if (!user) return null;
  const hasSubscription = (subscriptionQuery.data ?? []).length > 0;
  const setupMissing = prefsQuery.isError || subscriptionQuery.isError;

  return (
    <section className="glass rounded-3xl border border-white/5 p-5 space-y-5">
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 h-5 w-5 text-[var(--rizz-pink)]" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold">Push notifications</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Manage message and call alerts for your devices. Quiet hours use your local time.
          </p>
        </div>
      </div>

      {!supported ? (
        <p className="rounded-xl border border-white/10 p-3 text-sm text-muted-foreground">
          Web push is not supported in this browser. Try installing RIZZ or opening it in a supported browser.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {hasSubscription ? (
            <>
              <Button
                variant="outline"
                className="glass border-white/10"
                disabled={busy !== null}
                onClick={() => void withBusy("disable", () => disablePushNotifications(user.id))}
              >
                {busy === "disable" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellOff className="mr-2 h-4 w-4" />}
                Disable on this device
              </Button>
              <Button
                variant="outline"
                className="glass border-white/10"
                disabled={busy !== null}
                onClick={() => void withBusy("test", sendTestPush)}
              >
                {busy === "test" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send test
              </Button>
            </>
          ) : (
            <Button
              className="bg-gradient-primary border-0"
              disabled={busy !== null || setupMissing}
              onClick={() => void withBusy("enable", () => enablePushNotifications(user.id))}
            >
              {busy === "enable" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
              Enable on this device
            </Button>
          )}
          {hasSubscription && <span className="text-xs text-emerald-400">Enabled on {subscriptionQuery.data?.length} device(s)</span>}
        </div>
      )}

      {setupMissing && (
        <p className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-100">
          Notification tables are not available yet. Apply <code>10_push.sql</code> in Lovable and configure the Worker before enabling push.
        </p>
      )}

      {prefs && !prefsQuery.isError && (
        <div className="space-y-4 border-t border-white/10 pt-4">
          <PrefRow label="Direct messages" checked={prefs.dms} onChange={(dms) => void patchPrefs({ dms })} />
          <PrefRow label="Calls" checked={prefs.calls} onChange={(calls) => void patchPrefs({ calls })} />
          <PrefRow label="Group mentions" checked={prefs.group_mentions} onChange={(group_mentions) => void patchPrefs({ group_mentions })} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Quiet hours start</Label>
              <input
                type="time"
                value={prefs.quiet_start?.slice(0, 5) ?? ""}
                onChange={(event) => void patchPrefs({ quiet_start: event.target.value ? `${event.target.value}:00` : null })}
                className="mt-1 w-full rounded-xl border border-white/10 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Quiet hours end</Label>
              <input
                type="time"
                value={prefs.quiet_end?.slice(0, 5) ?? ""}
                onChange={(event) => void patchPrefs({ quiet_end: event.target.value ? `${event.target.value}:00` : null })}
                className="mt-1 w-full rounded-xl border border-white/10 bg-transparent px-3 py-2 text-sm"
              />
            </div>
          </div>
          {(prefs.quiet_start && !prefs.quiet_end) || (!prefs.quiet_start && prefs.quiet_end) ? (
            <p className="text-[11px] text-amber-200">Set both quiet-hour times, or clear both to turn quiet hours off.</p>
          ) : null}
          {prefs.muted_conversations.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Muted conversations</Label>
              {prefs.muted_conversations.map((conversationId) => (
                <div key={conversationId} className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-xs">{conversationId}</span>
                  <button
                    type="button"
                    className="text-xs text-[var(--rizz-pink)]"
                    onClick={() => void patchPrefs({
                      muted_conversations: prefs.muted_conversations.filter((id) => id !== conversationId),
                    })}
                  >
                    Unmute
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {prefsQuery.isLoading && <p className="text-xs text-muted-foreground">Loading notification preferences…</p>}
    </section>
  );
}

function PrefRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-sm font-medium">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}