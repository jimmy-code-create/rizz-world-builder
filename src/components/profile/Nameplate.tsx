import { cn } from "@/lib/utils";

const NAMEPLATE_CLASS: Record<string, string> = {
  "np-gold": "np-gold",
  "np-vapor": "np-vapor",
  "np-mythic": "np-mythic",
};

export function Nameplate({ name, slug, className }: { name: string; slug?: string | null; className?: string }) {
  const cls = slug ? NAMEPLATE_CLASS[slug] : undefined;
  return <span className={cn(cls, className)}>{name}</span>;
}