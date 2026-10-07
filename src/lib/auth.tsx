import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  rizz_score: number;
  accent_color: string | null;
  theme_preset: string | null;
  theme_mode: string | null;
  ui_density: string | null;
  reduced_motion: boolean | null;
  trial_active: boolean | null;
  trial_ends_at: string | null;
  tutorial_seen: boolean;
  interests: string[];
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

const retryDelay = (attempt: number) => new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));

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
      throw new Error(response.status === 401 ? "Your session expired. Please sign in again." : "Couldn't load your account.");
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

  useEffect(() => {
    let mounted = true;
    let requestId = 0;
    let initialized = false;

    const applySession = async (nextSession: Session | null) => {
      const currentRequest = ++requestId;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setProfileError(null);

      if (!nextSession) {
        setProfile(null);
        setLoading(true);
        try {
          await fetchMe(null);
        } catch {
          // An unauthenticated visitor still belongs on the public welcome screen.
        } finally {
          if (mounted && currentRequest === requestId) setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const nextProfile = await fetchMe(nextSession);
        if (mounted && currentRequest === requestId) setProfile(nextProfile);
      } catch (error) {
        if (mounted && currentRequest === requestId) {
          setProfile(null);
          setProfileError(error instanceof Error ? error.message : "Couldn't load your account.");
        }
      } finally {
        if (mounted && currentRequest === requestId) setLoading(false);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "INITIAL_SESSION" && !initialized) return;
      setTimeout(() => {
        if (mounted) void applySession(nextSession);
      }, 0);
    });

    void supabase.auth.getSession().then(({ data }) => {
      initialized = true;
      if (mounted) void applySession(data.session);
    }).catch((error: unknown) => {
      initialized = true;
      if (!mounted) return;
      setProfileError(error instanceof Error ? error.message : "Couldn't check your session.");
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
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
            setProfile(await fetchMe(session));
          } catch (error) {
            setProfileError(error instanceof Error ? error.message : "Couldn't load your account.");
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