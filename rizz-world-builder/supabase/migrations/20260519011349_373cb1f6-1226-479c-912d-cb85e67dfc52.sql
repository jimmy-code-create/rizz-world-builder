
-- ============ VOICE ROOMS ============
CREATE TABLE public.voice_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  channel_id uuid,
  title text NOT NULL,
  topic text,
  is_live boolean NOT NULL DEFAULT true,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  listener_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.voice_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "voice rooms viewable" ON public.voice_rooms FOR SELECT USING (true);
CREATE POLICY "users create rooms" ON public.voice_rooms FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "host updates room" ON public.voice_rooms FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "host deletes room" ON public.voice_rooms FOR DELETE USING (auth.uid() = host_id);

CREATE TYPE voice_role AS ENUM ('host','speaker','listener');
CREATE TABLE public.voice_participants (
  room_id uuid NOT NULL REFERENCES public.voice_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role voice_role NOT NULL DEFAULT 'listener',
  muted boolean NOT NULL DEFAULT true,
  hand_raised boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);
ALTER TABLE public.voice_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants viewable" ON public.voice_participants FOR SELECT USING (true);
CREATE POLICY "users join as self" ON public.voice_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update self in room" ON public.voice_participants FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users leave self" ON public.voice_participants FOR DELETE USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_participants;

-- ============ PROFILE EFFECTS ============
CREATE TYPE profile_effect_type AS ENUM ('avatar_decoration','profile_effect','nameplate');
CREATE TABLE public.profile_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  type profile_effect_type NOT NULL,
  rarity badge_rarity NOT NULL DEFAULT 'common',
  unlock_rizz integer NOT NULL DEFAULT 0,
  preview_color text NOT NULL DEFAULT '#ff2d92',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_effects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "effects viewable" ON public.profile_effects FOR SELECT USING (true);
CREATE POLICY "admins manage effects" ON public.profile_effects FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TABLE public.user_profile_effects (
  user_id uuid NOT NULL,
  effect_id uuid NOT NULL REFERENCES public.profile_effects(id) ON DELETE CASCADE,
  equipped boolean NOT NULL DEFAULT false,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, effect_id)
);
ALTER TABLE public.user_profile_effects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user effects viewable" ON public.user_profile_effects FOR SELECT USING (true);
CREATE POLICY "users acquire own effects" ON public.user_profile_effects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users equip own effects" ON public.user_profile_effects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users drop own effects" ON public.user_profile_effects FOR DELETE USING (auth.uid() = user_id);

-- seed effects (CSS-driven, no asset URLs needed)
INSERT INTO public.profile_effects (slug,name,description,type,rarity,unlock_rizz,preview_color) VALUES
('ring-neon','Neon Pulse','Glowing pink ring that pulses','avatar_decoration','common',0,'#ff2d92'),
('ring-aurora','Aurora Swirl','Spinning aurora gradient ring','avatar_decoration','rare',500,'#a855f7'),
('ring-fire','Fire Halo','Flickering ember ring','avatar_decoration','epic',1500,'#f97316'),
('ring-holo','Holographic','Iridescent shifting ring','avatar_decoration','legendary',5000,'#22d3ee'),
('ring-sakura','Sakura Petals','Falling pink petals around avatar','avatar_decoration','epic',2500,'#fb7185'),
('ring-electric','Electric Arc','Crackling electric ring','avatar_decoration','mythic',10000,'#facc15'),
('fx-sparkles','Sparkles','Floating sparkles on profile','profile_effect','rare',300,'#fde047'),
('fx-confetti','Confetti','Bursting confetti','profile_effect','epic',1000,'#ec4899'),
('fx-snow','Snowfall','Gentle snowflakes','profile_effect','common',100,'#e0f2fe'),
('fx-glitch','Glitch','RGB-split glitch overlay','profile_effect','legendary',5000,'#7c3aed'),
('np-gold','Gold Nameplate','Animated gold gradient name','nameplate','epic',1500,'#fbbf24'),
('np-vapor','Vaporwave Plate','Pink/cyan vaporwave name','nameplate','rare',500,'#22d3ee'),
('np-mythic','Mythic Plate','Mythic prismatic nameplate','nameplate','mythic',10000,'#a855f7');

-- ============ THEME PREFS ON PROFILES ============
ALTER TABLE public.profiles
  ADD COLUMN theme_preset text NOT NULL DEFAULT 'nightclub',
  ADD COLUMN theme_mode text NOT NULL DEFAULT 'dark',
  ADD COLUMN ui_density text NOT NULL DEFAULT 'comfy',
  ADD COLUMN reduced_motion boolean NOT NULL DEFAULT false;

-- ============ BADGES UPGRADE ============
ALTER TABLE public.badges
  ADD COLUMN animated boolean NOT NULL DEFAULT false,
  ADD COLUMN glow_color text NOT NULL DEFAULT '#ff2d92',
  ADD COLUMN tier integer NOT NULL DEFAULT 1;

-- seed new badges (slug unique guard via ON CONFLICT)
INSERT INTO public.badges (slug,name,description,icon,color,rarity,animated,glow_color,tier) VALUES
('og','OG','One of the first to join RIZZ','crown','#fbbf24','legendary',true,'#fbbf24',5),
('hypesquad','HypeSquad','Bring the hype to the community','sparkles','#ec4899','rare',true,'#ec4899',2),
('bug_hunter','Bug Hunter','Reported a confirmed bug','bug','#22c55e','epic',false,'#22c55e',3),
('verified_creator','Verified Creator','Official creator on RIZZ','badge-check','#06b6d4','epic',true,'#06b6d4',3),
('rizz_royalty','Rizz Royalty','Top 1% Rizz Score','crown','#a855f7','mythic',true,'#a855f7',5),
('first_post','First Post','Posted your first vibe','image','#94a3b8','common',false,'#94a3b8',1),
('first_drop','First Drop','Claimed your first drop','gift','#f97316','common',false,'#f97316',1),
('channel_founder','Channel Founder','Created a public channel','hash','#22d3ee','rare',false,'#22d3ee',2),
('voice_veteran','Voice Veteran','Hosted 5 voice rooms','mic','#ec4899','epic',true,'#ec4899',3),
('rizz_100','Centurion','Reached 100 Rizz','flame','#f59e0b','common',false,'#f59e0b',1),
('rizz_1000','Rizz Master','Reached 1,000 Rizz','flame','#ec4899','epic',true,'#ec4899',3),
('rizz_10000','Rizz Legend','Reached 10,000 Rizz','flame','#a855f7','mythic',true,'#a855f7',5)
ON CONFLICT (slug) DO NOTHING;

-- ============ AUTO-AWARD TRIGGERS ============
CREATE OR REPLACE FUNCTION public.award_badge(_user uuid, _slug text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE bid uuid;
BEGIN
  SELECT id INTO bid FROM public.badges WHERE slug=_slug LIMIT 1;
  IF bid IS NOT NULL THEN
    INSERT INTO public.user_badges (user_id, badge_id) VALUES (_user, bid) ON CONFLICT DO NOTHING;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.on_first_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF (SELECT count(*) FROM public.posts WHERE author_id = NEW.author_id) = 1 THEN
    PERFORM public.award_badge(NEW.author_id, 'first_post');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_first_post AFTER INSERT ON public.posts FOR EACH ROW EXECUTE FUNCTION public.on_first_post();

CREATE OR REPLACE FUNCTION public.on_first_drop_claim()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF (SELECT count(*) FROM public.drop_claims WHERE user_id = NEW.user_id) = 1 THEN
    PERFORM public.award_badge(NEW.user_id, 'first_drop');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_first_drop AFTER INSERT ON public.drop_claims FOR EACH ROW EXECUTE FUNCTION public.on_first_drop_claim();

CREATE OR REPLACE FUNCTION public.on_channel_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.award_badge(NEW.owner_id, 'channel_founder');
  RETURN NEW;
END $$;
CREATE TRIGGER trg_channel_founder AFTER INSERT ON public.channels FOR EACH ROW EXECUTE FUNCTION public.on_channel_created();

CREATE OR REPLACE FUNCTION public.on_rizz_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.rizz_score >= 100 AND COALESCE(OLD.rizz_score,0) < 100 THEN PERFORM public.award_badge(NEW.id,'rizz_100'); END IF;
  IF NEW.rizz_score >= 1000 AND COALESCE(OLD.rizz_score,0) < 1000 THEN PERFORM public.award_badge(NEW.id,'rizz_1000'); END IF;
  IF NEW.rizz_score >= 10000 AND COALESCE(OLD.rizz_score,0) < 10000 THEN PERFORM public.award_badge(NEW.id,'rizz_10000'); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_rizz_milestones AFTER UPDATE OF rizz_score ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.on_rizz_change();

-- ============ DATA INTEGRITY ============
ALTER TABLE public.post_reactions ADD CONSTRAINT post_reactions_unique UNIQUE (post_id, user_id, emoji);
