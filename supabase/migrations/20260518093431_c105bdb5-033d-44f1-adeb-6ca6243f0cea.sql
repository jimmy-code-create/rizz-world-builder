
CREATE TYPE public.channel_type AS ENUM ('text', 'announcement', 'drops');
CREATE TYPE public.channel_member_role AS ENUM ('owner', 'mod', 'member');
CREATE TYPE public.badge_rarity AS ENUM ('common', 'rare', 'epic', 'legendary', 'mythic');

-- TABLES (no policies yet) --
CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  topic text,
  icon_url text,
  accent_color text DEFAULT '#ff2d92',
  type channel_type NOT NULL DEFAULT 'text',
  is_public boolean NOT NULL DEFAULT true,
  member_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.channel_members (
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role channel_member_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  attachment_url text,
  reply_to uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_channel ON public.messages(channel_id, created_at DESC);

CREATE TABLE public.message_reactions (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE TABLE public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image',
  caption text,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX idx_stories_active ON public.stories(expires_at DESC);

CREATE TABLE public.story_views (
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);

CREATE TABLE public.drops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  media_url text,
  claim_limit integer NOT NULL DEFAULT 100,
  claim_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_drops_active ON public.drops(expires_at DESC);

CREATE TABLE public.drop_claims (
  drop_id uuid NOT NULL REFERENCES public.drops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (drop_id, user_id)
);

CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  color text NOT NULL DEFAULT '#ff2d92',
  rarity badge_rarity NOT NULL DEFAULT 'common',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_badges (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  attachment_url text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dm_pair ON public.direct_messages(sender_id, recipient_id, created_at DESC);

-- ENABLE RLS --
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drop_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- POLICIES --
CREATE POLICY "public channels viewable" ON public.channels FOR SELECT USING (is_public OR owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.channel_members WHERE channel_id = channels.id AND user_id = auth.uid()));
CREATE POLICY "authed users create channels" ON public.channels FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner updates channel" ON public.channels FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "owner deletes channel" ON public.channels FOR DELETE USING (auth.uid() = owner_id);

CREATE POLICY "members viewable" ON public.channel_members FOR SELECT USING (true);
CREATE POLICY "users join themselves" ON public.channel_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users leave themselves" ON public.channel_members FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "messages viewable in joinable channels" ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.channels c WHERE c.id = channel_id AND (c.is_public OR EXISTS (SELECT 1 FROM public.channel_members m WHERE m.channel_id = c.id AND m.user_id = auth.uid())))
);
CREATE POLICY "members post messages" ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = author_id AND EXISTS (SELECT 1 FROM public.channel_members WHERE channel_id = messages.channel_id AND user_id = auth.uid())
);
CREATE POLICY "authors delete messages" ON public.messages FOR DELETE USING (auth.uid() = author_id);

CREATE POLICY "reactions viewable" ON public.message_reactions FOR SELECT USING (true);
CREATE POLICY "users react as self" ON public.message_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users unreact self" ON public.message_reactions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "active stories viewable" ON public.stories FOR SELECT USING (expires_at > now());
CREATE POLICY "users create own stories" ON public.stories FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "users delete own stories" ON public.stories FOR DELETE USING (auth.uid() = author_id);

CREATE POLICY "story views viewable by author" ON public.story_views FOR SELECT USING (
  viewer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.stories WHERE id = story_id AND author_id = auth.uid())
);
CREATE POLICY "users record own views" ON public.story_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY "drops viewable by all" ON public.drops FOR SELECT USING (true);
CREATE POLICY "users create drops" ON public.drops FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "creator deletes drop" ON public.drops FOR DELETE USING (auth.uid() = creator_id);

CREATE POLICY "claims viewable" ON public.drop_claims FOR SELECT USING (true);
CREATE POLICY "users claim as self" ON public.drop_claims FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.drops d WHERE d.id = drop_id AND d.expires_at > now() AND d.claim_count < d.claim_limit)
);

CREATE POLICY "badges viewable" ON public.badges FOR SELECT USING (true);
CREATE POLICY "admins manage badges" ON public.badges FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "user badges viewable" ON public.user_badges FOR SELECT USING (true);
CREATE POLICY "admins grant badges" ON public.user_badges FOR INSERT WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins revoke badges" ON public.user_badges FOR DELETE USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "dm participants view" ON public.direct_messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "users send dm" ON public.direct_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "recipient marks read" ON public.direct_messages FOR UPDATE USING (auth.uid() = recipient_id);

-- TRIGGERS / FUNCTIONS --
CREATE TRIGGER touch_channels BEFORE UPDATE ON public.channels FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.bump_channel_members() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN UPDATE public.channels SET member_count = member_count + 1 WHERE id = NEW.channel_id; RETURN NEW;
  ELSIF TG_OP='DELETE' THEN UPDATE public.channels SET member_count = GREATEST(member_count-1,0) WHERE id = OLD.channel_id; RETURN OLD; END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER bump_channel_members_t AFTER INSERT OR DELETE ON public.channel_members FOR EACH ROW EXECUTE FUNCTION public.bump_channel_members();

CREATE OR REPLACE FUNCTION public.add_owner_as_member() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  INSERT INTO public.channel_members (channel_id, user_id, role) VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END $$;
CREATE TRIGGER add_owner_t AFTER INSERT ON public.channels FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_member();

CREATE OR REPLACE FUNCTION public.bump_story_views() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN UPDATE public.stories SET view_count = view_count + 1 WHERE id = NEW.story_id; RETURN NEW; END $$;
CREATE TRIGGER bump_story_views_t AFTER INSERT ON public.story_views FOR EACH ROW EXECUTE FUNCTION public.bump_story_views();

CREATE OR REPLACE FUNCTION public.validate_drop() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.expires_at <= now() THEN RAISE EXCEPTION 'expires_at must be in the future'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_drop_t BEFORE INSERT ON public.drops FOR EACH ROW EXECUTE FUNCTION public.validate_drop();

CREATE OR REPLACE FUNCTION public.bump_drop_claims() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN UPDATE public.drops SET claim_count = claim_count + 1 WHERE id = NEW.drop_id; RETURN NEW; END $$;
CREATE TRIGGER bump_drop_claims_t AFTER INSERT ON public.drop_claims FOR EACH ROW EXECUTE FUNCTION public.bump_drop_claims();

-- SEED BADGES --
INSERT INTO public.badges (slug, name, description, icon, color, rarity) VALUES
  ('early_rizzer','Early Rizzer','Joined RIZZ in the first wave','Sparkles','#ff2d92','legendary'),
  ('verified','Verified','Identity confirmed','BadgeCheck','#3b82f6','rare'),
  ('hot','Hot','Trending across the feed','Flame','#f97316','epic'),
  ('streamer','Streamer','Active in voice rooms','Mic','#a855f7','rare'),
  ('drop_hunter','Drop Hunter','Claimed 10+ drops','Gift','#10b981','epic'),
  ('story_teller','Storyteller','Posted 50+ stories','BookOpen','#eab308','rare'),
  ('top_100','Top 100','Climbed the Rizz leaderboard','Trophy','#fbbf24','legendary'),
  ('voice_king','Voice King','Hosted 25+ voice rooms','Crown','#f43f5e','mythic'),
  ('mod','Moderator','Keeps the community safe','Shield','#06b6d4','epic'),
  ('founder','Founder','RIZZ team','Star','#ec4899','mythic');

-- REALTIME --
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drops;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drop_claims;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_members;

-- STORAGE BUCKETS --
INSERT INTO storage.buckets (id, name, public) VALUES ('stories','stories',true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('channel-media','channel-media',true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('drops','drops',true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "stories readable" ON storage.objects FOR SELECT USING (bucket_id IN ('stories','channel-media','drops'));
CREATE POLICY "users upload stories" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id IN ('stories','channel-media','drops') AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "users delete own media" ON storage.objects FOR DELETE USING (
  bucket_id IN ('stories','channel-media','drops') AND auth.uid()::text = (storage.foldername(name))[1]
);
