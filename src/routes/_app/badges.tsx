import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { fetchAllBadges, fetchUserBadges } from "@/lib/badges";
import { BadgeChip } from "@/components/BadgeChip";
import { Award, Lock } from "lucide-react";

export const Route = createFileRoute("/_app/badges")({
  head: () => ({ meta: [{ title: "Badges · RIZZ" }] }),
  component: BadgesPage,
});

function BadgesPage() {
  const { user } = useAuth();
  const all = useQuery({ queryKey: ["badges-all"], queryFn: fetchAllBadges });
  const mine = useQuery({ queryKey: ["badges-mine", user?.id], queryFn: () => fetchUserBadges(user!.id), enabled: !!user });
  const owned = new Set((mine.data ?? []).map((b) => b.id));

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-2">
          <Award className="h-7 w-7 text-[var(--rizz-pink)]" /> Badges
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {mine.data?.length ?? 0} of {all.data?.length ?? 0} collected
        </p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {all.data?.map((b) => {
          const hasIt = owned.has(b.id);
          return (
            <motion.div key={b.id} whileHover={{ y: -4 }} className={`glass rounded-2xl p-4 border ${hasIt ? "border-white/10" : "border-white/5 opacity-50"} flex flex-col items-center text-center transition-all hover:shadow-glow`}>
              {hasIt ? <BadgeChip badge={b} size="lg" /> : (
                <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10"><Lock className="h-4 w-4 text-muted-foreground" /></div>
              )}
              <h3 className="font-display font-bold text-sm mt-3">{b.name}</h3>
              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{b.description}</p>
              <span className="text-[9px] uppercase tracking-wider mt-2 px-2 py-0.5 rounded-full" style={{ background: `${b.color}22`, color: b.color }}>{b.rarity}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}