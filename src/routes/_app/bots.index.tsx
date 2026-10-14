import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Bot as BotIcon, Check, Plus, Search, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { botDirectoryKey, fetchBotDirectory, installRealmBot, rateBot, type DirectoryBot } from "@/lib/bots";

/** /bots — browse built-in and published bots, and install one into a realm. */
export const Route = createFileRoute("/_app/bots/")({
  component: BotDirectoryPage,
});

type ManageableRealm = { id: string; name: string; slug: string; role: string };

/**
 * The realms where this user may add a bot: owner, moderator, or any member when
 * the realm allows it. The server re-checks all of this, this only keeps the
 * picker honest.
 */
async function fetchManageableRealms(userId: string): Promise<ManageableRealm[]> {
  const { data: memberships, error: membershipError } = await supabase
    .from("realm_members")
    .select("realm_id, role")
    .eq("user_id", userId);
  if (membershipError) throw membershipError;

  const ids = (memberships ?? []).map((row: { realm_id: string }) => row.realm_id);
  if (!ids.length) return [];

  const { data: realms, error: realmError } = await supabase
    .from("realms")
    .select("id, name, slug, owner_id, allow_member_bots")
    .in("id", ids);
  if (realmError) throw realmError;

  // `realms.allow_member_bots` arrives with the realm-bots migration, so it is
  // not in the generated Supabase types yet.
  const rows = (realms ?? []) as unknown as {
    id: string;
    name: string;
    slug: string;
    owner_id: string;
    allow_member_bots: boolean | null;
  }[];
  const roleById = new Map((memberships ?? []).map((row: any) => [row.realm_id as string, row.role as string]));

  return rows
    .filter((realm) => {
      const role = roleById.get(realm.id);
      return role === "owner" || role === "mod" || realm.allow_member_bots === true;
    })
    .map((realm) => ({
      id: realm.id,
      name: realm.name,
      slug: realm.slug,
      role: roleById.get(realm.id) ?? "member",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function BotDirectoryPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [installingBot, setInstallingBot] = useState<DirectoryBot | null>(null);
  const [busyRealmId, setBusyRealmId] = useState<string | null>(null);
  const [ratingBusy, setRatingBusy] = useState<string | null>(null);

  const directory = useQuery({
    queryKey: botDirectoryKey(search),
    queryFn: () => fetchBotDirectory(search),
    staleTime: 30_000,
  });

  const realms = useQuery({
    queryKey: ["manageable-realms", user?.id],
    enabled: !!user,
    queryFn: () => fetchManageableRealms(user!.id),
  });

  const bots = useMemo(() => directory.data ?? [], [directory.data]);

  const install = async (realm: ManageableRealm) => {
    if (!installingBot) return;
    setBusyRealmId(realm.id);
    try {
      await installRealmBot(realm.id, installingBot.bot_id);
      await qc.invalidateQueries({ queryKey: ["bot-directory"] });
      await qc.invalidateQueries({ queryKey: ["realm-bots", realm.id] });
      await qc.invalidateQueries({ queryKey: ["realm-slash-commands", realm.id] });
      toast.success(`${installingBot.name} added to ${realm.name}`);
      setInstallingBot(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't add that bot");
    } finally {
      setBusyRealmId(null);
    }
  };

  /** One rating per user: the server upserts, so this is also the "change my mind" path. */
  const rate = async (bot: DirectoryBot, stars: number) => {
    if (!user) {
      toast.error("Sign in to rate a bot");
      return;
    }
    setRatingBusy(bot.bot_id);
    try {
      await rateBot(bot.bot_id, stars);
      await qc.invalidateQueries({ queryKey: ["bot-directory"] });
      toast.success(`Rated ${bot.name} ${stars} star${stars === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save that rating");
    } finally {
      setRatingBusy(null);
    }
  };

  return (
    <div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search bots…"
          className="h-11 border-white/10 glass pl-9"
        />
      </div>

      {directory.isLoading && (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-20 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      )}

      {directory.isError && (
        <div role="alert" className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
          <p className="font-semibold">Couldn&apos;t load the bot directory</p>
          <p className="mt-1 text-amber-100/85">
            {(directory.error instanceof Error && directory.error.message) ||
              "Apply the latest Supabase migration, then try again."}
          </p>
          <Button
            variant="outline"
            className="mt-3 h-11 w-full border-amber-300/40 bg-transparent text-amber-100 hover:bg-amber-300/10"
            onClick={() => void directory.refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      {!directory.isLoading && !directory.isError && (
        <ul className="space-y-3">
          {bots.length === 0 && (
            <li className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
              No bots match that search.
            </li>
          )}
          {bots.map((bot, index) => (
            <motion.li
              key={bot.bot_id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.03, 0.2) }}
              className="rounded-3xl border border-white/10 glass p-4"
            >
              <div className="flex items-start gap-3">
                <Avatar className="h-12 w-12 shrink-0 ring-1 ring-white/10">
                  <AvatarImage src={bot.avatar_url ?? undefined} alt="" />
                  <AvatarFallback className="bg-primary text-primary-foreground font-bold text-primary-foreground">
                    {bot.is_builtin ? <BotIcon className="h-5 w-5" aria-hidden="true" /> : bot.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-display font-bold">
                    {bot.name}
                    {bot.is_builtin && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-muted-foreground/45 bg-muted-foreground/15 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        <BotIcon className="h-2.5 w-2.5" aria-hidden="true" /> Official
                      </span>
                    )}
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      installed in {bot.installs} {bot.installs === 1 ? "realm" : "realms"}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{bot.description}</p>

                  {/* Community average, then my own stars. Own bots cannot be rated. */}
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {bot.rating_count > 0
                        ? `★ ${bot.rating_avg} · ${bot.rating_count} rating${bot.rating_count === 1 ? "" : "s"}`
                        : "No ratings yet"}
                    </span>
                    {user && bot.owner_id === user.id ? (
                      <span className="text-[11px] text-muted-foreground">· your bot</span>
                    ) : (
                      <span className="flex items-center gap-0.5" role="group" aria-label={`Rate ${bot.name}`}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            disabled={ratingBusy === bot.bot_id}
                            aria-label={`Rate ${star} star${star === 1 ? "" : "s"}`}
                            onClick={() => void rate(bot, star)}
                            className="grid h-6 w-6 place-items-center rounded-md transition-colors hover:bg-white/10 disabled:opacity-50"
                          >
                            <Star
                              aria-hidden="true"
                              className={`h-3.5 w-3.5 ${
                                (bot.my_rating ?? 0) >= star
                                  ? "fill-primary text-primary"
                                  : "text-muted-foreground/60"
                              }`}
                            />
                          </button>
                        ))}
                      </span>
                    )}
                  </div>

                  {bot.commands.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {bot.commands.map((command) => (
                        <span
                          key={command.name}
                          title={command.description}
                          className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-foreground/80"
                        >
                          /{command.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-10 gap-1.5 border-0 bg-primary text-primary-foreground"
                  onClick={() => {
                    setInstallingBot(bot);
                    if (!user) toast.error("Sign in to add a bot");
                  }}
                >
                  <Plus className="h-4 w-4" /> Add to a realm
                </Button>
              </div>
            </motion.li>
          ))}
        </ul>
      )}

      <Dialog open={!!installingBot} onOpenChange={(open) => { if (!open) setInstallingBot(null); }}>
        <DialogContent className="glass-strong border-white/10">
          <DialogHeader>
            <DialogTitle className="font-display">
              Add {installingBot?.name ?? "bot"} to a realm
            </DialogTitle>
          </DialogHeader>

          {realms.isLoading ? (
            <div className="h-20 animate-pulse rounded-2xl bg-white/5" aria-busy="true" />
          ) : (realms.data ?? []).length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-muted-foreground">
              You cannot add bots anywhere yet. You need to own or moderate a realm, or the realm
              owner has to switch on “Allow all members to add bots”.
            </p>
          ) : (
            <div className="space-y-2">
              {(realms.data ?? []).map((realm) => (
                <button
                  key={realm.id}
                  type="button"
                  disabled={busyRealmId === realm.id}
                  onClick={() => void install(realm)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 text-left transition-colors hover:border-primary/40 disabled:opacity-60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{realm.name}</p>
                    <p className="text-[11px] capitalize text-muted-foreground">{realm.role}</p>
                  </div>
                  {busyRealmId === realm.id ? (
                    <span className="text-[11px] text-muted-foreground">Adding…</span>
                  ) : (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
              <p className="text-[11px] text-muted-foreground">
                Want a different realm? Open it and use its bot settings there.{" "}
                <Link to="/realms" className="text-primary hover:underline">
                  Browse realms
                </Link>
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
