-- ============ helper enums / columns ============
DO $$ BEGIN
  CREATE TYPE public.post_visibility AS ENUM ('public','close_friends');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS quote_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS remix_of uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS remix_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visibility public.post_visibility NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS visibility public.post_visibility NOT NULL DEFAULT 'public';

ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS story_id uuid REFERENCES public.stories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reply_to uuid REFERENCES public.direct_messages(id) ON DELETE SET NULL;

ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS duration_ms integer;

-- ============ blocks / mutes / close friends ============
CREATE TABLE IF NOT EXISTS public.blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocks_select_own" ON public.blocks FOR SELECT TO authenticated
  USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);
CREATE POLICY "blocks_insert_own" ON public.blocks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = blocker_id AND blocker_id <> blocked_id);
CREATE POLICY "blocks_delete_own" ON public.blocks FOR DELETE TO authenticated
  USING (auth.uid() = blocker_id);

CREATE TABLE IF NOT EXISTS public.mutes (
  muter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (muter_id, muted_id)
);
GRANT SELECT, INSERT, DELETE ON public.mutes TO authenticated;
GRANT ALL ON public.mutes TO service_role;
ALTER TABLE public.mutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mutes_own" ON public.mutes FOR ALL TO authenticated
  USING (auth.uid() = muter_id) WITH CHECK (auth.uid() = muter_id AND muter_id <> muted_id);

CREATE TABLE IF NOT EXISTS public.close_friends (
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, friend_id)
);
GRANT SELECT, INSERT, DELETE ON public.close_friends TO authenticated;
GRANT ALL ON public.close_friends TO service_role;
ALTER TABLE public.close_friends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cf_select" ON public.close_friends FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = friend_id);
CREATE POLICY "cf_insert" ON public.close_friends FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id AND owner_id <> friend_id);
CREATE POLICY "cf_delete" ON public.close_friends FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

CREATE OR REPLACE FUNCTION public.is_blocked_pair(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = _a AND blocked_id = _b) OR (blocker_id = _b AND blocked_id = _a)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_close_friend(_owner uuid, _viewer uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.close_friends WHERE owner_id = _owner AND friend_id = _viewer)
$$;

CREATE OR REPLACE FUNCTION public.can_view_author(_author uuid, _visibility public.post_visibility)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _author = auth.uid()
     OR (
       NOT public.is_blocked_pair(_author, auth.uid())
       AND (_visibility = 'public' OR public.is_close_friend(_author, auth.uid()))
     )
$$;

-- posts read policy respects blocks + close friends
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
DROP POLICY IF EXISTS "posts_select" ON public.posts;
DROP POLICY IF EXISTS "Anyone can view posts" ON public.posts;
CREATE POLICY "posts_select_visible" ON public.posts FOR SELECT TO authenticated
  USING (public.can_view_author(author_id, visibility));

DROP POLICY IF EXISTS "Stories are viewable by everyone" ON public.stories;
DROP POLICY IF EXISTS "stories_select" ON public.stories;
DROP POLICY IF EXISTS "Anyone can view stories" ON public.stories;
CREATE POLICY "stories_select_visible" ON public.stories FOR SELECT TO authenticated
  USING (public.can_view_author(author_id, visibility));

-- ============ polls ============
CREATE TABLE IF NOT EXISTS public.post_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL UNIQUE REFERENCES public.posts(id) ON DELETE CASCADE,
  question text NOT NULL DEFAULT '',
  closes_at timestamptz,
  total_votes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_polls TO authenticated;
GRANT ALL ON public.post_polls TO service_role;
ALTER TABLE public.post_polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "polls_select" ON public.post_polls FOR SELECT TO authenticated USING (true);
CREATE POLICY "polls_insert_own" ON public.post_polls FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid()));
CREATE POLICY "polls_delete_own" ON public.post_polls FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.post_poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.post_polls(id) ON DELETE CASCADE,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  vote_count integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_poll_options TO authenticated;
GRANT ALL ON public.post_poll_options TO service_role;
ALTER TABLE public.post_poll_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "poll_options_select" ON public.post_poll_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "poll_options_insert_own" ON public.post_poll_options FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.post_polls pp JOIN public.posts p ON p.id = pp.post_id
    WHERE pp.id = poll_id AND p.author_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.post_poll_votes (
  poll_id uuid NOT NULL REFERENCES public.post_polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.post_poll_options(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_poll_votes TO authenticated;
GRANT ALL ON public.post_poll_votes TO service_role;
ALTER TABLE public.post_poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "poll_votes_select" ON public.post_poll_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "poll_votes_write" ON public.post_poll_votes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.bump_poll_votes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.post_poll_options SET vote_count = vote_count + 1 WHERE id = NEW.option_id;
    UPDATE public.post_polls SET total_votes = total_votes + 1 WHERE id = NEW.poll_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.option_id <> OLD.option_id THEN
      UPDATE public.post_poll_options SET vote_count = GREATEST(vote_count - 1, 0) WHERE id = OLD.option_id;
      UPDATE public.post_poll_options SET vote_count = vote_count + 1 WHERE id = NEW.option_id;
    END IF;
    RETURN NEW;
  ELSE
    UPDATE public.post_poll_options SET vote_count = GREATEST(vote_count - 1, 0) WHERE id = OLD.option_id;
    UPDATE public.post_polls SET total_votes = GREATEST(total_votes - 1, 0) WHERE id = OLD.poll_id;
    RETURN OLD;
  END IF;
END $$;
DROP TRIGGER IF EXISTS trg_poll_votes ON public.post_poll_votes;
CREATE TRIGGER trg_poll_votes AFTER INSERT OR UPDATE OR DELETE ON public.post_poll_votes
  FOR EACH ROW EXECUTE FUNCTION public.bump_poll_votes();

-- ============ post edit history ============
CREATE TABLE IF NOT EXISTS public.post_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  previous_caption text,
  edited_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.post_edits TO authenticated;
GRANT ALL ON public.post_edits TO service_role;
ALTER TABLE public.post_edits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_edits_select" ON public.post_edits FOR SELECT TO authenticated USING (true);
CREATE POLICY "post_edits_insert_own" ON public.post_edits FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid()));

-- ============ remix counter ============
CREATE OR REPLACE FUNCTION public.bump_remix_count()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.remix_of IS NOT NULL THEN
    UPDATE public.posts SET remix_count = remix_count + 1 WHERE id = NEW.remix_of;
  ELSIF TG_OP = 'DELETE' AND OLD.remix_of IS NOT NULL THEN
    UPDATE public.posts SET remix_count = GREATEST(remix_count - 1, 0) WHERE id = OLD.remix_of;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_remix_count ON public.posts;
CREATE TRIGGER trg_remix_count AFTER INSERT OR DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.bump_remix_count();

-- ============ story highlights ============
CREATE TABLE IF NOT EXISTS public.story_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  cover_url text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_highlights TO authenticated;
GRANT ALL ON public.story_highlights TO service_role;
ALTER TABLE public.story_highlights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "highlights_select" ON public.story_highlights FOR SELECT TO authenticated
  USING (NOT public.is_blocked_pair(owner_id, auth.uid()));
CREATE POLICY "highlights_write" ON public.story_highlights FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE IF NOT EXISTS public.story_highlight_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id uuid NOT NULL REFERENCES public.story_highlights(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image',
  caption text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_highlight_items TO authenticated;
GRANT ALL ON public.story_highlight_items TO service_role;
ALTER TABLE public.story_highlight_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "highlight_items_select" ON public.story_highlight_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.story_highlights h WHERE h.id = highlight_id
                 AND NOT public.is_blocked_pair(h.owner_id, auth.uid())));
CREATE POLICY "highlight_items_write" ON public.story_highlight_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.story_highlights h WHERE h.id = highlight_id AND h.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.story_highlights h WHERE h.id = highlight_id AND h.owner_id = auth.uid()));

-- ============ story reactions ============
CREATE TABLE IF NOT EXISTS public.story_reactions (
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id, emoji)
);
GRANT SELECT, INSERT, DELETE ON public.story_reactions TO authenticated;
GRANT ALL ON public.story_reactions TO service_role;
ALTER TABLE public.story_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "story_reactions_select" ON public.story_reactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id
                 AND (s.author_id = auth.uid() OR story_reactions.user_id = auth.uid())));
CREATE POLICY "story_reactions_insert" ON public.story_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "story_reactions_delete" ON public.story_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============ pinned messages ============
CREATE TABLE IF NOT EXISTS public.pinned_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  pinned_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, message_id)
);
GRANT SELECT, INSERT, DELETE ON public.pinned_messages TO authenticated;
GRANT ALL ON public.pinned_messages TO service_role;
ALTER TABLE public.pinned_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pins_select_members" ON public.pinned_messages FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "pins_insert_members" ON public.pinned_messages FOR INSERT TO authenticated
  WITH CHECK (public.is_group_member(group_id, auth.uid()) AND pinned_by = auth.uid());
CREATE POLICY "pins_delete_members" ON public.pinned_messages FOR DELETE TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

-- ============ group role management ============
CREATE OR REPLACE FUNCTION public.is_group_admin(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members
                 WHERE group_id = _group AND user_id = _user AND role IN ('owner','admin'))
$$;
DROP POLICY IF EXISTS "group_members_update_admin" ON public.group_members;
CREATE POLICY "group_members_update_admin" ON public.group_members FOR UPDATE TO authenticated
  USING (public.is_group_admin(group_id, auth.uid()))
  WITH CHECK (public.is_group_admin(group_id, auth.uid()));
GRANT UPDATE ON public.group_members TO authenticated;

-- ============ dm blocking ============
DROP POLICY IF EXISTS "dm_insert_blocked_guard" ON public.direct_messages;
CREATE POLICY "dm_insert_blocked_guard" ON public.direct_messages AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_blocked_pair(sender_id, recipient_id));

-- ============ realtime ============
ALTER TABLE public.post_poll_votes REPLICA IDENTITY FULL;
ALTER TABLE public.pinned_messages REPLICA IDENTITY FULL;
ALTER TABLE public.story_reactions REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.post_poll_votes;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pinned_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.story_reactions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;