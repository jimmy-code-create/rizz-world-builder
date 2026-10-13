type OnboardingProfile = {
  username: string | null;
  tutorial_seen: boolean;
} | null;

export function getPostAuthPath(profile: OnboardingProfile): "/claim" | "/tutorial" | "/feed" {
  if (!profile?.username) return "/claim";
  if (!profile.tutorial_seen) return "/tutorial";
  return "/feed";
}

/** The one place these keys are spelled out: login, signup and the join pages
 * all have to agree on them or a followed invite link is silently forgotten. */
export const PENDING_GROUP_INVITE_KEY = "rizz:pending-group-invite";
export const PENDING_REALM_INVITE_KEY = "rizz:pending-realm-invite";

/**
 * Where someone who followed an invite link should land after logging in.
 * A group link wins when both are pending; each join page clears its own key
 * once it has used it, so this never loops.
 */
export function getPendingInvitePath(): string | null {
  let group: string | null = null;
  let realm: string | null = null;
  try {
    group = window.sessionStorage.getItem(PENDING_GROUP_INVITE_KEY);
    realm = window.sessionStorage.getItem(PENDING_REALM_INVITE_KEY);
  } catch {
    // A blocked session store must not stop a normal login.
    return null;
  }
  if (group && /^[a-z0-9]{4,64}$/i.test(group)) return `/join/${encodeURIComponent(group)}`;
  if (realm && /^[a-z0-9]{4,64}$/i.test(realm)) return `/join-realm/${encodeURIComponent(realm)}`;
  return null;
}
