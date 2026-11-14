import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { CatStudioScreen } from "@/features/cat-studio/CatStudioScreen";
import { useCatAvailability } from "@/features/cat-studio/useCatStudio";

export const Route = createFileRoute("/_app/cat-studio")({
  head: () => ({ meta: [{ title: "Cat Studio · RIZZ" }] }),
  component: CatStudioRoute,
});

/**
 * Cat Studio is only reachable once pending_catstudio.sql has been applied.
 * Until then this route explains itself instead of throwing on a missing table.
 */
function CatStudioRoute() {
  const availability = useCatAvailability();
  const nav = useNavigate();

  if (availability.isLoading) {
    return (
      <div className="grid min-h-[50dvh] place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!availability.available) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-5 py-16 text-center">
        <h1 className="font-display text-xl font-bold">Cat Studio isn&apos;t switched on yet</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The cat tables haven&apos;t been applied to this database. Once the pending migration is
          run, your cat will appear here.
        </p>
        <button
          type="button"
          onClick={() => nav({ to: "/settings/profile" })}
          className="h-11 rounded-[14px] border border-white/12 px-4 text-[13px] font-semibold"
        >
          Back to profile
        </button>
      </div>
    );
  }

  return <CatStudioScreen />;
}
