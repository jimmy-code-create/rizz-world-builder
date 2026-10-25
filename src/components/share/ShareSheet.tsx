import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Link2, Loader2, Search, Send } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

type ShareTarget = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

const MAX_TARGETS = 5;

/**
 * ONE share sheet for reels, posts and stories.
 *
 * Search a member, pick up to five, add an optional note, send — each target
 * gets a normal DM carrying the link. Copy link and the OS share sheet sit in
 * the same panel, so sharing never needs a second menu.
 */
export function ShareSheet({
  open,
  onOpenChange,
  url,
  title,
  text,
  imageUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title: string;
  text?: string | null;
  imageUrl?: string | null;
}) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState<Record<string, ShareTarget>>({});
  const [sending, setSending] = useState(false);

  const people = useQuery({
    queryKey: ['share-targets', user?.id, query],
    enabled: open && !!user,
    staleTime: 30_000,
    queryFn: async () => {
      let request = supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .neq('id', user!.id)
        .limit(30);
      if (query.trim()) request = request.ilike('username', `%${query.trim()}%`);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []) as ShareTarget[];
    },
  });

  const picked = useMemo(() => Object.values(selected), [selected]);
  const count = picked.length;

  const toggle = (person: ShareTarget) => {
    setSelected((current) => {
      if (current[person.id]) {
        const next = { ...current };
        delete next[person.id];
        return next;
      }
      if (Object.keys(current).length >= MAX_TARGETS) {
        toast.info(`You can share with up to ${MAX_TARGETS} people at once`);
        return current;
      }
      return { ...current, [person.id]: person };
    });
  };

  const send = async () => {
    if (!user || count === 0) return;
    setSending(true);
    try {
      const body = `${note.trim() ? `${note.trim()}\n` : ''}${url}`.slice(0, 2000);
      const rows = picked.map((person) => ({
        sender_id: user.id,
        recipient_id: person.id,
        body,
        story_id: null,
      }));
      const { error } = await supabase.from('direct_messages').insert(rows);
      if (error) throw error;
      toast.success(`Shared with ${count} ${count === 1 ? 'person' : 'people'}`);
      setSelected({});
      setNote('');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not share this');
    } finally {
      setSending(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="glass-strong rounded-t-3xl border-white/10 p-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
      >
        <SheetHeader className="mb-3 text-left">
          <SheetTitle className="font-display text-sm font-bold">Share</SheetTitle>
        </SheetHeader>

        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people"
            className="h-10 min-w-0 flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>

        <div className="mt-3 max-h-[32dvh] overflow-y-auto">
          {people.isLoading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Loading people…</p>
          ) : (people.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No one matches that name.</p>
          ) : (
            <ul className="space-y-1">
              {(people.data ?? []).map((person) => {
                const isPicked = Boolean(selected[person.id]);
                const name = person.display_name || person.username || 'member';
                return (
                  <li key={person.id}>
                    <button
                      type="button"
                      onClick={() => toggle(person)}
                      aria-pressed={isPicked}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors',
                        isPicked ? 'bg-primary/10' : 'hover:bg-secondary/60',
                      )}
                    >
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={person.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-secondary text-[12px] font-bold">
                          {name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-foreground">{name}</span>
                        {person.username ? (
                          <span className="block truncate text-[11px] text-muted-foreground">@{person.username}</span>
                        ) : null}
                      </span>
                      {isPicked ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Add a message (optional)"
          maxLength={200}
          className="mt-3 h-10 w-full rounded-xl border border-border bg-card px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />

        <Button
          onClick={() => void send()}
          disabled={count === 0 || sending}
          className="mt-3 h-11 w-full gap-2 rounded-xl bg-primary text-[13px] font-semibold text-primary-foreground"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {count === 0 ? 'Send' : `Send to ${count}`}
        </Button>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="secondary" className="h-11 justify-start gap-2 rounded-xl text-[13px]" onClick={() => void copy()}>
            <Copy className="h-4 w-4 text-primary" /> Copy link
          </Button>
          <Button
            variant="secondary"
            className="h-11 justify-start gap-2 rounded-xl text-[13px]"
            onClick={() => {
              const share = (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share;
              if (share) void share.call(navigator, { title, text: text ?? undefined, url }).catch(() => {});
              else void copy();
            }}
          >
            <Link2 className="h-4 w-4 text-primary" /> Share via…
          </Button>
        </div>

        {imageUrl ? <span className="sr-only">{title}</span> : null}
      </SheetContent>
    </Sheet>
  );
}
