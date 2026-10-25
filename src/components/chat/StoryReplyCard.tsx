import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QuoteBlock } from '@/components/chat/QuoteBlock';
import { toast } from '@/lib/toast';

type StoryRow = {
  id: string;
  media_url: string;
  media_type: string;
  expires_at: string;
  author_id: string;
};

/**
 * A DM that answers a story renders as a quoted story card, not a plain text
 * bubble. The story is fetched by id (48x80 thumbnail + label); tapping opens
 * the media while it is still active, otherwise it says the story expired.
 */
export function StoryReplyCard({
  storyId,
  mine,
  className,
}: {
  storyId: string;
  /** True when I am the sender: the label changes to "their story". */
  mine?: boolean;
  className?: string;
}) {
  const story = useQuery({
    queryKey: ['dm-story-reply', storyId],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stories')
        .select('id,media_url,media_type,expires_at,author_id')
        .eq('id', storyId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as StoryRow | null;
    },
  });

  const row = story.data ?? null;
  const expired = !row || new Date(row.expires_at).getTime() < Date.now();

  return (
    <QuoteBlock
      className={className}
      label={expired ? 'Story expired' : mine ? 'Replied to their story' : 'Replied to your story'}
      snippet={expired ? 'No longer available' : row.media_type === 'video' ? 'Video story' : 'Photo story'}
      thumbnailUrl={expired ? null : row.media_url}
      onClick={
        expired
          ? () => toast.info('That story has expired')
          : () => window.open(row.media_url, '_blank', 'noopener,noreferrer')
      }
    />
  );
}
