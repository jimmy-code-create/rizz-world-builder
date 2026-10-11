import { createFileRoute } from "@tanstack/react-router";

import { RizzCoachView } from "@/components/rizz-coach/RizzCoachView";
import { useRizzCoach } from "@/components/rizz-coach/useRizzCoach";

export const Route = createFileRoute("/rizz-coach")({
  component: RizzCoachPage,
  head: () => ({
    meta: [
      { title: "Rizz Coach — voice practice" },
      {
        name: "description",
        content: "A private, voice-first space to practice talking to people.",
      },
      { name: "theme-color", content: "#100d17" },
    ],
  }),
});

function RizzCoachPage() {
  const coach = useRizzCoach();
  return <RizzCoachView {...coach} />;
}
