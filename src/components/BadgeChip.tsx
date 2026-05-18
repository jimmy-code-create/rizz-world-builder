import * as Icons from "lucide-react";
import type { Badge } from "@/lib/badges";
import { RARITY_GLOW } from "@/lib/badges";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function BadgeChip({ badge, size = "md" }: { badge: Badge; size?: "sm" | "md" | "lg" }) {
  const Icon = (Icons as any)[badge.icon] ?? Icons.Award;
  const dim = size === "sm" ? "h-6 w-6" : size === "lg" ? "h-10 w-10" : "h-8 w-8";
  const iconSize = size === "sm" ? 12 : size === "lg" ? 20 : 16;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`${dim} rounded-xl flex items-center justify-center border border-white/10 backdrop-blur-md transition-transform hover:scale-110`}
            style={{
              background: `linear-gradient(135deg, ${badge.color}33, ${badge.color}11)`,
              boxShadow: `${RARITY_GLOW[badge.rarity]} ${badge.color}66`,
            }}
          >
            <Icon size={iconSize} color={badge.color} strokeWidth={2.5} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="glass-strong border-white/10">
          <div className="flex flex-col items-start gap-0.5 max-w-[200px]">
            <div className="flex items-center gap-1.5">
              <span className="font-display font-bold text-sm">{badge.name}</span>
              <span className="text-[10px] uppercase tracking-wider opacity-60">{badge.rarity}</span>
            </div>
            <span className="text-xs text-muted-foreground">{badge.description}</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function BadgeRow({ badges, max = 5, size = "md" }: { badges: Badge[]; max?: number; size?: "sm" | "md" | "lg" }) {
  if (!badges.length) return null;
  const shown = badges.slice(0, max);
  const extra = badges.length - shown.length;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {shown.map((b) => <BadgeChip key={b.id} badge={b} size={size} />)}
      {extra > 0 && <span className="text-xs text-muted-foreground font-medium">+{extra}</span>}
    </div>
  );
}
