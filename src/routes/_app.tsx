import { createFileRoute, useRouter } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RizzCat } from "@/components/RizzCat";
import { LimeCatSplash } from "@/components/LimeCatSplash";

function AppErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error("App page error:", error);
  const router = useRouter();
  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12 text-center">
      <RizzCat mood="searching" size={80} className="mx-auto mb-3" />
      <h2 className="text-lg font-bold text-foreground">Couldn't load this page</h2>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">
        {errorMessage || "Something unexpected happened. Try reloading."}
      </p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_app")({
  component: AppShell,
  pendingComponent: () => <LimeCatSplash />,
  errorComponent: AppErrorComponent,
});
