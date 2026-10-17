import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useLocation,
  ScrollRestoration,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { ReactorPeekProvider } from "@/components/reactions/ReactorPeek";
import { RizzCat } from "@/components/RizzCat";
import { AppLoader } from "@/components/AppLoader";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { LilRizzCompanion } from "@/components/voice-companion/LilRizzCompanion";
import { VoiceCallProvider } from "@/components/voice/VoiceCallProvider";
import { GameOverlayHost } from "@/components/voice/GameOverlay";
import { useRizzCompanionEnabled } from "@/lib/rizz-companion-preference";

function NotFoundComponent() {
  useEffect(() => {
    if (window.location.pathname === "/index" || window.location.pathname === "/index/") {
      window.location.replace("/");
    }
  }, []);

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-md text-center">
        <RizzCat mood="searching" size={132} className="mx-auto mb-1" />
        <h1 className="text-5xl font-bold text-foreground">404</h1>
        <h2 className="mt-3 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error("Uncaught application error:", error);
  const router = useRouter();
  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : typeof (error as any)?.message === "string"
          ? (error as any).message
          : "";

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-8 bg-background">
      <div className="max-w-md w-full text-center">
        <RizzCat mood="searching" size={96} className="mx-auto mb-3" />
        <h1 className="text-xl font-bold tracking-tight text-foreground font-display">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {errorMessage || "Something went wrong on our end. You can try refreshing or head back home."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
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
          <a
            href="/feed"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Go to feed
          </a>
          <a
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "RIZZ — Your feed. Your server. Your world." },
      { name: "description", content: "RIZZ is the social app for Gen Z creators: live feeds, realms, voice rooms, drops and badges. Post, chat and build your world in real time." },
      { name: "google-site-verification", content: "Qo3UlzmrXku0PoMCwb7XmNvNccBK04bs9krIT-qONcU" },
      { name: "author", content: "RIZZ" },
      { name: "theme-color", content: "#0a0a0b" },
      { property: "og:title", content: "RIZZ — Your feed. Your server. Your world." },
      { property: "og:description", content: "RIZZ is the social app for Gen Z creators: live feeds, realms, voice rooms, drops and badges. Post, chat and build your world in real time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "RIZZ — Your feed. Your server. Your world." },
      { name: "twitter:description", content: "RIZZ is the social app for Gen Z creators: live feeds, realms, voice rooms, drops and badges. Post, chat and build your world in real time." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/699b5572-eb29-4322-a686-f1b3656e11ce/id-preview-9af0433e--8c1d6350-a504-41aa-84c2-cfa287920a20.lovable.app-1783644221729.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/699b5572-eb29-4322-a686-f1b3656e11ce/id-preview-9af0433e--8c1d6350-a504-41aa-84c2-cfa287920a20.lovable.app-1783644221729.png" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "icon", type: "image/svg+xml", href: "/brand/rizz-cat-logo.svg" },
      { rel: "apple-touch-icon", href: "/brand/rizz-cat-logo.svg" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        // Display: Bricolage Grotesque (editorial, a bit odd on purpose).
        // Text: Instrument Sans. Neither is a default AI-landing-page face.
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&family=Instrument+Sans:wght@400;500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  pendingComponent: () => <AppLoader />,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <style
          dangerouslySetInnerHTML={{
            __html: `
          #boot-splash {
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #0b0b0c;
            color: #f2efe6;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            transition: opacity 0.25s ease-out;
            user-select: none;
            -webkit-user-select: none;
          }
          @keyframes boot-bar-slide {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(300%); }
          }
          .boot-bar-fill {
            animation: boot-bar-slide 1.2s ease-in-out infinite;
          }
        `,
          }}
        />
      </head>
      <body>
        <div id="boot-splash" role="status" aria-live="polite">
          <img src="/brand/rizz-cat-logo.svg" alt="" aria-hidden width="48" height="48" style={{ objectFit: "contain" }} />
          <div aria-hidden style={{ marginTop: "16px", width: "128px", height: "4px", borderRadius: "9999px", background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
            <div className="boot-bar-fill" style={{ height: "100%", width: "33%", borderRadius: "9999px", background: "#c8ff3d" }} />
          </div>
          <p id="boot-status-text" style={{ marginTop: "16px", fontSize: "13px", fontWeight: "600", color: "#a1a1aa", letterSpacing: "0.02em" }}>
            Waking up the server…
          </p>
          <script
            dangerouslySetInnerHTML={{
              __html: `
            setTimeout(function() {
              var el = document.getElementById("boot-status-text");
              if (el) el.textContent = "Almost ready…";
            }, 4000);
            setTimeout(function() {
              var el = document.getElementById("boot-status-text");
              if (el) el.textContent = "Waking up server from cold start…";
            }, 8000);
            setTimeout(function() {
              var el = document.getElementById("boot-status-text");
              if (el) {
                el.innerHTML = 'Still connecting… <a href="javascript:location.reload()" style="color:#c8ff3d;text-decoration:underline;margin-left:6px;">Tap to retry</a>';
              }
            }, 12000);
          `,
            }}
          />
        </div>
        {children}
        <ScrollRestoration getKey={(location) => location.pathname} />
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Public and marketing surfaces never show the floating cat.
 *
 * It is a signed-in companion, so it only mounts for a session on a product
 * route — never on the landing page, auth, invite or onboarding screens, where
 * a fixed bottom-right button sat on top of headlines and CTAs. Any overlay
 * also pushes it aside via the `.overlay-hide` rule in styles.css.
 */
const COMPANION_HIDDEN_ROUTE =
  /^\/(?:$|login|signup|reset-password|onboarding|tutorial|claim|join|join-realm|_app\/auth)/;

function RizzCompanionLayer() {
  const { user } = useAuth();
  const companionEnabled = useRizzCompanionEnabled();
  const location = useLocation();
  if (!companionEnabled || !user || COMPANION_HIDDEN_ROUTE.test(location.pathname)) return null;
  return <LilRizzCompanion />;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    const splash = document.getElementById("boot-splash");
    if (splash) {
      splash.style.opacity = "0";
      setTimeout(() => splash.remove(), 260);
    }
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    void navigator.serviceWorker.register("/service-worker.js", { scope: "/" }).catch((error) => {
      console.warn("RIZZ service worker registration failed", error);
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          {/* Owns the live voice call so it survives navigation between pages. */}
          <VoiceCallProvider>
            {/* One shared reactor peek for every reaction chip in the app. */}
            <ReactorPeekProvider>
              <Outlet />
              <RizzCompanionLayer />
            </ReactorPeekProvider>
            {/* GAME BOT overlay: games play over the app while you're in a call */}
            <GameOverlayHost />
          </VoiceCallProvider>
          <Toaster />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
