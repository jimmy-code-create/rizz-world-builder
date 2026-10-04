
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '30 days');

ALTER TABLE public.drops
  ADD COLUMN IF NOT EXISTS winner_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS winners_picked_at timestamptz,
  ADD COLUMN IF NOT EXISTS winner_user_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS require_follow boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  topic text,
  icon_url text,
  accent_color text DEFAULT '#ff2d92',
  member_count integer NOT NULL DEFAULT 1,
  is_voice_live boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE TYPE group_member_role AS ENUM ('owner','admin','member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.group_members (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role group_member_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.group_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  uses integer NOT NULL DEFAULT 0,
  max_uses integer,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  attachment_url text,
  reply_to uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_group_member(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group AND user_id = _user)
$$;

CREATE POLICY "groups viewable by members" ON public.groups
  FOR SELECT USING (public.is_group_member(id, auth.uid()) OR owner_id = auth.uid());
CREATE POLICY "users create groups" ON public.groups
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner updates group" ON public.groups
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "owner deletes group" ON public.groups
  FOR DELETE USING (auth.uid() = owner_id);

CREATE POLICY "members viewable by members" ON public.group_members
  FOR SELECT USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "users join self via invite" ON public.group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users leave self" ON public.group_members
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "invites readable" ON public.group_invites
  FOR SELECT USING (true);
CREATE POLICY "members create invites" ON public.group_invites
  FOR INSERT WITH CHECK (public.is_group_member(group_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "owner deletes invites" ON public.group_invites
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_invites.group_id AND g.owner_id = auth.uid()));

CREATE POLICY "members read group messages" ON public.group_messages
  FOR SELECT USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "members post group messages" ON public.group_messages
  FOR INSERT WITH CHECK (auth.uid() = author_id AND public.is_group_member(group_id, auth.uid()));
CREATE POLICY "authors delete own group msgs" ON public.group_messages
  FOR DELETE USING (auth.uid() = author_id);

CREATE OR REPLACE FUNCTION public.bump_group_members() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN UPDATE public.groups SET member_count = member_count + 1 WHERE id = NEW.group_id; RETURN NEW;
  ELSIF TG_OP='DELETE' THEN UPDATE public.groups SET member_count = GREATEST(member_count-1,0) WHERE id = OLD.group_id; RETURN OLD; END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_bump_group_members ON public.group_members;
CREATE TRIGGER trg_bump_group_members AFTER INSERT OR DELETE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.bump_group_members();

CREATE OR REPLACE FUNCTION public.add_group_owner() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role) VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_add_group_owner ON public.groups;
CREATE TRIGGER trg_add_group_owner AFTER INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.add_group_owner();

CREATE OR REPLACE FUNCTION public.enforce_group_friends() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner uuid; has_mutual boolean;
BEGIN
  SELECT owner_id INTO owner FROM public.groups WHERE id = NEW.group_id;
  IF owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.group_members gm
    JOIN public.follows f1 ON f1.follower_id = NEW.user_id AND f1.following_id = gm.user_id
    JOIN public.follows f2 ON f2.follower_id = gm.user_id AND f2.following_id = NEW.user_id
    WHERE gm.group_id = NEW.group_id
  ) INTO has_mutual;
  IF NOT has_mutual THEN
    RAISE EXCEPTION 'friends_only: you must mutually follow at least one member to join';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_enforce_group_friends ON public.group_members;
CREATE TRIGGER trg_enforce_group_friends BEFORE INSERT ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_group_friends();

CREATE TABLE IF NOT EXISTS public.dm_reactions (
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);
ALTER TABLE public.dm_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dm reactions viewable" ON public.dm_reactions FOR SELECT USING (true);
CREATE POLICY "users react own dms" ON public.dm_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users unreact own" ON public.dm_reactions FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.pick_giveaway_winners(_drop uuid)
RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d record; winners uuid[];
BEGIN
  SELECT * INTO d FROM public.drops WHERE id = _drop;
  IF d IS NULL THEN RAISE EXCEPTION 'drop not found'; END IF;
  IF d.creator_id <> auth.uid() THEN RAISE EXCEPTION 'only creator can pick winners'; END IF;
  IF d.winners_picked_at IS NOT NULL THEN RETURN d.winner_user_ids; END IF;
  SELECT COALESCE(array_agg(user_id), '{}') INTO winners FROM (
    SELECT user_id FROM public.drop_claims WHERE drop_id = _drop ORDER BY random() LIMIT d.winner_count
  ) s;
  UPDATE public.drops SET winner_user_ids = winners, winners_picked_at = now() WHERE id = _drop;
  RETURN winners;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_reactions;

INSERT INTO public.profile_effects (slug, name, description, type, rarity, unlock_rizz, preview_color) VALUES
  ('ring-holographic','Holographic Ring','Iridescent prism shimmer','avatar_decoration','epic',300,'#a78bfa'),
  ('ring-galaxy','Galaxy Ring','Swirling cosmic dust','avatar_decoration','legendary',1000,'#7c3aed'),
  ('ring-matrix','Matrix Cascade','Falling green code','avatar_decoration','epic',500,'#22c55e'),
  ('ring-glitch','RGB Glitch','Chromatic aberration','avatar_decoration','rare',200,'#ef4444'),
  ('ring-ice','Ice Crystal','Frozen blue shards','avatar_decoration','rare',150,'#60a5fa'),
  ('ring-rainbow','Rainbow Pulse','Cycling spectrum glow','avatar_decoration','epic',400,'#f472b6'),
  ('ring-void','Void Ring','Pure black violet rim','avatar_decoration','legendary',1500,'#1f1147'),
  ('ring-liquid','Liquid Metal','Mercury flow','avatar_decoration','epic',600,'#94a3b8'),
  ('ring-thunder','Thunder Ring','Crackling lightning','avatar_decoration','rare',250,'#facc15'),
  ('ring-bloom','Cherry Bloom','Pink petals orbit','avatar_decoration','rare',180,'#f9a8d4'),
  ('np-holo','Holo Nameplate','Holographic gradient text','nameplate','epic',350,'#a78bfa'),
  ('np-fire','Fire Nameplate','Flickering ember letters','nameplate','epic',400,'#f97316'),
  ('np-ice','Ice Nameplate','Frosted crystal text','nameplate','rare',200,'#60a5fa'),
  ('np-neon','Neon Sign','Buzzing pink neon','nameplate','rare',150,'#ff2d92'),
  ('np-galaxy','Galaxy Plate','Starfield text','nameplate','legendary',1200,'#7c3aed'),
  ('np-chrome','Chrome Plate','Polished chrome shimmer','nameplate','epic',500,'#cbd5e1'),
  ('np-rainbow','Rainbow Plate','Animated spectrum','nameplate','epic',450,'#f472b6'),
  ('fx-confetti','Confetti Burst','Falling celebration','profile_effect','rare',100,'#facc15'),
  ('fx-snow','Snowfall','Gentle winter snow','profile_effect','rare',150,'#bfdbfe'),
  ('fx-sakura','Sakura Petals','Drifting cherry blossoms','profile_effect','epic',300,'#f9a8d4'),
  ('fx-stars','Starfield','Twinkling stars','profile_effect','rare',200,'#fde68a'),
  ('fx-matrix','Matrix Rain','Green code rain','profile_effect','epic',500,'#22c55e'),
  ('fx-aurora','Aurora','Northern lights wash','profile_effect','legendary',1000,'#22d3ee'),
  ('fx-fire','Flame Wall','Rising fire edges','profile_effect','epic',600,'#f97316'),
  ('fx-bubbles','Bubble Float','Ocean bubbles','profile_effect','rare',180,'#7dd3fc'),
  ('fx-hearts','Floating Hearts','Pink hearts drift','profile_effect','rare',120,'#ec4899'),
  ('fx-glitch','RGB Glitch','Scanline distortion','profile_effect','epic',400,'#ef4444'),
  ('fx-portal','Portal','Swirling vortex','profile_effect','mythic',5000,'#a855f7')
ON CONFLICT (slug) DO NOTHING;
