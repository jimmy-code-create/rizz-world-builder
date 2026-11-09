import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { PushNotificationSettings } from "@/components/PushNotificationSettings";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_app/settings/notifications")({
  head: () => ({ meta: [{ title: "Notifications · Settings · RIZZ" }] }),
  component: NotificationsSettingsPage,
});

function NotificationsSettingsPage() {
  const { t } = useI18n();
  return (
    <SettingsSubPage
      title={t("notifications")}
      description={t("notif_page_desc")}
      icon={<Bell className="h-5 w-5" />}
    >
      <PushNotificationSettings />
    </SettingsSubPage>
  );
}
