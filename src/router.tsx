import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { setQueryClient } from "@/lib/query-client";

export const getRouter = () => {
  // Defaults tuned for a phone: nothing refetches on every tab/app focus, a
  // revisit inside 30s reuses the cache, and a failed request retries once
  // instead of three times (three slow retries read as the app "lagging").
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  // Plain data-layer functions (realm join/leave, emoji upload) invalidate
  // through this, so there is still only one cache in the app.
  setQueryClient(queryClient);

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
