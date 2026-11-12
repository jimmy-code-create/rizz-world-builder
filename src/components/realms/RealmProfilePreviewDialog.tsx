import { ProfilePreviewDialog } from "@/components/ProfilePreview";
import type { ProfileCardUser } from "@/components/profile/ProfileCard";

export type RealmProfilePreviewUser = ProfileCardUser & {
  username: string;
  accentColor?: string | null;
  botName?: string | null;
};

type Props = {
  user: RealmProfilePreviewUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMention?: (username: string) => void;
};

/**
 * Realm profile preview — the feed's preview, not a second design.
 *
 * Realms used to open the big ProfileCard while tapping the same person in the
 * feed opened the compact preview sheet, so one user looked like two different
 * people depending on where you found them. Both now mount
 * `ProfilePreviewDialog`; realms hand it the id they already have, which makes
 * the sheet resolve even when the name shown is a display name.
 */
export function RealmProfilePreviewDialog({ user, open, onOpenChange }: Props) {
  const username = user?.username ?? "";
  return (
    <ProfilePreviewDialog
      username={username}
      userId={user?.userId ?? undefined}
      open={open && Boolean(username || user?.userId)}
      onOpenChange={onOpenChange}
    />
  );
}
