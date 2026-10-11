import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Globe, Lock, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

type RailRealm = {
  id: string;
  slug: string;
  name: string;
  accent_color: string | null;
  is_public: boolean;
  member_count: number;
};

export function ReelsRealmRail() {
  const realms = useQuery({
    queryKey: ["realms-rail"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("realms")
        .select("id,slug,name,accent_color,is_public,member_count")
        .eq("is_public", true)
        .order("member_count", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as RailRealm[];
    },
  });

  const items = realms.data ?? [];
  if (realms.isLoading || items.length === 0) return null;

  return (
    <div className="pointer-events-auto flex items-center gap-2 overflow-x-auto no-scrollbar pr-8">
      <Link
        to="/realms"
        className="grid h-10 shrink-0 place-items-center rounded-full border border-white/20 bg-black/40 px-3 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur transition active:scale-95"
      >
        Realms
      </Link>
      {items.map((realm) => (
        <Link
          key={realm.id}
          to="/r/$slug"
          params={{ slug: realm.slug }}
          className="grid h-10 shrink-0 place-items-center rounded-full bg-black/40 px-3 text-[11px] font-semibold text-white backdrop-blur transition active:scale-95"
          style={{ border: `1px solid ${realm.accent_color ?? "#ff2d92"}55` }}
          title={realm.is_public ? "Public realm" : "Private realm"}
        >
          <span className="flex items-center gap-1.5">
            {realm.is_public ? <Globe className="h-3 w-3 opacity-70" /> : <Lock className="h-3 w-3 opacity-70" />}
            {realm.name}
          </span>
          <span className="ml-1 flex items-center gap-0.5 opacity-60">
            <Users className="h-3 w-3" />
            {realm.member_count}
          </span>
        </Link>
      ))}
    </div>
  );
}
