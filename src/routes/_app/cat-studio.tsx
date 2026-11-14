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

  return (
    <>
      {!availability.available && (
        <div className="flex shrink-0 items-start gap-2 border-b border-[#e8c15a]/30 bg-[#e8c15a]/10 px-3 py-2 text-[11.5px] leading-snug text-[#f0d79a]">
          <span className="font-bold">Preview.</span>
          <span className="min-w-0 flex-1">
            The cat tables aren&apos;t in this database yet, so buying and saving are off. Apply
            <code className="mx-1 rounded bg-black/30 px-1">supabase/migrations/pending_catstudio.sql</code>
            to unlock them.
          </span>
          <button
            type="button"
            onClick={() => nav({ to: "/settings/profile" })}
            className="shrink-0 underline-offset-2 hover:underline"
          >
            Back
          </button>
        </div>
      )}
      <CatStudioScreen />
    </>
  );
}
