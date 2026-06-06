import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { StoryComposer } from "@/components/StoryComposer";

type Story = {
  id: string;
  author_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  author: { username: string; display_name: string | null; avatar_url: string | null; accent_color: string | null } | null;
};

export function StoriesStrip() {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [viewing, setViewing] = useState<number | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("stories")
      .select("*, author:profiles!stories_author_id_fkey(username,display_name,avatar_url,accent_color)")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    setStories((data ?? []) as any);
  };

  useEffect(() => { load(); }, []);

  // group by author, latest first
  const grouped = Array.from(
    stories.reduce((m, s) => {
      const k = s.author_id;
      if (!m.has(k)) m.set(k, [] as Story[]);
      m.get(k)!.push(s);
      return m;
    }, new Map<string, Story[]>()).values()
  );

  return (
    <>
      <div className="mb-5 -mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-3">
          {/* Add story */}
          <button
            onClick={() => setComposerOpen(true)}
            className="flex flex-col items-center gap-1.5 shrink-0"
          >
            <div className="relative h-16 w-16 rounded-full bg-gradient-primary p-[2px] shadow-glow">
              <div className="h-full w-full rounded-full bg-background flex items-center justify-center">
                <Plus className="h-6 w-6" />
              </div>
            </div>
            <span className="text-[10px] font-medium text-muted-foreground">Your story</span>
          </button>

          {grouped.map((group, idx) => {
            const s = group[0];
            const accent = s.author?.accent_color || "var(--rizz-pink)";
            return (
              <button
                key={s.author_id}
                onClick={() => setViewing(idx)}
                className="flex flex-col items-center gap-1.5 shrink-0"
              >
                <div className="relative h-16 w-16 rounded-full p-[2px]" style={{ background: `conic-gradient(from 0deg, ${accent}, var(--rizz-violet), ${accent})` }}>
                  <Avatar className="h-full w-full ring-2 ring-background">
                    <AvatarImage src={s.author?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-gradient-primary text-xs font-bold">
                      {(s.author?.username ?? "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <span className="text-[10px] font-medium truncate max-w-[64px]">
                  @{s.author?.username ?? "?"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {viewing !== null && grouped[viewing] && (
          <StoryViewer
            group={grouped[viewing]}
            onClose={() => setViewing(null)}
            onNext={() => setViewing(viewing + 1 < grouped.length ? viewing + 1 : null)}
            onPrev={() => setViewing(viewing - 1 >= 0 ? viewing - 1 : null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {composerOpen && (
          <StoryComposer open={composerOpen} onClose={() => setComposerOpen(false)} onPosted={load} />
        )}
      </AnimatePresence>
    </>
  );
}

function StoryViewer({ group, onClose, onNext, onPrev }: { group: Story[]; onClose: () => void; onNext: () => void; onPrev: () => void }) {
  const [idx, setIdx] = useState(0);
  const story = group[idx];
  const { user } = useAuth();

  useEffect(() => {
    if (user && story) {
      supabase.from("story_views").insert({ story_id: story.id, viewer_id: user.id }).then(() => {});
    }
    const t = setTimeout(() => {
      if (idx + 1 < group.length) setIdx(idx + 1);
      else onNext();
    }, 5000);
    return () => clearTimeout(t);
  }, [idx, story, user, group.length, onNext]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute top-4 left-4 right-4 flex gap-1 z-10">
        {group.map((_, i) => (
          <div key={i} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
            <div className={`h-full bg-white transition-all ${i < idx ? "w-full" : i === idx ? "w-full animate-[progress_5s_linear]" : "w-0"}`} />
          </div>
        ))}
      </div>
      <button onClick={onClose} className="absolute top-4 right-4 z-20 h-10 w-10 rounded-full glass-strong flex items-center justify-center">
        <X className="h-5 w-5" />
      </button>
      <div className="absolute top-12 left-4 flex items-center gap-2 z-10">
        <Avatar className="h-8 w-8 ring-2 ring-white/30">
          <AvatarImage src={story.author?.avatar_url ?? undefined} />
          <AvatarFallback>{(story.author?.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium">@{story.author?.username}</span>
      </div>

      <button className="absolute left-0 top-0 bottom-0 w-1/3" onClick={(e) => { e.stopPropagation(); if (idx > 0) setIdx(idx - 1); else onPrev(); }} />
      <button className="absolute right-0 top-0 bottom-0 w-1/3" onClick={(e) => { e.stopPropagation(); if (idx + 1 < group.length) setIdx(idx + 1); else onNext(); }} />

      {story.media_type === "video" ? (
        <video src={story.media_url} autoPlay playsInline className="max-h-[85vh] max-w-full rounded-2xl" />
      ) : (
        <img src={story.media_url} alt="" className="max-h-[85vh] max-w-full rounded-2xl object-contain" />
      )}
      {story.caption && (
        <div className="absolute bottom-10 left-4 right-4 text-center">
          <p className="inline-block glass-strong px-4 py-2 rounded-full text-sm">{story.caption}</p>
        </div>
      )}
    </motion.div>
  );
}
