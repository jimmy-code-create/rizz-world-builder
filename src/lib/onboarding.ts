type OnboardingProfile = {
  username: string | null;
  tutorial_seen: boolean;
} | null;

export function getPostAuthPath(profile: OnboardingProfile): "/claim" | "/tutorial" | "/feed" {
  if (!profile?.username) return "/claim";
  if (!profile.tutorial_seen) return "/tutorial";
  return "/feed";
}
