import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { WelcomeFlow } from "@/components/welcome/WelcomeFlow";
import { useAuth } from "@/lib/auth";
import { getPostAuthPath } from "@/lib/onboarding";
import { useLightCanvas } from "@/lib/use-light-canvas";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "RIZZ — Your feed. Your server. Your world." },
      {
        name: "description",
        content:
          "RIZZ is a feed with a live realm behind every profile: posts, reels, voice rooms, Messages and chat stories in one place.",
      },
    ],
  }),
});

function Index() {
  useLightCanvas();
  const { user, profile, loading, profileError, refreshProfile } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (loading || !user || profileError) return;
    void nav({ to: getPostAuthPath(profile), replace: true });
  }, [loading, user, profile, profileError, nav]);

  if (user && profileError) {
    return (
      <div className="rizz-auth-shell flex min-h-dvh flex-col items-center justify-center gap-4 bg-white px-6 text-center text-[#15151a]">
        <img src="/cats/searching.svg" alt="" className="h-24 w-24" />
        <p className="max-w-sm text-sm leading-relaxed text-[#6f6c64]">{profileError}</p>
        <Button
          variant="outline"
          className="h-12 rounded-2xl border-[#e3e0d7] bg-white px-6 font-semibold text-[#15151a] hover:bg-[#f4f3ef]"
          onClick={() => void refreshProfile()}
        >
          Retry
        </Button>
      </div>
    );
  }

  return <WelcomeFlow />;
}
