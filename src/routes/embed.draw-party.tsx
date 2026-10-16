import { createFileRoute } from "@tanstack/react-router";
import { DrawPartyGame } from "@/components/draw-party/DrawPartyGame";

/**
 * Chromeless embed for the Discord-style voice Activity panel.
 * No AppShell nav — just the game, sized for the 380px side panel
 * (and the full-screen phone overlay). Same-origin with the app, so
 * nickname, Supabase sync and the ?room= code all work inside the iframe.
 */
export const Route = createFileRoute("/embed/draw-party")({
  head: () => ({ meta: [{ title: "Draw Party · RIZZ" }] }),
  component: DrawPartyEmbed,
});

function DrawPartyEmbed() {
  return (
    <div className="min-h-dvh bg-[#0a0a0b]">
      <DrawPartyGame compact />
    </div>
  );
}
