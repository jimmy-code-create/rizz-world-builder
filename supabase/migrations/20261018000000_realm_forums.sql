-- ============================================================
-- PHASE 8b: Forums inside a realm.
--
-- 1. realm_rooms gains the 'forum' kind, so a forum is a channel.
-- 2. One configuration row per forum channel (realm_forums) plus its
--    tags, statuses and post templates.
-- 3. Posts, replies, reactions, likes, read state, tag follows and mutes.
-- 4. Every write that has a rule attached (permission, slowmode, lock,
--    required tag, archive) goes through a SECURITY DEFINER RPC, so the
--    rules live in one place and the client is never the gate.
-- ============================================================

-- ---------- 1. The forum channel kind ----------
ALTER TABLE public.realm_rooms
  DROP CONSTRAINT IF EXISTS realm_rooms_kind_check;
ALTER TABLE public.realm_rooms
  ADD CONSTRAINT realm_rooms_kind_check
  CHECK (kind IN ('text', 'announcement', 'voice', 'forum'));

CREATE INDEX IF NOT EXISTS idx_realm_rooms_kind
ON public.realm_rooms (realm_id, kind);

-- ---------- 2. Membership / management helpers ----------
CREATE OR REPLACE FUNCTION public.realm_is_member(_realm uuid, _user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT _user IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.realm_members rm WHERE rm.realm_id = _realm AND rm.user_id = _user)
      OR EXISTS (SELECT 1 FROM public.realms r WHERE r.id = _realm AND r.owner_id = _user)
    );
$$;

REVOKE ALL ON FUNCTION public.realm_is_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.realm_is_member(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.realm_can_manage(_realm uuid, _user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT _user IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.realms r WHERE r.id = _realm AND r.owner_id = _user)
      OR public.realm_role_of(_realm, _user) IN ('owner', 'mod')
    );
$$;

REVOKE ALL ON FUNCTION public.realm_can_manage(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.realm_can_manage(uuid, uuid) TO authenticated;

-- ---------- 3. Forum configuration ----------
CREATE TABLE IF NOT EXISTS public.realm_forums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES public.realms(id) ON DELETE CASCADE,
  room_id uuid NOT NULL UNIQUE REFERENCES public.realm_rooms(id) ON DELETE CASCADE,
  banner_url text,
  icon_emoji text,
  accent_color text,
  description text,
  guidelines text,
  -- The pinned "read this first" thread, once a moderator picks one.
  guidelines_post_id uuid,
  default_layout text NOT NULL DEFAULT 'card'
    CHECK (default_layout IN ('card', 'compact', 'gallery')),
  default_sort text NOT NULL DEFAULT 'activity'
    CHECK (default_sort IN ('activity', 'new', 'top', 'unanswered')),
  default_density text NOT NULL DEFAULT 'comfortable'
    CHECK (default_density IN ('comfortable', 'compact')),
  require_tag boolean NOT NULL DEFAULT false,
  allowed_attachments text[] NOT NULL DEFAULT ARRAY['image']::text[],
  reactions text[] NOT NULL DEFAULT ARRAY['👍', '❤️', '🔥', '😂', '🎉', '👀']::text[],
  slowmode_seconds integer NOT NULL DEFAULT 0
    CHECK (slowmode_seconds BETWEEN 0 AND 21600),
  post_permission text NOT NULL DEFAULT 'everyone'
    CHECK (post_permission IN ('everyone', 'mods')),
  reply_permission text NOT NULL DEFAULT 'everyone'
    CHECK (reply_permission IN ('everyone', 'mods')),
  auto_archive_days integer
    CHECK (auto_archive_days IS NULL OR auto_archive_days BETWEEN 1 AND 365),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_realm_forums_realm ON public.realm_forums (realm_id);

CREATE TABLE IF NOT EXISTS public.realm_forum_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forum_id uuid NOT NULL REFERENCES public.realm_forums(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 24),
  color text NOT NULL DEFAULT '#38bdf8',
  emoji text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (forum_id, name)
);

CREATE INDEX IF NOT EXISTS idx_realm_forum_tags_forum
ON public.realm_forum_tags (forum_id, position);

CREATE TABLE IF NOT EXISTS public.realm_forum_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forum_id uuid NOT NULL REFERENCES public.realm_forums(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 24),
  color text NOT NULL DEFAULT '#22c55e',
  emoji text,
  position integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  is_closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (forum_id, name)
);

CREATE INDEX IF NOT EXISTS idx_realm_forum_statuses_forum
ON public.realm_forum_statuses (forum_id, position);

CREATE TABLE IF NOT EXISTS public.realm_forum_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forum_id uuid NOT NULL REFERENCES public.realm_forums(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
  emoji text,
  description text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (forum_id, name)
);

CREATE INDEX IF NOT EXISTS idx_realm_forum_templates_forum
ON public.realm_forum_templates (forum_id, position);

-- ---------- 4. Posts and replies ----------
CREATE TABLE IF NOT EXISTS public.realm_forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forum_id uuid NOT NULL REFERENCES public.realm_forums(id) ON DELETE CASCADE,
  realm_id uuid NOT NULL REFERENCES public.realms(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.realm_rooms(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 160),
  body text NOT NULL DEFAULT '',
  cover_url text,
  attachments text[] NOT NULL DEFAULT ARRAY[]::text[],
  tag_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  status_id uuid REFERENCES public.realm_forum_statuses(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.realm_forum_templates(id) ON DELETE SET NULL,
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_pinned boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  is_solved boolean NOT NULL DEFAULT false,
  best_reply_id uuid,
  reply_count integer NOT NULL DEFAULT 0,
  like_count integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_realm_forum_posts_forum_activity
ON public.realm_forum_posts (forum_id, last_activity_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_realm_forum_posts_author
ON public.realm_forum_posts (author_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.realm_forum_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.realm_forum_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.realm_forum_replies(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 8000),
  like_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_realm_forum_replies_post
ON public.realm_forum_replies (post_id, created_at);

-- The best answer points back at a reply, and the guidelines pointer at a post;
-- both FKs are added after every table exists.
ALTER TABLE public.realm_forum_posts
  DROP CONSTRAINT IF EXISTS realm_forum_posts_best_reply_id_fkey;
ALTER TABLE public.realm_forum_posts
  ADD CONSTRAINT realm_forum_posts_best_reply_id_fkey
  FOREIGN KEY (best_reply_id) REFERENCES public.realm_forum_replies(id) ON DELETE SET NULL;

ALTER TABLE public.realm_forums
  DROP CONSTRAINT IF EXISTS realm_forums_guidelines_post_id_fkey;
ALTER TABLE public.realm_forums
  ADD CONSTRAINT realm_forums_guidelines_post_id_fkey
  FOREIGN KEY (guidelines_post_id) REFERENCES public.realm_forum_posts(id) ON DELETE SET NULL;

-- ---------- 5. Reactions, likes, read state, follows, mutes ----------
CREATE TABLE IF NOT EXISTS public.realm_forum_reactions (
  post_id uuid NOT NULL REFERENCES public.realm_forum_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS public.realm_forum_reply_reactions (
  reply_id uuid NOT NULL REFERENCES public.realm_forum_replies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (reply_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS public.realm_forum_likes (
  post_id uuid NOT NULL REFERENCES public.realm_forum_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.realm_forum_reply_likes (
  reply_id uuid NOT NULL REFERENCES public.realm_forum_replies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (reply_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.realm_forum_reads (
  post_id uuid NOT NULL REFERENCES public.realm_forum_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_realm_forum_reads_user
ON public.realm_forum_reads (user_id, last_seen_at DESC);

-- Following a tag is what makes "new post in a tag you follow" notify you.
CREATE TABLE IF NOT EXISTS public.realm_forum_tag_follows (
  tag_id uuid NOT NULL REFERENCES public.realm_forum_tags(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tag_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_realm_forum_tag_follows_user
ON public.realm_forum_tag_follows (user_id);

-- A mute row is one specific thing: a whole forum (room_id null and post_id
-- null), a single forum channel, or one thread.
CREATE TABLE IF NOT EXISTS public.realm_forum_mutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  realm_id uuid NOT NULL REFERENCES public.realms(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.realm_rooms(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.realm_forum_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (user_id, realm_id, room_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_realm_forum_mutes_user
ON public.realm_forum_mutes (user_id, realm_id);

-- ---------- 6. Row level security ----------
ALTER TABLE public.realm_forums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realm_forum_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realm_forum_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realm_forum_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realm_forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realm_forum_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realm_forum_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realm_forum_reply_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realm_forum_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realm_forum_reply_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realm_forum_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realm_forum_tag_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realm_forum_mutes ENABLE ROW LEVEL SECURITY;

-- Members read the forum and its setup; moderators write it. Every table below
-- reaches its realm through the forum row, so one helper answers for all.
DROP POLICY IF EXISTS "forum config readable by members" ON public.realm_forums;
CREATE POLICY "forum config readable by members"
ON public.realm_forums FOR SELECT TO authenticated
USING (public.realm_is_member(realm_forums.realm_id));

DROP POLICY IF EXISTS "forum config writable by mods" ON public.realm_forums;
CREATE POLICY "forum config writable by mods"
ON public.realm_forums FOR ALL TO authenticated
USING (public.realm_can_manage(realm_forums.realm_id))
WITH CHECK (public.realm_can_manage(realm_forums.realm_id));

DO $$
DECLARE
  spec record;
  policy_read text;
  policy_write text;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('realm_forum_tags'),
      ('realm_forum_statuses'),
      ('realm_forum_templates')
    ) AS t(name)
  LOOP
    policy_read := 'forum ' || spec.name || ' readable by members';
    policy_write := 'forum ' || spec.name || ' writable by mods';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_read, spec.name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_write, spec.name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (
         EXISTS (
           SELECT 1 FROM public.realm_forums f
           WHERE f.id = %I.forum_id AND public.realm_is_member(f.realm_id)
         )
       )',
      policy_read, spec.name, spec.name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (
         EXISTS (
           SELECT 1 FROM public.realm_forums f
           WHERE f.id = %I.forum_id AND public.realm_can_manage(f.realm_id)
         )
       ) WITH CHECK (
         EXISTS (
           SELECT 1 FROM public.realm_forums f
           WHERE f.id = %I.forum_id AND public.realm_can_manage(f.realm_id)
         )
       )',
      policy_write, spec.name, spec.name, spec.name);
  END LOOP;
END $$;

-- Posts and replies: members read, and nothing but the RPCs below writes them.
-- That is deliberate — permission, slowmode, lock and required-tag rules are
-- enforced in the functions, and there is no policy for a client to go around.
DROP POLICY IF EXISTS "forum posts readable by members" ON public.realm_forum_posts;
CREATE POLICY "forum posts readable by members"
ON public.realm_forum_posts FOR SELECT TO authenticated
USING (public.realm_is_member(realm_forum_posts.realm_id));

DROP POLICY IF EXISTS "forum replies readable by members" ON public.realm_forum_replies;
CREATE POLICY "forum replies readable by members"
ON public.realm_forum_replies FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.realm_forum_posts p
    WHERE p.id = realm_forum_replies.post_id
      AND public.realm_is_member(p.realm_id)
  )
);

-- Reactions and likes are readable by every member who can already read the
-- thread — a chip has to show other people's reactions, not just your own — but
-- only the owner of a row may add or remove it.
DROP POLICY IF EXISTS "realm_forum_reactions readable" ON public.realm_forum_reactions;
DROP POLICY IF EXISTS "realm_forum_reactions own rows" ON public.realm_forum_reactions;
DROP POLICY IF EXISTS "forum post reactions readable by members" ON public.realm_forum_reactions;
DROP POLICY IF EXISTS "forum post reactions own rows" ON public.realm_forum_reactions;
CREATE POLICY "forum post reactions readable by members"
ON public.realm_forum_reactions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.realm_forum_posts p
    WHERE p.id = realm_forum_reactions.post_id AND public.realm_is_member(p.realm_id)
  )
);
CREATE POLICY "forum post reactions own rows"
ON public.realm_forum_reactions FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "forum reply reactions readable by members" ON public.realm_forum_reply_reactions;
DROP POLICY IF EXISTS "forum reply reactions own rows" ON public.realm_forum_reply_reactions;
CREATE POLICY "forum reply reactions readable by members"
ON public.realm_forum_reply_reactions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.realm_forum_replies r
    JOIN public.realm_forum_posts p ON p.id = r.post_id
    WHERE r.id = realm_forum_reply_reactions.reply_id AND public.realm_is_member(p.realm_id)
  )
);
CREATE POLICY "forum reply reactions own rows"
ON public.realm_forum_reply_reactions FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "forum likes readable by members" ON public.realm_forum_likes;
DROP POLICY IF EXISTS "forum likes own rows" ON public.realm_forum_likes;
CREATE POLICY "forum likes readable by members"
ON public.realm_forum_likes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.realm_forum_posts p
    WHERE p.id = realm_forum_likes.post_id AND public.realm_is_member(p.realm_id)
  )
);
CREATE POLICY "forum likes own rows"
ON public.realm_forum_likes FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "forum reply likes readable by members" ON public.realm_forum_reply_likes;
DROP POLICY IF EXISTS "forum reply likes own rows" ON public.realm_forum_reply_likes;
CREATE POLICY "forum reply likes readable by members"
ON public.realm_forum_reply_likes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.realm_forum_replies r
    JOIN public.realm_forum_posts p ON p.id = r.post_id
    WHERE r.id = realm_forum_reply_likes.reply_id AND public.realm_is_member(p.realm_id)
  )
);
CREATE POLICY "forum reply likes own rows"
ON public.realm_forum_reply_likes FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "forum reads own rows" ON public.realm_forum_reads;
CREATE POLICY "forum reads own rows"
ON public.realm_forum_reads FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "forum tag follows own rows" ON public.realm_forum_tag_follows;
CREATE POLICY "forum tag follows own rows"
ON public.realm_forum_tag_follows FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "forum mutes own rows" ON public.realm_forum_mutes;
CREATE POLICY "forum mutes own rows"
ON public.realm_forum_mutes FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

GRANT SELECT ON public.realm_forums, public.realm_forum_tags, public.realm_forum_statuses,
  public.realm_forum_templates, public.realm_forum_posts, public.realm_forum_replies TO authenticated;
GRANT ALL ON public.realm_forum_reactions, public.realm_forum_reply_reactions,
  public.realm_forum_likes, public.realm_forum_reply_likes, public.realm_forum_reads,
  public.realm_forum_tag_follows, public.realm_forum_mutes TO authenticated;
GRANT ALL ON public.realm_forums, public.realm_forum_tags, public.realm_forum_statuses,
  public.realm_forum_templates TO authenticated;

-- ---------- 7. Realtime: the thread list and a thread are both live ----------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'realm_forum_posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.realm_forum_posts;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'realm_forum_replies'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.realm_forum_replies;
  END IF;
END $$;

-- ---------- 8. Defaults for each new forum channel ----------
CREATE OR REPLACE FUNCTION public.forum_seed_defaults(_forum_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.realm_forum_tags (forum_id, name, color, emoji, position)
  VALUES
    (_forum_id, 'Discussion', '#38bdf8', '💬', 0),
    (_forum_id, 'Question', '#a855f7', '❓', 1),
    (_forum_id, 'Bug', '#f87171', '🐞', 2),
    (_forum_id, 'Guide', '#34d399', '📘', 3)
  ON CONFLICT (forum_id, name) DO NOTHING;

  INSERT INTO public.realm_forum_statuses (forum_id, name, color, emoji, position, is_default, is_closed)
  VALUES
    (_forum_id, 'Open', '#38bdf8', '🟦', 0, true, false),
    (_forum_id, 'In progress', '#f59e0b', '🛠️', 1, false, false),
    (_forum_id, 'Solved', '#22c55e', '✅', 2, false, true),
    (_forum_id, 'Closed', '#94a3b8', '🔒', 3, false, true)
  ON CONFLICT (forum_id, name) DO NOTHING;

  INSERT INTO public.realm_forum_templates (forum_id, name, emoji, description, fields, position)
  VALUES (
    _forum_id,
    'Bug report',
    '🐞',
    'Something is broken — give us the detail to fix it fast.',
    '[{"label":"Steps to reproduce","placeholder":"1. Open …","required":true},{"label":"Expected","placeholder":"What should have happened","required":true},{"label":"Actual","placeholder":"What happened instead","required":true}]'::jsonb,
    0
  )
  ON CONFLICT (forum_id, name) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.forum_seed_defaults(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forum_seed_defaults(uuid) TO authenticated;

-- Creating a forum channel sets up its forum row and starter tags/statuses.
CREATE OR REPLACE FUNCTION public.forum_defaults_on_room()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_forum_id uuid;
BEGIN
  IF NEW.kind <> 'forum' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.realm_forums (realm_id, room_id, icon_emoji, description)
  VALUES (NEW.realm_id, NEW.id, '🗂️', COALESCE(NEW.topic, 'Ask, answer and keep what matters.'))
  ON CONFLICT (room_id) DO NOTHING
  RETURNING id INTO v_forum_id;

  IF v_forum_id IS NULL THEN
    SELECT id INTO v_forum_id FROM public.realm_forums WHERE room_id = NEW.id;
  END IF;

  IF v_forum_id IS NOT NULL THEN
    PERFORM public.forum_seed_defaults(v_forum_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_realm_forum_defaults ON public.realm_rooms;
CREATE TRIGGER trg_realm_forum_defaults
AFTER INSERT ON public.realm_rooms
FOR EACH ROW EXECUTE FUNCTION public.forum_defaults_on_room();

-- Backfill: any forum channel that predates this migration gets its setup too.
DO $$
DECLARE
  r record;
  v_forum_id uuid;
BEGIN
  FOR r IN SELECT id, realm_id, topic FROM public.realm_rooms WHERE kind = 'forum' LOOP
    INSERT INTO public.realm_forums (realm_id, room_id, icon_emoji, description)
    VALUES (r.realm_id, r.id, '🗂️', COALESCE(r.topic, 'Ask, answer and keep what matters.'))
    ON CONFLICT (room_id) DO NOTHING
    RETURNING id INTO v_forum_id;
    IF v_forum_id IS NOT NULL THEN
      PERFORM public.forum_seed_defaults(v_forum_id);
    END IF;
  END LOOP;
END $$;

-- ---------- 9. Counter and activity triggers ----------
CREATE OR REPLACE FUNCTION public.forum_bump_reply_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.realm_forum_posts
       SET reply_count = reply_count + 1,
           last_activity_at = GREATEST(last_activity_at, NEW.created_at)
     WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.realm_forum_posts
       SET reply_count = GREATEST(reply_count - 1, 0)
     WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_forum_reply_count ON public.realm_forum_replies;
CREATE TRIGGER trg_forum_reply_count
AFTER INSERT OR DELETE ON public.realm_forum_replies
FOR EACH ROW EXECUTE FUNCTION public.forum_bump_reply_count();

CREATE OR REPLACE FUNCTION public.forum_bump_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.realm_forum_posts
       SET like_count = like_count + 1
     WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.realm_forum_posts
       SET like_count = GREATEST(like_count - 1, 0)
     WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_forum_like_count ON public.realm_forum_likes;
CREATE TRIGGER trg_forum_like_count
AFTER INSERT OR DELETE ON public.realm_forum_likes
FOR EACH ROW EXECUTE FUNCTION public.forum_bump_like_count();

CREATE OR REPLACE FUNCTION public.forum_bump_reply_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.realm_forum_replies SET like_count = like_count + 1 WHERE id = NEW.reply_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.realm_forum_replies SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.reply_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_forum_reply_like_count ON public.realm_forum_reply_likes;
CREATE TRIGGER trg_forum_reply_like_count
AFTER INSERT OR DELETE ON public.realm_forum_reply_likes
FOR EACH ROW EXECUTE FUNCTION public.forum_bump_reply_like_count();

-- Editing a post's body is activity; a pin or a lock is not.
CREATE OR REPLACE FUNCTION public.forum_touch_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.tag_ids IS DISTINCT FROM OLD.tag_ids
     OR NEW.status_id IS DISTINCT FROM OLD.status_id
  THEN
    NEW.last_activity_at := GREATEST(NEW.last_activity_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forum_touch_post ON public.realm_forum_posts;
CREATE TRIGGER trg_forum_touch_post
BEFORE UPDATE ON public.realm_forum_posts
FOR EACH ROW EXECUTE FUNCTION public.forum_touch_post();

CREATE OR REPLACE FUNCTION public.forum_touch_forum()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forum_touch_forum ON public.realm_forums;
CREATE TRIGGER trg_forum_touch_forum
BEFORE UPDATE ON public.realm_forums
FOR EACH ROW EXECUTE FUNCTION public.forum_touch_forum();

-- ---------- 10. Notifications: replies, and tags you follow ----------
CREATE OR REPLACE FUNCTION public.forum_muted(_user uuid, _realm uuid, _room uuid, _post uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.realm_forum_mutes m
    WHERE m.user_id = _user
      AND m.realm_id = _realm
      AND (m.room_id IS NULL OR m.room_id = _room)
      AND (m.post_id IS NULL OR m.post_id = _post)
  );
$$;

REVOKE ALL ON FUNCTION public.forum_muted(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forum_muted(uuid, uuid, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.forum_notify_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_post public.realm_forum_posts%ROWTYPE;
  v_author_name text;
  v_slug text;
BEGIN
  SELECT * INTO v_post FROM public.realm_forum_posts WHERE id = NEW.post_id;
  IF NOT FOUND OR v_post.author_id = NEW.author_id THEN
    RETURN NEW;
  END IF;
  IF public.forum_muted(v_post.author_id, v_post.realm_id, v_post.room_id, v_post.id) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.display_name, p.username) INTO v_author_name
    FROM public.profiles p WHERE p.id = NEW.author_id;
  SELECT slug INTO v_slug FROM public.realms WHERE id = v_post.realm_id;

  INSERT INTO public.notifications (user_id, actor_id, type, title, body, data)
  VALUES (
    v_post.author_id,
    NEW.author_id,
    'forum_reply',
    v_post.title,
    left(NEW.body, 140),
    jsonb_build_object(
      'kind', 'forum_reply',
      'realm_id', v_post.realm_id,
      'realm_slug', v_slug,
      'room_id', v_post.room_id,
      'post_id', v_post.id,
      'title', v_post.title,
      'actor', v_author_name
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forum_notify_reply ON public.realm_forum_replies;
CREATE TRIGGER trg_forum_notify_reply
AFTER INSERT ON public.realm_forum_replies
FOR EACH ROW EXECUTE FUNCTION public.forum_notify_reply();

CREATE OR REPLACE FUNCTION public.forum_notify_tag_followers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_forum public.realm_forums%ROWTYPE;
  v_slug text;
BEGIN
  IF NEW.tag_ids IS NULL OR array_length(NEW.tag_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_forum FROM public.realm_forums WHERE id = NEW.forum_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT slug INTO v_slug FROM public.realms WHERE id = NEW.realm_id;

  INSERT INTO public.notifications (user_id, actor_id, type, title, body, data)
  SELECT
    f.user_id,
    NEW.author_id,
    'forum_tag',
    NEW.title,
    left(NEW.title, 140),
    jsonb_build_object(
      'kind', 'forum_tag',
      'realm_id', NEW.realm_id,
      'realm_slug', v_slug,
      'room_id', NEW.room_id,
      'post_id', NEW.id,
      'title', NEW.title
    )
  FROM public.realm_forum_tag_follows f
  WHERE f.tag_id = ANY (NEW.tag_ids)
    AND f.user_id <> NEW.author_id
    AND NOT public.forum_muted(f.user_id, NEW.realm_id, NEW.room_id, NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forum_notify_tag_followers ON public.realm_forum_posts;
CREATE TRIGGER trg_forum_notify_tag_followers
AFTER INSERT ON public.realm_forum_posts
FOR EACH ROW EXECUTE FUNCTION public.forum_notify_tag_followers();

-- ---------- 11. Settings, so a forum is customizable per realm ----------
CREATE OR REPLACE FUNCTION public.forum_ensure_config(_room_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_room public.realm_rooms%ROWTYPE;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first';
  END IF;

  SELECT * INTO v_room FROM public.realm_rooms WHERE id = _room_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That forum channel no longer exists';
  END IF;
  IF v_room.kind <> 'forum' THEN
    RAISE EXCEPTION 'That channel is not a forum';
  END IF;
  IF NOT public.realm_can_manage(v_room.realm_id) THEN
    RAISE EXCEPTION 'Only moderators can set up this forum';
  END IF;

  INSERT INTO public.realm_forums (realm_id, room_id, icon_emoji, description)
  VALUES (v_room.realm_id, v_room.id, '🗂️', COALESCE(v_room.topic, 'Ask, answer and keep what matters.'))
  ON CONFLICT (room_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.realm_forums WHERE room_id = v_room.id;
  END IF;

  PERFORM public.forum_seed_defaults(v_id);
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.forum_ensure_config(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forum_ensure_config(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.forum_save_settings(_room_id uuid, _settings jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_allowed text[];
BEGIN
  v_id := public.forum_ensure_config(_room_id);

  v_allowed := ARRAY(
    SELECT jsonb_array_elements_text(COALESCE(_settings -> 'allowed_attachments', '["image"]'::jsonb))
  );
  IF EXISTS (
    SELECT 1 FROM unnest(v_allowed) AS a WHERE a NOT IN ('image', 'video', 'audio', 'file', 'link')
  ) THEN
    RAISE EXCEPTION 'Unknown attachment type';
  END IF;

  UPDATE public.realm_forums
     SET banner_url = NULLIF(_settings ->> 'banner_url', ''),
         icon_emoji = NULLIF(_settings ->> 'icon_emoji', ''),
         accent_color = NULLIF(_settings ->> 'accent_color', ''),
         description = NULLIF(_settings ->> 'description', ''),
         guidelines = NULLIF(_settings ->> 'guidelines', ''),
         default_layout = COALESCE(_settings ->> 'default_layout', default_layout),
         default_sort = COALESCE(_settings ->> 'default_sort', default_sort),
         default_density = COALESCE(_settings ->> 'default_density', default_density),
         require_tag = COALESCE((_settings ->> 'require_tag')::boolean, require_tag),
         allowed_attachments = v_allowed,
         reactions = ARRAY(
           SELECT value FROM jsonb_array_elements_text(
             COALESCE(_settings -> 'reactions', to_jsonb(reactions))
           ) AS value
           WHERE btrim(value) <> ''
         ),
         slowmode_seconds = COALESCE((_settings ->> 'slowmode_seconds')::integer, slowmode_seconds),
         post_permission = COALESCE(_settings ->> 'post_permission', post_permission),
         reply_permission = COALESCE(_settings ->> 'reply_permission', reply_permission),
         auto_archive_days = CASE
           WHEN _settings ? 'auto_archive_days'
             THEN NULLIF(_settings ->> 'auto_archive_days', '')::integer
           ELSE auto_archive_days
         END
   WHERE id = v_id;

  IF (SELECT count(*) FROM public.realm_forums WHERE id = v_id AND require_tag) = 1
     AND NOT EXISTS (SELECT 1 FROM public.realm_forum_tags WHERE forum_id = v_id)
  THEN
    RAISE EXCEPTION 'Add at least one tag before making tags required';
  END IF;

  RETURN jsonb_build_object('ok', true, 'forum_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.forum_save_settings(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forum_save_settings(uuid, jsonb) TO authenticated;

-- ---------- 12. Writing a post or a reply ----------
CREATE OR REPLACE FUNCTION public.forum_tags_valid(_forum_id uuid, _tag_ids uuid[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(bool_and(EXISTS (
    SELECT 1 FROM public.realm_forum_tags t WHERE t.id = tag AND t.forum_id = _forum_id
  )), true)
  FROM unnest(COALESCE(_tag_ids, ARRAY[]::uuid[])) AS tag;
$$;

REVOKE ALL ON FUNCTION public.forum_tags_valid(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forum_tags_valid(uuid, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.forum_create_post(
  _room_id uuid,
  _title text,
  _body text,
  _tag_ids uuid[] DEFAULT ARRAY[]::uuid[],
  _status_id uuid DEFAULT NULL,
  _template_id uuid DEFAULT NULL,
  _fields jsonb DEFAULT '{}'::jsonb,
  _cover_url text DEFAULT NULL,
  _attachments text[] DEFAULT ARRAY[]::text[],
  _as_guidelines boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_room public.realm_rooms%ROWTYPE;
  v_forum public.realm_forums%ROWTYPE;
  v_id uuid;
  v_last timestamptz;
  v_status uuid;
  v_fields jsonb := COALESCE(_fields, '{}'::jsonb);
  v_key text;
  v_template public.realm_forum_templates%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to post here';
  END IF;

  SELECT * INTO v_room FROM public.realm_rooms WHERE id = _room_id;
  IF NOT FOUND OR v_room.kind <> 'forum' THEN
    RAISE EXCEPTION 'That forum no longer exists';
  END IF;

  IF NOT public.realm_is_member(v_room.realm_id) THEN
    RAISE EXCEPTION 'Join this realm to post in its forum';
  END IF;

  IF NOT public.realm_can_manage(v_room.realm_id) AND v_room.mods_only THEN
    RAISE EXCEPTION 'Only moderators can post in this forum';
  END IF;

  SELECT * INTO v_forum FROM public.realm_forums WHERE room_id = v_room.id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This forum is still being set up';
  END IF;

  IF v_forum.post_permission = 'mods' AND NOT public.realm_can_manage(v_room.realm_id) THEN
    RAISE EXCEPTION 'Only moderators can start threads here';
  END IF;

  IF btrim(COALESCE(_title, '')) = '' OR length(btrim(_title)) > 160 THEN
    RAISE EXCEPTION 'Give the post a title of 1-160 characters';
  END IF;

  IF v_forum.require_tag AND COALESCE(array_length(_tag_ids, 1), 0) = 0
     AND NOT public.realm_can_manage(v_room.realm_id) THEN
    RAISE EXCEPTION 'Pick at least one tag';
  END IF;

  IF NOT public.forum_tags_valid(v_forum.id, _tag_ids) THEN
    RAISE EXCEPTION 'One of those tags does not belong to this forum';
  END IF;

  IF COALESCE(array_length(_attachments, 1), 0) > 10 THEN
    RAISE EXCEPTION 'Up to 10 attachments per post';
  END IF;

  IF _template_id IS NOT NULL THEN
    SELECT * INTO v_template FROM public.realm_forum_templates
      WHERE id = _template_id AND forum_id = v_forum.id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That template is not part of this forum';
    END IF;
    -- Every field the template marks required has to carry an answer.
    FOR v_key IN
      SELECT COALESCE(field ->> 'label', '')
      FROM jsonb_array_elements(COALESCE(v_template.fields, '[]'::jsonb)) AS field
      WHERE COALESCE((field ->> 'required')::boolean, false)
    LOOP
      IF btrim(COALESCE(v_fields ->> v_key, '')) = '' THEN
        RAISE EXCEPTION 'Fill in the "%" field before posting', v_key;
      END IF;
    END LOOP;
  END IF;

  IF _status_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.realm_forum_statuses s WHERE s.id = _status_id AND s.forum_id = v_forum.id
  ) THEN
    RAISE EXCEPTION 'That status is not part of this forum';
  END IF;

  SELECT max(created_at) INTO v_last
    FROM public.realm_forum_posts
   WHERE forum_id = v_forum.id AND author_id = auth.uid();

  IF v_forum.slowmode_seconds > 0
     AND v_last IS NOT NULL
     AND v_last > now() - make_interval(secs => v_forum.slowmode_seconds)
     AND NOT public.realm_can_manage(v_room.realm_id)
  THEN
    RAISE EXCEPTION 'Slowmode is on — wait % more seconds',
      CEIL(EXTRACT(EPOCH FROM (v_last + make_interval(secs => v_forum.slowmode_seconds) - now())));
  END IF;

  IF _status_id IS NULL THEN
    SELECT id INTO v_status FROM public.realm_forum_statuses
      WHERE forum_id = v_forum.id AND is_default
      ORDER BY position LIMIT 1;
  END IF;

  INSERT INTO public.realm_forum_posts (
    forum_id, realm_id, room_id, author_id, title, body, cover_url, attachments,
    tag_ids, status_id, template_id, fields, is_pinned
  )
  VALUES (
    v_forum.id, v_room.realm_id, v_room.id, auth.uid(), btrim(_title),
    COALESCE(_body, ''), NULLIF(_cover_url, ''), COALESCE(_attachments, ARRAY[]::text[]),
    COALESCE(_tag_ids, ARRAY[]::uuid[]), COALESCE(_status_id, v_status), _template_id, v_fields,
    COALESCE(_as_guidelines, false) AND public.realm_can_manage(v_room.realm_id)
  )
  RETURNING id INTO v_id;

  IF COALESCE(_as_guidelines, false) AND public.realm_can_manage(v_room.realm_id) THEN
    UPDATE public.realm_forums SET guidelines_post_id = v_id WHERE id = v_forum.id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.forum_create_post(uuid, text, text, uuid[], uuid, uuid, jsonb, text, text[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forum_create_post(uuid, text, text, uuid[], uuid, uuid, jsonb, text, text[], boolean) TO authenticated;

-- Editing replaces every editable field. The composer always holds the whole
-- post, so "clear the cover" and "keep the cover" can never be confused.
CREATE OR REPLACE FUNCTION public.forum_update_post(
  _post_id uuid,
  _title text,
  _body text,
  _tag_ids uuid[] DEFAULT ARRAY[]::uuid[],
  _status_id uuid DEFAULT NULL,
  _fields jsonb DEFAULT '{}'::jsonb,
  _cover_url text DEFAULT NULL,
  _attachments text[] DEFAULT ARRAY[]::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_post public.realm_forum_posts%ROWTYPE;
  v_forum public.realm_forums%ROWTYPE;
  v_mine boolean;
BEGIN
  SELECT * INTO v_post FROM public.realm_forum_posts WHERE id = _post_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That thread is gone';
  END IF;

  v_mine := v_post.author_id = auth.uid();
  IF NOT v_mine AND NOT public.realm_can_manage(v_post.realm_id) THEN
    RAISE EXCEPTION 'Only the author or a moderator can edit this thread';
  END IF;

  IF btrim(COALESCE(_title, '')) = '' OR length(btrim(_title)) > 160 THEN
    RAISE EXCEPTION 'Give the post a title of 1-160 characters';
  END IF;

  SELECT * INTO v_forum FROM public.realm_forums WHERE id = v_post.forum_id;
  IF v_forum.require_tag AND COALESCE(array_length(_tag_ids, 1), 0) = 0
     AND NOT public.realm_can_manage(v_post.realm_id) THEN
    RAISE EXCEPTION 'Pick at least one tag';
  END IF;

  IF NOT public.forum_tags_valid(v_post.forum_id, _tag_ids) THEN
    RAISE EXCEPTION 'One of those tags does not belong to this forum';
  END IF;

  IF _status_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.realm_forum_statuses s
     WHERE s.id = _status_id AND s.forum_id = v_post.forum_id
  ) THEN
    RAISE EXCEPTION 'That status is not part of this forum';
  END IF;

  IF COALESCE(array_length(_attachments, 1), 0) > 10 THEN
    RAISE EXCEPTION 'Up to 10 attachments per post';
  END IF;

  UPDATE public.realm_forum_posts
     SET title = btrim(_title),
         body = COALESCE(_body, ''),
         tag_ids = COALESCE(_tag_ids, ARRAY[]::uuid[]),
         status_id = _status_id,
         fields = COALESCE(_fields, '{}'::jsonb),
         cover_url = NULLIF(_cover_url, ''),
         attachments = COALESCE(_attachments, ARRAY[]::text[]),
         edited_at = now()
   WHERE id = _post_id;

  RETURN jsonb_build_object('ok', true, 'id', _post_id);
END;
$$;

REVOKE ALL ON FUNCTION public.forum_update_post(uuid, text, text, uuid[], uuid, jsonb, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forum_update_post(uuid, text, text, uuid[], uuid, jsonb, text, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.forum_create_reply(
  _post_id uuid,
  _body text,
  _parent_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_post public.realm_forum_posts%ROWTYPE;
  v_forum public.realm_forums%ROWTYPE;
  v_id uuid;
  v_last timestamptz;
  v_author_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to reply';
  END IF;

  SELECT * INTO v_post FROM public.realm_forum_posts WHERE id = _post_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That thread is gone';
  END IF;

  IF NOT public.realm_is_member(v_post.realm_id) THEN
    RAISE EXCEPTION 'Join this realm to reply';
  END IF;

  SELECT * INTO v_forum FROM public.realm_forums WHERE id = v_post.forum_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This forum is still being set up';
  END IF;

  IF v_post.is_locked AND NOT public.realm_can_manage(v_post.realm_id) THEN
    RAISE EXCEPTION 'This thread is locked';
  END IF;

  IF v_post.archived_at IS NOT NULL AND NOT public.realm_can_manage(v_post.realm_id) THEN
    RAISE EXCEPTION 'This thread is archived';
  END IF;

  IF v_forum.reply_permission = 'mods' AND NOT public.realm_can_manage(v_post.realm_id) THEN
    RAISE EXCEPTION 'Only moderators can reply here';
  END IF;

  IF v_post.status_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.realm_forum_statuses s
     WHERE s.id = v_post.status_id AND s.is_closed
  ) AND NOT public.realm_can_manage(v_post.realm_id) THEN
    RAISE EXCEPTION 'This thread is closed';
  END IF;

  IF btrim(COALESCE(_body, '')) = '' THEN
    RAISE EXCEPTION 'Write something first';
  END IF;

  SELECT max(created_at) INTO v_last
    FROM public.realm_forum_replies
   WHERE post_id = _post_id AND author_id = auth.uid();

  IF v_forum.slowmode_seconds > 0
     AND v_last IS NOT NULL
     AND v_last > now() - make_interval(secs => v_forum.slowmode_seconds)
     AND NOT public.realm_can_manage(v_post.realm_id)
  THEN
    RAISE EXCEPTION 'Slowmode is on — wait % more seconds',
      CEIL(EXTRACT(EPOCH FROM (v_last + make_interval(secs => v_forum.slowmode_seconds) - now())));
  END IF;

  IF _parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.realm_forum_replies r WHERE r.id = _parent_id AND r.post_id = _post_id
  ) THEN
    RAISE EXCEPTION 'That reply is not part of this thread';
  END IF;

  INSERT INTO public.realm_forum_replies (post_id, author_id, parent_id, body)
  VALUES (_post_id, auth.uid(), _parent_id, left(btrim(_body), 8000))
  RETURNING id INTO v_id;

  -- Replying reopens a solved thread for the author, which is what people expect
  -- after they said "still broken".
  IF v_post.is_solved AND v_post.author_id = auth.uid() THEN
    UPDATE public.realm_forum_posts SET is_solved = false, best_reply_id = NULL WHERE id = _post_id;
  END IF;

  SELECT COALESCE(p.display_name, p.username) INTO v_author_name
    FROM public.profiles p WHERE p.id = auth.uid();

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'actor', v_author_name);
END;
$$;

REVOKE ALL ON FUNCTION public.forum_create_reply(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forum_create_reply(uuid, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.forum_delete_post(_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_post public.realm_forum_posts%ROWTYPE;
BEGIN
  SELECT * INTO v_post FROM public.realm_forum_posts WHERE id = _post_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That thread is gone';
  END IF;
  IF v_post.author_id <> auth.uid() AND NOT public.realm_can_manage(v_post.realm_id) THEN
    RAISE EXCEPTION 'Only the author or a moderator can delete this thread';
  END IF;

  UPDATE public.realm_forum_posts
     SET deleted_at = now(), is_pinned = false
   WHERE id = _post_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.forum_delete_post(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forum_delete_post(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.forum_delete_reply(_reply_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reply public.realm_forum_replies%ROWTYPE;
  v_realm uuid;
BEGIN
  SELECT r.* INTO v_reply FROM public.realm_forum_replies r WHERE r.id = _reply_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That reply is gone';
  END IF;
  SELECT p.realm_id INTO v_realm FROM public.realm_forum_posts p WHERE p.id = v_reply.post_id;

  IF v_reply.author_id <> auth.uid() AND NOT public.realm_can_manage(v_realm) THEN
    RAISE EXCEPTION 'Only the author or a moderator can delete this reply';
  END IF;

  UPDATE public.realm_forum_replies SET deleted_at = now(), body = '' WHERE id = _reply_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.forum_delete_reply(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forum_delete_reply(uuid) TO authenticated;

-- ---------- 13. Reactions and likes ----------
CREATE OR REPLACE FUNCTION public.forum_toggle_like(_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_liked boolean;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.realm_forum_likes WHERE post_id = _post_id AND user_id = auth.uid()
  ) THEN
    DELETE FROM public.realm_forum_likes WHERE post_id = _post_id AND user_id = auth.uid();
    v_liked := false;
  ELSE
    INSERT INTO public.realm_forum_likes (post_id, user_id)
    VALUES (_post_id, auth.uid())
    ON CONFLICT DO NOTHING;
    v_liked := true;
  END IF;

  SELECT like_count INTO v_count FROM public.realm_forum_posts WHERE id = _post_id;
  RETURN jsonb_build_object('liked', v_liked, 'like_count', COALESCE(v_count, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.forum_toggle_like(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forum_toggle_like(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.forum_toggle_reply_like(_reply_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_liked boolean;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.realm_forum_reply_likes WHERE reply_id = _reply_id AND user_id = auth.uid()
  ) THEN
    DELETE FROM public.realm_forum_reply_likes WHERE reply_id = _reply_id AND user_id = auth.uid();
    v_liked := false;
  ELSE
    INSERT INTO public.realm_forum_reply_likes (reply_id, user_id)
    VALUES (_reply_id, auth.uid())
    ON CONFLICT DO NOTHING;
    v_liked := true;
  END IF;

  SELECT like_count INTO v_count FROM public.realm_forum_replies WHERE id = _reply_id;
  RETURN jsonb_build_object('liked', v_liked, 'like_count', COALESCE(v_count, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.forum_toggle_reply_like(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forum_toggle_reply_like(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.forum_toggle_reaction(_post_id uuid, _emoji text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_temp, public
AS $$
DECLARE
  v_mine boolean;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first';
  END IF;
  IF btrim(COALESCE(_emoji, '')) = '' OR length(_emoji) > 24 THEN
    RAISE EXCEPTION 'That is not a reaction';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.realm_forum_reactions
     WHERE post_id = _post_id AND user_id = auth.uid() AND emoji = _emoji
  ) THEN
    DELETE FROM public.realm_forum_reactions
     WHERE post_id = _post_id AND user_id = auth.uid() AND emoji = _emoji;
    v_mine := false;
  ELSE
    INSERT INTO public.realm_forum_reactions (post_id, user_id, emoji)
    VALUES (_post_id, auth.uid(), _emoji)
    ON CONFLICT DO NOTHING;
    v_mine := true;
  END IF;

  SELECT count(*) INTO v_count FROM public.realm_forum_reactions
   WHERE post_id = _post_id AND emoji = _emoji;

  RETURN jsonb_build_object('emoji', _emoji, 'count', v_count, 'mine', v_mine);
END;
$$;

REVOKE ALL ON FUNCTION public.forum_toggle_reaction(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forum_toggle_reaction(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.forum_toggle_reply_reaction(_reply_id uuid, _emoji text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_temp, public
AS $$
DECLARE
  v_mine boolean;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first';
  END IF;
  IF btrim(COALESCE(_emoji, '')) = '' OR length(_emoji) > 24 THEN
    RAISE EXCEPTION 'That is not a reaction';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.realm_forum_reply_reactions
     WHERE reply_id = _reply_id AND user_id = auth.uid() AND emoji = _emoji
  ) THEN
    DELETE FROM public.realm_forum_reply_reactions
     WHERE reply_id = _reply_id AND user_id = auth.uid() AND emoji = _emoji;
    v_mine := false;
  ELSE
    INSERT INTO public.realm_forum_reply_reactions (reply_id, user_id, emoji)
    VALUES (_reply_id, auth.uid(), _emoji)
    ON CONFLICT DO NOTHING;
    v_mine := true;
  END IF;

  SELECT count(*) INTO v_count FROM public.realm_forum_reply_reactions
   WHERE reply_id = _reply_id AND emoji = _emoji;

  RETURN jsonb_build_object('emoji', _emoji, 'count', v_count, 'mine', v_mine);
END;
$$;

REVOKE ALL ON FUNCTION public.forum_toggle_reply_reaction(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forum_toggle_reply_reaction(uuid, text) TO authenticated;

-- ---------- 14. Reading a thread, best answer, moderation ----------
CREATE OR REPLACE FUNCTION public.forum_mark_read(_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first';
  END IF;

  INSERT INTO public.realm_forum_reads (post_id, user_id, last_seen_at)
  VALUES (_post_id, auth.uid(), now())
  ON CONFLICT (post_id, user_id) DO UPDATE SET last_seen_at = now();

  UPDATE public.realm_forum_posts SET view_count = view_count + 1 WHERE id = _post_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.forum_mark_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forum_mark_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.forum_set_best_answer(_post_id uuid, _reply_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_post public.realm_forum_posts%ROWTYPE;
  v_mine boolean;
BEGIN
  SELECT * INTO v_post FROM public.realm_forum_posts WHERE id = _post_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That thread is gone';
  END IF;

  v_mine := v_post.author_id = auth.uid();
  IF NOT v_mine AND NOT public.realm_can_manage(v_post.realm_id) THEN
    RAISE EXCEPTION 'Only the author or a moderator can mark the best answer';
  END IF;

  IF _reply_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.realm_forum_replies r WHERE r.id = _reply_id AND r.post_id = _post_id
  ) THEN
    RAISE EXCEPTION 'That reply is not part of this thread';
  END IF;

  UPDATE public.realm_forum_posts
     SET best_reply_id = _reply_id,
         is_solved = _reply_id IS NOT NULL
   WHERE id = _post_id;

  -- "Solved" should also show in the thread's status when the forum has one.
  IF _reply_id IS NOT NULL THEN
    UPDATE public.realm_forum_posts
       SET status_id = (
         SELECT s.id FROM public.realm_forum_statuses s
          WHERE s.forum_id = v_post.forum_id AND lower(s.name) = 'solved'
          ORDER BY s.position LIMIT 1
       )
     WHERE id = _post_id
       AND status_id IS NULL;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.forum_set_best_answer(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forum_set_best_answer(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.forum_moderate_post(_post_id uuid, _action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_post public.realm_forum_posts%ROWTYPE;
BEGIN
  SELECT * INTO v_post FROM public.realm_forum_posts WHERE id = _post_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That thread is gone';
  END IF;

  -- Pin, lock, archive and restore are moderation; the author may still mark
  -- their own thread solved, which is why that one allows the author too.
  IF _action <> 'solve' AND NOT public.realm_can_manage(v_post.realm_id) THEN
    RAISE EXCEPTION 'Only moderators can do that';
  END IF;

  IF _action = 'pin' THEN
    UPDATE public.realm_forum_posts SET is_pinned = true WHERE id = _post_id;
  ELSIF _action = 'unpin' THEN
    UPDATE public.realm_forum_posts SET is_pinned = false WHERE id = _post_id;
  ELSIF _action = 'lock' THEN
    UPDATE public.realm_forum_posts SET is_locked = true WHERE id = _post_id;
  ELSIF _action = 'unlock' THEN
    UPDATE public.realm_forum_posts SET is_locked = false WHERE id = _post_id;
  ELSIF _action = 'solve' THEN
    IF v_post.author_id <> auth.uid() AND NOT public.realm_can_manage(v_post.realm_id) THEN
      RAISE EXCEPTION 'Only the author or a moderator can solve this thread';
    END IF;
    UPDATE public.realm_forum_posts SET is_solved = true WHERE id = _post_id;
  ELSIF _action = 'unsolve' THEN
    UPDATE public.realm_forum_posts
       SET is_solved = false, best_reply_id = NULL
     WHERE id = _post_id;
  ELSIF _action = 'archive' THEN
    UPDATE public.realm_forum_posts SET archived_at = now(), is_pinned = false WHERE id = _post_id;
  ELSIF _action = 'unarchive' THEN
    UPDATE public.realm_forum_posts SET archived_at = NULL WHERE id = _post_id;
  ELSE
    RAISE EXCEPTION 'Unknown forum action: %', _action;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.forum_moderate_post(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forum_moderate_post(uuid, text) TO authenticated;

-- ---------- 15. Auto-archive ----------
-- A forum with `auto_archive_days` set closes threads that have gone quiet for
-- that long. The sweep is cheap and idempotent, so the client calls it when a
-- forum opens (the same lazy-sweep shape the scheduled-message flush uses).
CREATE OR REPLACE FUNCTION public.forum_archive_stale(_realm_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  IF _realm_id IS NULL OR NOT public.realm_is_member(_realm_id) THEN
    RAISE EXCEPTION 'Only members can tidy a realm''s forum';
  END IF;

  WITH stale AS (
    UPDATE public.realm_forum_posts p
       SET archived_at = now(), is_pinned = false
      FROM public.realm_forums f
     WHERE p.forum_id = f.id
       AND p.archived_at IS NULL
       AND p.deleted_at IS NULL
       AND f.auto_archive_days IS NOT NULL
       AND p.last_activity_at < now() - make_interval(days => f.auto_archive_days)
       AND p.realm_id = _realm_id
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM stale;

  RETURN COALESCE(v_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.forum_archive_stale(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forum_archive_stale(uuid) TO authenticated;

-- ---------- 16. Follow a tag in one call ----------
CREATE OR REPLACE FUNCTION public.forum_toggle_tag_follow(_tag_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_following boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.realm_forum_tag_follows WHERE tag_id = _tag_id AND user_id = auth.uid()
  ) THEN
    DELETE FROM public.realm_forum_tag_follows WHERE tag_id = _tag_id AND user_id = auth.uid();
    v_following := false;
  ELSE
    INSERT INTO public.realm_forum_tag_follows (tag_id, user_id)
    VALUES (_tag_id, auth.uid())
    ON CONFLICT DO NOTHING;
    v_following := true;
  END IF;

  RETURN jsonb_build_object('following', v_following);
END;
$$;

REVOKE ALL ON FUNCTION public.forum_toggle_tag_follow(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forum_toggle_tag_follow(uuid) TO authenticated;
