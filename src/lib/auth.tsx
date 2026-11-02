import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  banner_mode: string | null;
  banner_gradient: unknown;
  updated_at?: string | null;
  /** profiles.created_at — the joined date every profile surface prints. */
  created_at?: string | null;
  bio: string | null;
  rizz_score: number;
  paw_balance: number;
  paw_earned?: number;
  accent_color: string | null;
  theme_preset: string | null;
  theme_mode: string | null;
  ui_density: string | null;
  reduced_motion: boolean | null;
  trial_active: boolean | null;
  trial_ends_at: string | null;
  tutorial_seen: boolean;
  interests: string[];
  /** Purify entitlement end; written only by the Stripe webhook. */
  purify_until?: string | null;
};

type AuthCtx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

const retryDelay = (attempt: number) =>
  new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));

async function fetchMe(session: Session | null): Promise<Profile | null> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    let response: Response;
    try {
      response = await fetch("/api/me", {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
    } catch (error) {
      if (attempt === 3) throw error;
      await retryDelay(attempt);
      continue;
    }

    if (response.status === 401 && !session) return null;
    if ([502, 503, 504].includes(response.status) && attempt < 3) {
      await retryDelay(attempt);
      continue;
    }
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Your session expired. Please sign in again.");
      }
      let message = "";
      try {
        const body = (await response.json()) as { error?: unknown };
        if (typeof body.error === "string") message = body.error;
      } catch {
        // Some proxy/server failures return a non-JSON response.
      }
      throw new Error(message || `Couldn't load your account (HTTP ${response.status}).`);
    }
    const result = (await response.json()) as { profile: Profile | null };
    return result.profile ?? null;
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  // Supabase emits TOKEN_REFRESHED when the tab wakes up (for example after the
  // native photo picker closes). Without these refs the shell would drop back to
  // AppLoader while /api/me refreshes, unmounting the composer and losing the
  // photo the member just selected. Keep the last good profile and userId so a
  // background refresh can update it in place instead.
  const profileRef = useRef<Profile | null>(null);
  const userIdRef = useRef<string | null>(null);

  const rememberProfile = (next: Profile | null) => {
    profileRef.current = next;
    setProfile(next);
  };

  useEffect(() => {
    let mounted = true;
    let requestId = 0;
    let initialized = false;

    const applySession = async (nextSession: Session | null) => {
      const currentRequest = ++requestId;
      const nextUserId = nextSession?.user?.id ?? null;
      const sameMember = Boolean(
        nextUserId && nextUserId === userIdRef.current && profileRef.current,
      );

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession) {
        // There is no profile to fetch without a session. Calling /api/me here
        // only produced a 401 in the console for every signed-out visitor.
        userIdRef.current = null;
        setProfileError(null);
        rememberProfile(null);
        if (mounted && currentRequest === requestId) setLoading(false);
        return;
      }

      if (sameMember) {
        // A token refresh, not a new sign-in. Refresh the profile silently and
        // keep the app mounted: the route below may be holding an unsent draft,
        // a selected image, or a scroll position.
        userIdRef.current = nextUserId;
        setProfileError(null);
        try {
          const nextProfile = await fetchMe(nextSession);
          if (mounted && currentRequest === requestId) rememberProfile(nextProfile);
        } catch (error) {
          // A transient refresh failure must not throw the member out of what
          // they were doing. The next focus/refresh will try again.
          console.warn("Profile refresh failed", error);
        } finally {
          if (mounted && currentRequest === requestId) setLoading(false);
        }
        return;
      }

      userIdRef.current = nextUserId;
      setProfileError(null);
      rememberProfile(null);
      setLoading(true);
      try {
        const nextProfile = await fetchMe(nextSession);
        if (mounted && currentRequest === requestId) rememberProfile(nextProfile);
      } catch (error) {
        if (mounted && currentRequest === requestId) {
          rememberProfile(null);
          setProfileError(error instanceof Error ? error.message : "Couldn't load your account.");
        }
      } finally {
        if (mounted && currentRequest === requestId) setLoading(false);
      }
    };

    let unsubscribe = () => {};
    try {
      const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
        if (event === "INITIAL_SESSION" && !initialized) return;
        setTimeout(() => {
          if (mounted) void applySession(nextSession);
        }, 0);
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    } catch (error) {
      if (mounted) {
        setProfileError(
          error instanceof Error ? error.message : "Couldn't initialize account access.",
        );
        setLoading(false);
      }
      return () => {
        mounted = false;
      };
    }

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        initialized = true;
        if (mounted) void applySession(data.session);
      })
      .catch((error: unknown) => {
        initialized = true;
        if (!mounted) return;
        setProfileError(error instanceof Error ? error.message : "Couldn't check your session.");
        setLoading(false);
      });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        profile,
        loading,
        profileError,
        refreshProfile: async () => {
          if (!session) return;
          setProfileError(null);
          try {
            rememberProfile(await fetchMe(session));
          } catch (error) {
            // Keep the last good profile on a failed refresh. Surfaces can keep
            // rendering with slightly stale data; a full error screen should be
            // reserved for the first load, when there is nothing to show.
            if (!profileRef.current) {
              setProfileError(
                error instanceof Error ? error.message : "Couldn't load your account.",
              );
            }
            throw error;
          }
        },
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
