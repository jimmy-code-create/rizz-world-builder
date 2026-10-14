import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Bot as BotIcon, Code2, Compass } from "lucide-react";

/** /bots — the bot surface. A shell so the directory and the developer pages share a header. */
export const Route = createFileRoute("/_app/bots")({
  head: () => ({ meta: [{ title: "Bots · RIZZ" }] }),
  component: BotsShell,
});

const TABS = [
  { to: "/bots", label: "Directory", icon: Compass, exact: true },
  { to: "/bots/developer", label: "Developer", icon: Code2, exact: false },
] as const;

function BotsShell() {
  const path = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-5 sm:px-6">
      <motion.header initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
        <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight">
          <BotIcon className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
          Bots
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bots work inside realms. Install one so it can answer slash commands in your channels, or
          build your own.
        </p>
      </motion.header>

      <nav
        aria-label="Bot sections"
        className="no-scrollbar mb-5 flex gap-2 overflow-x-auto rounded-2xl border border-white/10 glass p-1.5"
      >
        {TABS.map((tab) => {
          const active = tab.exact ? path === tab.to : path.startsWith(tab.to);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors ${
                active
                  ? "bg-primary/15 text-foreground ring-1 ring-primary/40"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
