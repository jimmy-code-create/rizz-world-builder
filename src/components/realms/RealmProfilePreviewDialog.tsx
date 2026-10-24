import { useEffect, useState } from "react";
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
 * Realm profile preview.
 *
 * Realm chat used to open its own card while the feed opened the profile sheet,
 * so the same person looked different depending on where you tapped them. It
 * now renders the shared <ProfilePreviewDialog> — the exact sheet the feed,
 * comments, notifications and reels use — and only adds the realm-only
 * "mention" action. The last user is kept while the sheet animates closed so
 * the panel doesn't disappear mid-animation when the parent clears its state.
 */
export function RealmProfilePreviewDialog({ user, open, onOpenChange, onMention }: Props) {
  const [last, setLast] = useState<RealmProfilePreviewUser | null>(user);
  useEffect(() => {
    if (user) setLast(user);
  }, [user]);

  const target = user ?? last;
  if (!target?.username) return null;

  return (
    <ProfilePreviewDialog
      username={target.username}
      open={open}
      onOpenChange={onOpenChange}
      onMention={onMention}
    />
  );
}
