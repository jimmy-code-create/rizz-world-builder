import { useIsFetching } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { loading } = useAuth();
  const fetching = useIsFetching({
    predicate: (query) => query.getObserversCount() > 0 && query.state.status === "pending",
  });
  const shouldShow = transitioning || loading || (pathname !== "/reels" && pathname !== "/_app/reels" && fetching > 0);
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    let timer: number | undefined;
    if (shouldShow) {
      if (!shownAt.current) shownAt.current = performance.now();
      setVisible(true);
    } else if (shownAt.current) {
      const remaining = Math.max(0, 300 - (performance.now() - shownAt.current));
      timer = window.setTimeout(() => {
        shownAt.current = 0;
        setVisible(false);
      }, remaining);
    }
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [shouldShow]);

  return visible ? <FullScreenLoader /> : null;
}
