import { ProfileCardDialog, type ProfileCardUser } from "@/components/profile/ProfileCard";

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
 * Realm profile preview — now a thin wrapper over the shared <ProfileCard>
 * so realm chat, comments, member lists, voice rooms and DMs all show the
 * same card (same profile + presence store as the profile page).
 */
export function RealmProfilePreviewDialog({ user: targetUser, open, onOpenChange, onMention }: Props) {
  return <ProfileCardDialog user={targetUser} open={open} onOpenChange={onOpenChange} onMention={onMention} />;
}
