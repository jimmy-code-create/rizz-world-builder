import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shield } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { fetchBlocked, unblockUser } from "@/lib/social";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SettingsCard, SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_app/settings/blocked")({
  head: () => ({ meta: [{ title: "Blocked accounts · Settings · RIZZ" }] }),
  component: BlockedSettingsPage,
});

function BlockedSettingsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const blockedUsers = useQuery({
    queryKey: ["blocked-users", user?.id],
    queryFn: () => fetchBlocked(user!.id),
    enabled: !!user,
  });

  async function unblock(blockedId: string, username: string) {
    if (!user || unblockingId) return;
    setUnblockingId(blockedId);
    try {
      await unblockUser(user.id, blockedId);
      qc.setQueryData<any[]>(["blocked-users", user.id], (current = []) =>
        current.filter((entry) => entry.blocked_id !== blockedId),
      );
      void qc.invalidateQueries({ queryKey: ["blocked-users", user.id] });
      toast.success(`@${username} unblocked`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't unblock this user");
    } finally {
      setUnblockingId(null);
    }
  }

  return (
    <SettingsSubPage
      title="Blocked accounts"
      description={t("settings_blocked_page_desc")}
      icon={<Shield className="h-5 w-5" />}
    >
      <SettingsCard>
        {blockedUsers.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("loading_blocked")}</p>
        ) : blockedUsers.isError ? (
          <p className="text-sm text-destructive">{t("blocked_load_error")}: {blockedUsers.error.message}</p>
        ) : (blockedUsers.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty_blocked")}</p>
        ) : (
          <div className="space-y-2">
            {(blockedUsers.data ?? []).map((entry) => {
              const blockedProfile = entry.blocked;
              const username = blockedProfile?.username ?? "unknown";
              return (
                <div key={entry.blocked_id} className="flex items-center gap-3 rounded-xl border border-white/5 glass-strong p-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={blockedProfile?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">{username.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{blockedProfile?.display_name || `@${username}`}</p>
                    {blockedProfile?.display_name && <p className="truncate text-xs text-muted-foreground">@{username}</p>}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={unblockingId !== null}
                    onClick={() => void unblock(entry.blocked_id, username)}
                    className="border-white/10 glass"
                  >
                    {unblockingId === entry.blocked_id ? t("unblocking") : t("unblock")}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </SettingsCard>
    </SettingsSubPage>
  );
}
