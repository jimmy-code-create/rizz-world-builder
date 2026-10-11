import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { PushNotificationSettings } from "@/components/PushNotificationSettings";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_app/settings/notifications")({
  head: () => ({ meta: [{ title: "Notifications · Settings · RIZZ" }] }),
  component: NotificationsSettingsPage,
});

function NotificationsSettingsPage() {
  return (
    <SettingsSubPage
      title="Notifications"
      description="Control which alerts reach this device."
      icon={<Bell className="h-5 w-5" />}
    >
      <PushNotificationSettings />
    </SettingsSubPage>
  );
}
