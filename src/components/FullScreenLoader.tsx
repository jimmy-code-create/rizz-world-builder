import { useIsFetching } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { CatLoader } from "@/components/CatLoader";

export function FullScreenLoader() {
  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-[#09090b]">
      <CatLoader />
    </div>
  );
}

export function LoadingOverlay() {
  const transitioning = useRouterState({ select: (state) => state.isLoading });
  const { loading } = useAuth();
  const fetching = useIsFetching({
    predicate: (query) => query.getObserversCount() > 0 && query.state.status === "pending",
  });

  return transitioning || loading || fetching > 0 ? <FullScreenLoader /> : null;
}
