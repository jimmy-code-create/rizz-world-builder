import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_app")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: AppShell,
});
