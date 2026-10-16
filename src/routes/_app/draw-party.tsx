import { createFileRoute } from "@tanstack/react-router";
import { DrawPartyGame } from "@/components/draw-party/DrawPartyGame";

export const Route = createFileRoute("/_app/draw-party")({
  head: () => ({ meta: [{ title: "Draw Party · RIZZ" }] }),
  component: DrawPartyPage,
});

function DrawPartyPage() {
  return <DrawPartyGame />;
}
