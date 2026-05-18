import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/dm/$userId")({
  head: () => ({ meta: [{ title: "DM · RIZZ" }] }),
  component: DMPage,
});

function DMPage() {
  const { userId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const other = useQuery({
    queryKey: ["profile-id", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      return data;
    },
  });

  const msgs = useQuery({
    queryKey: ["dm", user?.id, userId],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("direct_messages")
        .select("*")
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`)
        .order("created_at");
      return data ?? [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`dm-${user.id}-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["dm", user.id, userId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, userId, qc]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.data]);

  const send = async () => {
    if (!user || !body.trim()) return;
    const text = body.trim();
    setBody("");
    const { error } = await supabase.from("direct_messages").insert({ sender_id: user.id, recipient_id: userId, body: text });
    if (error) toast.error(error.message);
  };

  return (
    <div className="-my-6 md:-my-10">
      <div className="sticky top-0 z-20 glass-strong border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <Link to="/dms"><ArrowLeft className="h-5 w-5" /></Link>
        <Avatar className="h-9 w-9">
          <AvatarImage src={other.data?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-gradient-primary font-bold text-xs">{(other.data?.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">{other.data?.display_name || other.data?.username}</p>
          <p className="text-xs text-muted-foreground truncate">@{other.data?.username}</p>
        </div>
      </div>

      <div className="px-4 py-4 min-h-[60vh] pb-32 space-y-2">
        <AnimatePresence initial={false}>
          {msgs.data?.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm break-words ${mine ? "bg-gradient-primary text-primary-foreground shadow-glow" : "glass border border-white/10"}`}>
                  {m.body}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      <div className="fixed bottom-20 md:bottom-0 inset-x-0 md:left-64 z-20 p-3 glass-strong border-t border-white/5">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Input value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Message…" maxLength={1000} className="glass border-white/10" />
          <Button onClick={send} disabled={!body.trim()} size="icon" className="bg-gradient-primary border-0 shadow-glow"><Send className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}
