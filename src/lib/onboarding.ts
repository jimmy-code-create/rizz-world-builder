type OnboardingProfile = {
  username: string | null;
  tutorial_seen: boolean;
} | null;

export function getPostAuthPath(profile: OnboardingProfile): "/claim" | "/tutorial" | "/feed" {
  if (!profile?.username) return "/claim";
  if (!profile.tutorial_seen) return "/tutorial";
  return "/feed";
}

/**
 * A pending welcome tour. The flag lives in sessionStorage so a refresh in the
 * middle of onboarding brings the overlay back, while a finished tour never
 * flashes for an existing member.
 */
const TOUR_PENDING_PREFIX = "rizz:tour-pending:";

export function setTourPending(userId: string, pending: boolean) {
  try {
    if (pending) window.sessionStorage.setItem(`${TOUR_PENDING_PREFIX}${userId}`, "1");
    else window.sessionStorage.removeItem(`${TOUR_PENDING_PREFIX}${userId}`);
  } catch {
    // A blocked session store must not stop onboarding.
  }
}

export function hasTourPending(userId: string): boolean {
  try {
    return window.sessionStorage.getItem(`${TOUR_PENDING_PREFIX}${userId}`) === "1";
  } catch {
    return false;
  }
}

/**
 * The tour lives over the real feed, not on its own page. Any surface can ask
 * the shell to start it: replay from Settings or the account menu, or the
 * first-run handoff after the profile steps.
 */
export const WELCOME_TOUR_EVENT = "rizz:welcome-tour";

export function startWelcomeTour() {
  window.dispatchEvent(new Event(WELCOME_TOUR_EVENT));
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
