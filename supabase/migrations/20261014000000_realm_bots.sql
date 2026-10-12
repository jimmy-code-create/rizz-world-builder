-- ============================================================================
-- PART 5: Bots + the built-in RIZZ BOT + slash commands.
--
-- Bots are a REALM-ONLY feature. A DM has no realm and a group has no realm, so
-- every entry point below starts from a realm and refuses anything else. Every
-- rule lives in SQL (SECURITY DEFINER functions), never in the UI, so a client
-- cannot grant itself anything by calling an endpoint directly.
--
-- Rules, in the order they are checked:
--   * the bot must be installed AND enabled in that realm;
--   * the caller must be able to manage bots (owner, mod, a granted member, or
--     any member when realms.allow_member_bots is on);
--   * the command must be enabled for that channel;
--   * the bot is rate limited by a token bucket in bot_rate_limits.
--
-- Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------- 1. tables
CREATE TABLE IF NOT EXISTS public.bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  avatar_url text,
  token_hash text NOT NULL,
  token_prefix text NOT NULL DEFAULT '',
  token_rotated_at timestamptz NOT NULL DEFAULT now(),
  scopes text[] NOT NULL DEFAULT ARRAY['messages.write', 'reactions.write']::text[],
  delivery text NOT NULL DEFAULT 'webhook',
  webhook_url text,
  is_builtin boolean NOT NULL DEFAULT false,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.bots DROP CONSTRAINT IF EXISTS bots_delivery_check;
  ALTER TABLE public.bots
    ADD CONSTRAINT bots_delivery_check CHECK (delivery IN ('webhook', 'gateway'));
  ALTER TABLE public.bots DROP CONSTRAINT IF EXISTS bots_name_len_check;
  ALTER TABLE public.bots
    ADD CONSTRAINT bots_name_len_check CHECK (char_length(name) BETWEEN 2 AND 32);
  ALTER TABLE public.bots DROP CONSTRAINT IF EXISTS bots_owner_or_builtin_check;
  ALTER TABLE public.bots
    ADD CONSTRAINT bots_owner_or_builtin_check CHECK (is_builtin OR owner_id IS NOT NULL);
  ALTER TABLE public.bots DROP CONSTRAINT IF EXISTS bots_webhook_check;
  ALTER TABLE public.bots
    ADD CONSTRAINT bots_webhook_check
    CHECK (webhook_url IS NULL OR webhook_url ~ '^https://');
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS bots_owner_name_unique
  ON public.bots (owner_id, name) WHERE owner_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bots_builtin_name_unique
  ON public.bots (name) WHERE is_builtin;

CREATE TABLE IF NOT EXISTS public.bot_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled_globally boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.bot_commands DROP CONSTRAINT IF EXISTS bot_commands_name_check;
  ALTER TABLE public.bot_commands
    ADD CONSTRAINT bot_commands_name_check CHECK (name ~ '^[a-z0-9_-]{1,32}$');
  ALTER TABLE public.bot_commands DROP CONSTRAINT IF EXISTS bot_commands_desc_len_check;
  ALTER TABLE public.bot_commands
    ADD CONSTRAINT bot_commands_desc_len_check CHECK (char_length(description) <= 160);
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS bot_commands_bot_name_unique
  ON public.bot_commands (bot_id, name);

CREATE TABLE IF NOT EXISTS public.realm_bot_installs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES public.realms(id) ON DELETE CASCADE,
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  installed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (realm_id, bot_id)
);

-- Per-channel command switch. A channel is the room, or the realm's own channel
-- when realm_room_id is null, matching how messages and pins are scoped.
CREATE TABLE IF NOT EXISTS public.realm_bot_command_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES public.realms(id) ON DELETE CASCADE,
  realm_room_id uuid REFERENCES public.realm_rooms(id) ON DELETE CASCADE,
  command_id uuid NOT NULL REFERENCES public.bot_commands(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS realm_bot_command_settings_unique
  ON public.realm_bot_command_settings (realm_id, coalesce(realm_room_id, realm_id), command_id);

CREATE TABLE IF NOT EXISTS public.bot_rate_limits (
  bot_id uuid PRIMARY KEY REFERENCES public.bots(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  used integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.bot_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  realm_id uuid NOT NULL REFERENCES public.realms(id) ON DELETE CASCADE,
  realm_room_id uuid REFERENCES public.realm_rooms(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  command_name text NOT NULL,
  args text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  response_body text,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

DO $$
BEGIN
  ALTER TABLE public.bot_interactions DROP CONSTRAINT IF EXISTS bot_interactions_status_check;
  ALTER TABLE public.bot_interactions
    ADD CONSTRAINT bot_interactions_status_check CHECK (status IN ('pending', 'completed', 'failed'));
END $$;

CREATE INDEX IF NOT EXISTS idx_bot_interactions_realm
  ON public.bot_interactions (realm_id, created_at DESC);

-- ------------------------------------------------------- 2. built-in line bank
CREATE TABLE IF NOT EXISTS public.rizz_bot_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.rizz_bot_lines DROP CONSTRAINT IF EXISTS rizz_bot_lines_kind_check;
  ALTER TABLE public.rizz_bot_lines
    ADD CONSTRAINT rizz_bot_lines_kind_check
    CHECK (kind IN ('smooth', 'personal', 'compliment', 'icebreaker', 'daily', 'rate_low', 'rate_mid', 'rate_high', 'rate_elite'));
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS rizz_bot_lines_kind_body_unique
  ON public.rizz_bot_lines (kind, body);

CREATE TABLE IF NOT EXISTS public.rizz_bot_points (
  realm_id uuid NOT NULL REFERENCES public.realms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (realm_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.rizz_bot_cooldowns (
  realm_id uuid NOT NULL REFERENCES public.realms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  command text NOT NULL,
  next_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (realm_id, user_id, command)
);

CREATE TABLE IF NOT EXISTS public.rizz_bot_battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES public.realms(id) ON DELETE CASCADE,
  realm_room_id uuid REFERENCES public.realm_rooms(id) ON DELETE SET NULL,
  challenger_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'collecting',
  challenger_line text,
  target_line text,
  message_a_id uuid,
  message_b_id uuid,
  winner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  collect_until timestamptz NOT NULL DEFAULT (now() + interval '2 minutes'),
  vote_until timestamptz
);

DO $$
BEGIN
  ALTER TABLE public.rizz_bot_battles DROP CONSTRAINT IF EXISTS rizz_bot_battles_status_check;
  ALTER TABLE public.rizz_bot_battles
    ADD CONSTRAINT rizz_bot_battles_status_check
    CHECK (status IN ('collecting', 'voting', 'settled'));
END $$;

CREATE INDEX IF NOT EXISTS idx_rizz_bot_battles_realm
  ON public.rizz_bot_battles (realm_id, status);

-- ------------------------------------------- 3. realm + member bot settings
ALTER TABLE public.realms
  ADD COLUMN IF NOT EXISTS allow_member_bots boolean NOT NULL DEFAULT false;

ALTER TABLE public.realm_members
  ADD COLUMN IF NOT EXISTS can_manage_bots boolean NOT NULL DEFAULT false;

-- --------------------------------------------- 4. messages + reactions actors
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS bot_id uuid;

DO $$
BEGIN
  ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_bot_id_fkey;
  ALTER TABLE public.messages
    ADD CONSTRAINT messages_bot_id_fkey
    FOREIGN KEY (bot_id) REFERENCES public.bots(id) ON DELETE SET NULL;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

ALTER TABLE public.messages ALTER COLUMN sender_id DROP NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_actor_check;
  ALTER TABLE public.messages
    ADD CONSTRAINT messages_actor_check
    CHECK (sender_id IS NOT NULL OR bot_id IS NOT NULL);
END $$;

ALTER TABLE public.message_reactions
  ADD COLUMN IF NOT EXISTS bot_id uuid;

DO $$
BEGIN
  ALTER TABLE public.message_reactions DROP CONSTRAINT IF EXISTS message_reactions_bot_id_fkey;
  ALTER TABLE public.message_reactions
    ADD CONSTRAINT message_reactions_bot_id_fkey
    FOREIGN KEY (bot_id) REFERENCES public.bots(id) ON DELETE CASCADE;

  ALTER TABLE public.message_reactions DROP CONSTRAINT IF EXISTS message_reactions_actor_check;
  ALTER TABLE public.message_reactions
    ADD CONSTRAINT message_reactions_actor_check
    CHECK ((user_id IS NOT NULL) <> (bot_id IS NOT NULL));
END $$;

ALTER TABLE public.message_reactions ALTER COLUMN user_id DROP NOT NULL;

-- The old unique key assumed a human actor on every row. Bots need their own.
DROP INDEX IF EXISTS public.message_reactions_scoped_unique;
CREATE UNIQUE INDEX IF NOT EXISTS message_reactions_user_unique
  ON public.message_reactions (message_type, message_id, user_id, emoji)
  WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS message_reactions_bot_unique
  ON public.message_reactions (message_type, message_id, bot_id, emoji)
  WHERE bot_id IS NOT NULL;

-- ------------------------------------------------ 4b. bot-actor guard
-- `messages.sender_id` is nullable now, so without this a member could post a
-- row with `sender_id = auth.uid()` AND a `bot_id` and have it render as a bot
-- message. RLS cannot see that (its own policy is satisfied), so the guard is a
-- trigger: only the SECURITY DEFINER writer may set `bot_id`, and it announces
-- itself with a transaction-local flag. The trigger is also what stops a member
-- from re-labelling one of their own messages as a bot's.
CREATE OR REPLACE FUNCTION public.messages_guard_bot_actor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $guard$
BEGIN
  IF coalesce(current_setting('rizz.bot_writer', true), '') = 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.bot_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only the bot API can post as a bot';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.bot_id IS DISTINCT FROM OLD.bot_id THEN
    RAISE EXCEPTION 'Only the bot API can change who wrote a message';
  END IF;
  RETURN NEW;
END;
$guard$;

DROP TRIGGER IF EXISTS messages_guard_bot_actor_t ON public.messages;
CREATE TRIGGER messages_guard_bot_actor_t
  BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_guard_bot_actor();

REVOKE ALL ON FUNCTION public.messages_guard_bot_actor() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------- 5. helpers
/** Tolerant uuid cast: bad input is null instead of a 22P02 crash. */
CREATE OR REPLACE FUNCTION public.safe_uuid(_text text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $function$
BEGIN
  RETURN nullif(btrim(coalesce(_text, '')), '')::uuid;
EXCEPTION
  WHEN others THEN RETURN NULL;
END;
$function$;

/** True when the bot is installed and switched on in this realm. */
CREATE OR REPLACE FUNCTION public.bot_installed_in_realm(_realm_id uuid, _bot_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.realm_bot_installs i
    WHERE i.realm_id = _realm_id AND i.bot_id = _bot_id AND i.enabled
  );
$function$;

/**
 * Who may add and manage bots in a realm.
 *
 * The owner always can. Mods can. A member can when the owner granted them
 * can_manage_bots, or when the realm switched on "any member can add bots".
 */
CREATE OR REPLACE FUNCTION public.can_manage_realm_bots(_realm_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    public.is_realm_moderator(_realm_id, _user_id)
    OR EXISTS (
      SELECT 1
      FROM public.realm_members rm
      JOIN public.realms r ON r.id = rm.realm_id
      WHERE rm.realm_id = _realm_id
        AND rm.user_id = _user_id
        AND (rm.can_manage_bots OR r.allow_member_bots)
    );
$function$;

/**
 * A command is usable in a channel unless a moderator switched it off there.
 * No row means allowed, which keeps the table small.
 */
CREATE OR REPLACE FUNCTION public.bot_command_allowed_in_channel(
  _realm_id uuid,
  _realm_room_id uuid,
  _command_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT coalesce(
    (
      SELECT s.enabled
      FROM public.realm_bot_command_settings s
      WHERE s.realm_id = _realm_id
        AND coalesce(s.realm_room_id, s.realm_id) = coalesce(_realm_room_id, _realm_id)
        AND s.command_id = _command_id
    ),
    true
  );
$function$;

/** Token bucket, one window per bot. Returns true while under the limit. */
CREATE OR REPLACE FUNCTION public.bot_consume_rate_limit(
  _bot_id uuid,
  _limit integer,
  _window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_used integer;
BEGIN
  INSERT INTO public.bot_rate_limits (bot_id, window_started_at, used)
  VALUES (_bot_id, now(), 1)
  ON CONFLICT (bot_id) DO UPDATE
  SET used = CASE
        WHEN public.bot_rate_limits.window_started_at < now() - make_interval(secs => _window_seconds)
          THEN 1
        ELSE public.bot_rate_limits.used + 1
      END,
      window_started_at = CASE
        WHEN public.bot_rate_limits.window_started_at < now() - make_interval(secs => _window_seconds)
          THEN now()
        ELSE public.bot_rate_limits.window_started_at
      END
  RETURNING used INTO v_used;

  RETURN v_used <= _limit;
END;
$function$;

-- ------------------------------------------------- 6. the built-in RIZZ BOT
INSERT INTO public.bots (name, description, owner_id, token_hash, token_prefix, is_builtin, is_public, scopes)
VALUES (
  'RIZZ BOT',
  'The house bot. Rizz lines, compliments, icebreakers, ratings, battles and a realm leaderboard.',
  NULL,
  'builtin:rizz-bot',
  'builtin',
  true,
  true,
  ARRAY['messages.write', 'reactions.write']::text[]
)
ON CONFLICT DO NOTHING;

INSERT INTO public.bot_commands (bot_id, name, description, options, enabled_globally)
SELECT b.id, c.name, c.description, c.options::jsonb, true
FROM public.bots b
CROSS JOIN (VALUES
  ('rizz', 'Drop a random smooth line', '[{"name":"user","description":"Optional person to personalise it for","type":"user","required":false}]'),
  ('rizzme', 'Reply suggestions for a situation you describe', '[{"name":"situation","description":"What is happening?","type":"string","required":true}]'),
  ('rate', 'Rate someone''s rizz 0-100 with a verdict', '[{"name":"user","description":"Who should I rate?","type":"user","required":true}]'),
  ('compliment', 'Give someone a genuine compliment', '[{"name":"user","description":"Who deserves it?","type":"user","required":true}]'),
  ('icebreaker', 'A conversation starter for the channel', '[]'),
  ('rizzbattle', 'Challenge someone and let the realm vote', '[{"name":"user","description":"Your opponent","type":"user","required":true}]'),
  ('rizzsubmit', 'Submit your line to the open rizzbattle', '[{"name":"line","description":"Your best line","type":"string","required":true}]'),
  ('rizzboard', 'The realm rizz leaderboard', '[]'),
  ('daily', 'Today''s rizz challenge', '[]'),
  ('help', 'What this bot can do here', '[]')
) AS c(name, description, options)
WHERE b.is_builtin AND b.name = 'RIZZ BOT'
ON CONFLICT DO NOTHING;

INSERT INTO public.rizz_bot_lines (kind, body) VALUES
  ('smooth', 'Are you a realm invite? Because I would accept you instantly.'),
  ('smooth', 'You must be the default channel, because everyone ends up here.'),
  ('smooth', 'I was going to play it cool, but then you typed something.'),
  ('smooth', 'My ping is low but my heart rate is not.'),
  ('smooth', 'You are the only notification I actually want.'),
  ('smooth', 'If confidence were a currency, you would be inflation-proof.'),
  ('smooth', 'I would mute the whole server just to hear this one message.'),
  ('smooth', 'You type like someone who has never had a bad hair day.'),
  ('smooth', 'Somewhere a group chat is jealous that you are here instead.'),
  ('smooth', 'You are not the main character. You are the whole season.'),
  ('smooth', 'I would read your typing indicator for hours.'),
  ('smooth', 'Careful, the server rules do not cover what you are doing to my focus.'),
  ('personal', '{name}, you walked in and the server lagged. Coincidence? No.'),
  ('personal', '{name}, I ran the numbers and you are statistically the best part of this realm.'),
  ('personal', '{name}, everyone here has a role. Yours is ''the reason people stay''.'),
  ('personal', '{name}, if this realm had a soundtrack you would be the drop.'),
  ('personal', '{name}, you are the only person whose read receipts I check.'),
  ('personal', '{name}, I would fight the algorithm for your timeline.'),
  ('personal', '{name}, you have main character energy and the bandwidth to carry it.'),
  ('personal', '{name}, you are the reason nobody here uses the leave button.'),
  ('compliment', 'You make this channel better just by showing up.'),
  ('compliment', 'Your timing in conversations is genuinely elite.'),
  ('compliment', 'You listen properly, and almost nobody does that online.'),
  ('compliment', 'You are funny in a way that never punches down.'),
  ('compliment', 'You explain things without making anyone feel small.'),
  ('compliment', 'You have a good eye for when someone needs a message.'),
  ('compliment', 'You bring calm into loud rooms. That is rare.'),
  ('compliment', 'Your taste is consistent and it is good taste.'),
  ('compliment', 'You hype other people up without being asked.'),
  ('compliment', 'You are easy to be honest with.'),
  ('icebreaker', 'What is the last thing that made you laugh out loud on your own?'),
  ('icebreaker', 'What is a skill you have that nobody here knows about?'),
  ('icebreaker', 'Best meal you have had this month, and where?'),
  ('icebreaker', 'What song have you had on repeat, honestly?'),
  ('icebreaker', 'What is a small thing that instantly improves your day?'),
  ('icebreaker', 'If you could move anywhere for a year, where would you go?'),
  ('icebreaker', 'What is something you are proud of that you never bring up?'),
  ('icebreaker', 'What is the worst trend you ever fully committed to?'),
  ('daily', 'Today: give three people a compliment before you log off.'),
  ('daily', 'Today: start one conversation with someone you have never messaged here.'),
  ('daily', 'Today: reply to the message you have been meaning to reply to.'),
  ('daily', 'Today: share one thing you made or found this week.'),
  ('daily', 'Today: ask someone here a question about their day and actually read the answer.'),
  ('daily', 'Today: send one message that is only encouragement. Nothing else.'),
  ('daily', 'Today: find the quietest person in the channel and ask what they think.'),
  ('daily', 'Today: hype up someone else''s idea instead of adding your own.'),
  ('daily', 'Today: tell a friend exactly why you like talking to them.'),
  ('daily', 'Today: turn one typo into a completely new word and commit to it.'),
  ('rate_low', 'The vibe is loading. Give it a second.'),
  ('rate_low', 'Charm is in the room, it is just hiding behind the couch.'),
  ('rate_low', 'You have the ingredients. The recipe is still buffering.'),
  ('rate_mid', 'Solid. Reliable. The kind of rizz that pays rent on time.'),
  ('rate_mid', 'Respectable numbers. Nothing to apologise for here.'),
  ('rate_mid', 'Quietly effective. Dangerous once you stop overthinking it.'),
  ('rate_high', 'That is a scroll-stopping level of charm.'),
  ('rate_high', 'Dangerous. The chat is not ready for this energy.'),
  ('rate_high', 'Main character rizz. The realm is watching.'),
  ('rate_elite', 'Elite. Historic. The algorithm has filed a report.'),
  ('rate_elite', 'Off the charts. Somebody close the server before it overheats.')
ON CONFLICT DO NOTHING;

REVOKE ALL ON FUNCTION public.safe_uuid(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bot_installed_in_realm(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_realm_bots(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bot_command_allowed_in_channel(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bot_consume_rate_limit(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bot_installed_in_realm(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_realm_bots(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bot_command_allowed_in_channel(uuid, uuid, uuid) TO authenticated, service_role;

-- ------------------------------------------- 7. internal message writer
-- Every bot message goes through here. It is deliberately NOT granted to anon
-- or authenticated: only the SECURITY DEFINER functions below may call it.
CREATE OR REPLACE FUNCTION public.bot_insert_message(
  _bot_id uuid,
  _realm_id uuid,
  _realm_room_id uuid,
  _body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_id uuid;
BEGIN
  -- Tells messages_guard_bot_actor() that this write is the bot API. The flag is
  -- transaction-local and cleared again immediately after the single insert, so
  -- it never covers anything the caller does later in the same transaction.
  PERFORM set_config('rizz.bot_writer', 'on', true);

  INSERT INTO public.messages (realm_id, realm_room_id, sender_id, bot_id, body)
  VALUES (_realm_id, _realm_room_id, NULL, _bot_id, _body)
  RETURNING id INTO v_id;

  PERFORM set_config('rizz.bot_writer', 'off', true);
  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.bot_insert_message(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------- 8. bot API
/**
 * The single entry point for an external bot.
 *
 * The caller passes sha256(token) — never the token itself — so a leaked
 * database row cannot be replayed as a bot token. Everything a bot can do is
 * gated here: valid token, installed and enabled realm, scope, rate limit.
 */
CREATE OR REPLACE FUNCTION public.bot_api(
  _token_hash text,
  _action text,
  _payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_bot public.bots;
  v_realm uuid;
  v_room uuid;
  v_body text;
  v_emoji text;
  v_message_id uuid;
  v_interaction public.bot_interactions;
  v_ok boolean;
BEGIN
  IF coalesce(btrim(_token_hash), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing bot token');
  END IF;

  SELECT * INTO v_bot FROM public.bots WHERE token_hash = btrim(_token_hash);
  IF v_bot.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid bot token');
  END IF;

  -- 60 calls a minute per bot is enough for chat and cheap enough to keep.
  v_ok := public.bot_consume_rate_limit(v_bot.id, 60, 60);
  IF NOT v_ok THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Rate limit exceeded, slow down');
  END IF;

  IF _action = 'list_commands' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'bot', jsonb_build_object('id', v_bot.id, 'name', v_bot.name),
      'commands', coalesce(
        (
          SELECT jsonb_agg(
            jsonb_build_object('name', c.name, 'description', c.description, 'options', c.options)
            ORDER BY c.name
          )
          FROM public.bot_commands c
          WHERE c.bot_id = v_bot.id AND c.enabled_globally
        ),
        '[]'::jsonb
      )
    );
  END IF;

  IF _action = 'send_message' THEN
    IF NOT ('messages.write' = ANY (v_bot.scopes)) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'This bot cannot send messages');
    END IF;

    v_realm := public.safe_uuid(_payload ->> 'realm_id');
    v_room := public.safe_uuid(_payload ->> 'realm_room_id');
    v_body := btrim(coalesce(_payload ->> 'body', ''));

    IF v_realm IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'realm_id is required');
    END IF;
    IF NOT public.bot_installed_in_realm(v_realm, v_bot.id) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'This bot is not installed in that realm');
    END IF;
    IF v_body = '' OR char_length(v_body) > 2000 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Message must be 1-2000 characters');
    END IF;
    IF v_room IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.realm_rooms r
      WHERE r.id = v_room AND r.realm_id = v_realm AND r.kind <> 'voice'
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'That channel is not a text channel of this realm');
    END IF;

    v_message_id := public.bot_insert_message(v_bot.id, v_realm, v_room, v_body);
    RETURN jsonb_build_object('ok', true, 'message_id', v_message_id);
  END IF;

  IF _action = 'edit_message' THEN
    IF NOT ('messages.write' = ANY (v_bot.scopes)) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'This bot cannot edit messages');
    END IF;

    v_message_id := public.safe_uuid(_payload ->> 'message_id');
    v_body := btrim(coalesce(_payload ->> 'body', ''));
    IF v_message_id IS NULL OR v_body = '' OR char_length(v_body) > 2000 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'message_id and a 1-2000 character body are required');
    END IF;

    -- A bot may only ever touch its own messages.
    UPDATE public.messages
    SET body = v_body
    WHERE id = v_message_id AND bot_id = v_bot.id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'That is not a message this bot sent');
    END IF;
    RETURN jsonb_build_object('ok', true, 'message_id', v_message_id);
  END IF;

  IF _action = 'delete_message' THEN
    IF NOT ('messages.write' = ANY (v_bot.scopes)) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'This bot cannot delete messages');
    END IF;

    v_message_id := public.safe_uuid(_payload ->> 'message_id');
    IF v_message_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'message_id is required');
    END IF;

    DELETE FROM public.messages WHERE id = v_message_id AND bot_id = v_bot.id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'That is not a message this bot sent');
    END IF;
    DELETE FROM public.message_reactions
    WHERE message_id = v_message_id AND message_type = 'realm';
    RETURN jsonb_build_object('ok', true, 'message_id', v_message_id);
  END IF;

  IF _action IN ('add_reaction', 'remove_reaction') THEN
    IF NOT ('reactions.write' = ANY (v_bot.scopes)) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'This bot cannot add reactions');
    END IF;

    v_message_id := public.safe_uuid(_payload ->> 'message_id');
    v_emoji := btrim(coalesce(_payload ->> 'emoji', ''));
    IF v_message_id IS NULL OR v_emoji = '' OR char_length(v_emoji) > 16 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'message_id and emoji are required');
    END IF;

    SELECT m.realm_id INTO v_realm FROM public.messages m WHERE m.id = v_message_id;
    IF v_realm IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Message not found');
    END IF;
    IF NOT public.bot_installed_in_realm(v_realm, v_bot.id) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'This bot is not installed in that realm');
    END IF;

    IF _action = 'add_reaction' THEN
      INSERT INTO public.message_reactions (message_id, user_id, bot_id, emoji, message_type)
      VALUES (v_message_id, NULL, v_bot.id, v_emoji, 'realm')
      ON CONFLICT DO NOTHING;
    ELSE
      DELETE FROM public.message_reactions
      WHERE message_id = v_message_id AND bot_id = v_bot.id
        AND emoji = v_emoji AND message_type = 'realm';
    END IF;
    RETURN jsonb_build_object('ok', true);
  END IF;

  IF _action = 'respond' THEN
    IF NOT ('messages.write' = ANY (v_bot.scopes)) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'This bot cannot send messages');
    END IF;

    v_body := btrim(coalesce(_payload ->> 'body', ''));
    IF v_body = '' OR char_length(v_body) > 2000 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'A 1-2000 character body is required');
    END IF;

    SELECT * INTO v_interaction
    FROM public.bot_interactions
    WHERE id = public.safe_uuid(_payload ->> 'interaction_id')
      AND bot_id = v_bot.id
      AND status = 'pending';

    IF v_interaction.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'That interaction is missing or already answered');
    END IF;
    IF NOT public.bot_installed_in_realm(v_interaction.realm_id, v_bot.id) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'This bot is no longer installed in that realm');
    END IF;

    v_message_id := public.bot_insert_message(
      v_bot.id,
      v_interaction.realm_id,
      v_interaction.realm_room_id,
      v_body
    );
    UPDATE public.bot_interactions
    SET status = 'completed', response_body = v_body, responded_at = now()
    WHERE id = v_interaction.id;

    RETURN jsonb_build_object('ok', true, 'message_id', v_message_id);
  END IF;

  -- A gateway bot (the ones that keep their own socket/worker instead of
  -- exposing a webhook) pulls its queue here. Interactions stay 'pending' until
  -- the bot answers them with 'respond', so nothing is ever lost or answered twice.
  IF _action = 'poll_interactions' THEN
    IF v_bot.delivery <> 'gateway' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Only gateway bots poll for interactions');
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'interactions', coalesce(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'interaction_id', i.id,
              'command', i.command_name,
              'args', i.args,
              'realm_id', i.realm_id,
              'realm_room_id', i.realm_room_id,
              'user_id', i.user_id,
              'created_at', i.created_at
            )
            ORDER BY i.created_at
          )
          FROM public.bot_interactions i
          WHERE i.bot_id = v_bot.id
            AND i.status = 'pending'
            AND i.created_at > now() - interval '15 minutes'
        ),
        '[]'::jsonb
      )
    );
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'Unknown action');
END;
$function$;

REVOKE ALL ON FUNCTION public.bot_api(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bot_api(text, text, jsonb) TO anon, authenticated, service_role;

-- ------------------------------- 9. authoring + management (signed-in user)
/**
 * Creates a custom bot for the signed-in user. The caller supplies the hash of
 * a freshly generated token, so the plaintext token never reaches the database.
 */
CREATE OR REPLACE FUNCTION public.create_bot(
  _name text,
  _description text,
  _avatar_url text,
  _delivery text,
  _webhook_url text,
  _scopes text[],
  _token_hash text,
  _token_prefix text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_name text := btrim(coalesce(_name, ''));
  v_delivery text := coalesce(nullif(btrim(coalesce(_delivery, '')), ''), 'webhook');
  v_webhook text := nullif(btrim(coalesce(_webhook_url, '')), '');
  v_id uuid;
  v_count integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to create a bot');
  END IF;
  IF char_length(v_name) < 2 OR char_length(v_name) > 32 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A bot name must be 2-32 characters');
  END IF;
  IF v_delivery NOT IN ('webhook', 'gateway') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Delivery must be webhook or gateway');
  END IF;
  IF v_webhook IS NOT NULL AND v_webhook !~ '^https://' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The delivery URL must start with https://');
  END IF;
  IF v_delivery = 'webhook' AND v_webhook IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A webhook bot needs a delivery URL');
  END IF;
  IF coalesce(btrim(_token_hash), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing bot token hash');
  END IF;

  SELECT count(*) INTO v_count FROM public.bots WHERE owner_id = v_user;
  IF v_count >= 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You can own up to 10 bots');
  END IF;

  BEGIN
    INSERT INTO public.bots (
      owner_id, name, description, avatar_url, token_hash, token_prefix,
      delivery, webhook_url, scopes, is_builtin, is_public
    )
    VALUES (
      v_user, v_name, coalesce(_description, ''), nullif(btrim(coalesce(_avatar_url, '')), ''),
      btrim(_token_hash), coalesce(_token_prefix, ''), v_delivery, v_webhook,
      coalesce(_scopes, ARRAY['messages.write', 'reactions.write']::text[]), false, false
    )
    RETURNING id INTO v_id;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object('ok', false, 'error', 'You already have a bot with that name');
  END;

  RETURN jsonb_build_object('ok', true, 'bot_id', v_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_bot(
  _bot_id uuid,
  _name text,
  _description text,
  _avatar_url text,
  _delivery text,
  _webhook_url text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_name text := btrim(coalesce(_name, ''));
  v_delivery text := coalesce(nullif(btrim(coalesce(_delivery, '')), ''), 'webhook');
  v_webhook text := nullif(btrim(coalesce(_webhook_url, '')), '');
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;
  IF char_length(v_name) < 2 OR char_length(v_name) > 32 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A bot name must be 2-32 characters');
  END IF;
  IF v_delivery NOT IN ('webhook', 'gateway') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Delivery must be webhook or gateway');
  END IF;
  IF v_webhook IS NOT NULL AND v_webhook !~ '^https://' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The delivery URL must start with https://');
  END IF;
  IF v_delivery = 'webhook' AND v_webhook IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A webhook bot needs a delivery URL');
  END IF;

  UPDATE public.bots
  SET name = v_name,
      description = coalesce(_description, ''),
      avatar_url = nullif(btrim(coalesce(_avatar_url, '')), ''),
      delivery = v_delivery,
      webhook_url = v_webhook,
      updated_at = now()
  WHERE id = _bot_id AND owner_id = v_user AND NOT is_builtin;

  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'That bot is not yours'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.regenerate_bot_token(_bot_id uuid, _token_hash text, _token_prefix text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;
  IF coalesce(btrim(_token_hash), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing bot token hash');
  END IF;

  UPDATE public.bots
  SET token_hash = btrim(_token_hash),
      token_prefix = coalesce(_token_prefix, ''),
      token_rotated_at = now()
  WHERE id = _bot_id AND owner_id = auth.uid() AND NOT is_builtin;

  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'That bot is not yours'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_bot_public(_bot_id uuid, _public boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;
  UPDATE public.bots SET is_public = coalesce(_public, false), updated_at = now()
  WHERE id = _bot_id AND owner_id = auth.uid() AND NOT is_builtin;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'That bot is not yours'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_bot(_bot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;
  DELETE FROM public.bots WHERE id = _bot_id AND owner_id = auth.uid() AND NOT is_builtin;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'That bot is not yours'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.my_bots()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'bot_id', b.id,
        'name', b.name,
        'description', b.description,
        'avatar_url', b.avatar_url,
        'token_prefix', b.token_prefix,
        'token_rotated_at', b.token_rotated_at,
        'delivery', b.delivery,
        'webhook_url', b.webhook_url,
        'scopes', to_jsonb(b.scopes),
        'is_public', b.is_public,
        'installs', (SELECT count(*) FROM public.realm_bot_installs i WHERE i.bot_id = b.id),
        'commands', coalesce(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', c.id, 'name', c.name, 'description', c.description,
                'options', c.options, 'enabled_globally', c.enabled_globally
              )
              ORDER BY c.name
            )
            FROM public.bot_commands c
            WHERE c.bot_id = b.id
          ),
          '[]'::jsonb
        )
      )
      ORDER BY b.created_at
    ),
    '[]'::jsonb
  )
  FROM public.bots b
  WHERE b.owner_id = auth.uid() AND NOT b.is_builtin;
$function$;

CREATE OR REPLACE FUNCTION public.register_bot_command(
  _bot_id uuid,
  _name text,
  _description text,
  _options jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_name text := lower(btrim(coalesce(_name, '')));
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.bots
    WHERE id = _bot_id AND owner_id = auth.uid() AND NOT is_builtin
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That bot is not yours');
  END IF;
  IF v_name !~ '^[a-z0-9_-]{1,32}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Command names are 1-32 characters: a-z, 0-9, _ and -');
  END IF;
  IF char_length(coalesce(_description, '')) > 160 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Keep the description under 160 characters');
  END IF;

  INSERT INTO public.bot_commands (bot_id, name, description, options)
  VALUES (_bot_id, v_name, coalesce(_description, ''), coalesce(_options, '[]'::jsonb))
  ON CONFLICT (bot_id, name) DO UPDATE
  SET description = excluded.description, options = excluded.options
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'command_id', v_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_bot_command(_bot_id uuid, _command_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.bots WHERE id = _bot_id AND owner_id = auth.uid() AND NOT is_builtin
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That bot is not yours');
  END IF;
  DELETE FROM public.bot_commands WHERE id = _command_id AND bot_id = _bot_id;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

/** Built-in bots plus any custom bot its owner published. */
CREATE OR REPLACE FUNCTION public.bot_directory(_search text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'bot_id', b.id,
        'name', b.name,
        'description', b.description,
        'avatar_url', b.avatar_url,
        'is_builtin', b.is_builtin,
        'owner_id', b.owner_id,
        'installs', (SELECT count(*) FROM public.realm_bot_installs i WHERE i.bot_id = b.id),
        'commands', coalesce(
          (
            SELECT jsonb_agg(
              jsonb_build_object('name', c.name, 'description', c.description)
              ORDER BY c.name
            )
            FROM public.bot_commands c
            WHERE c.bot_id = b.id AND c.enabled_globally
          ),
          '[]'::jsonb
        )
      )
      ORDER BY b.is_builtin DESC, b.name
    ),
    '[]'::jsonb
  )
  FROM public.bots b
  WHERE (b.is_builtin OR b.is_public OR b.owner_id = auth.uid())
    AND (
      coalesce(btrim(coalesce(_search, '')), '') = ''
      OR b.name ILIKE '%' || btrim(_search) || '%'
      OR b.description ILIKE '%' || btrim(_search) || '%'
    );
$function$;

CREATE OR REPLACE FUNCTION public.install_realm_bot(_realm_id uuid, _bot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;
  IF NOT public.can_manage_realm_bots(_realm_id, auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only owners and moderators can add bots here');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.bots
    WHERE id = _bot_id AND (is_builtin OR is_public OR owner_id = auth.uid())
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That bot is not available to install');
  END IF;

  INSERT INTO public.realm_bot_installs (realm_id, bot_id, installed_by, enabled)
  VALUES (_realm_id, _bot_id, auth.uid(), true)
  ON CONFLICT (realm_id, bot_id) DO UPDATE SET enabled = true;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.uninstall_realm_bot(_realm_id uuid, _bot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;
  IF NOT public.can_manage_realm_bots(_realm_id, auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only owners and moderators can remove bots here');
  END IF;

  DELETE FROM public.realm_bot_installs WHERE realm_id = _realm_id AND bot_id = _bot_id;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_realm_bot_enabled(_realm_id uuid, _bot_id uuid, _enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;
  IF NOT public.can_manage_realm_bots(_realm_id, auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only owners and moderators can change bots here');
  END IF;

  UPDATE public.realm_bot_installs
  SET enabled = coalesce(_enabled, false)
  WHERE realm_id = _realm_id AND bot_id = _bot_id;

  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'That bot is not installed here'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

/** Owner-only: let every member add bots to this realm. */
CREATE OR REPLACE FUNCTION public.set_realm_allow_member_bots(_realm_id uuid, _allow boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.realms WHERE id = _realm_id AND owner_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only the realm owner can change this');
  END IF;

  UPDATE public.realms SET allow_member_bots = coalesce(_allow, false) WHERE id = _realm_id;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

/** Owner-only: grant one member the "manage bots" permission. */
CREATE OR REPLACE FUNCTION public.set_realm_member_manage_bots(_realm_id uuid, _user_id uuid, _allowed boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.realms WHERE id = _realm_id AND owner_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only the realm owner can change this');
  END IF;

  UPDATE public.realm_members
  SET can_manage_bots = coalesce(_allowed, false)
  WHERE realm_id = _realm_id AND user_id = _user_id;

  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'That person is not in this realm'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

/** Switches one bot command on or off in one channel. */
CREATE OR REPLACE FUNCTION public.set_bot_command_channel_enabled(
  _realm_id uuid,
  _realm_room_id uuid,
  _command_id uuid,
  _enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
  DECLARE
    v_room_key uuid := coalesce(_realm_room_id, _realm_id);
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;
  IF NOT public.can_manage_realm_bots(_realm_id, auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only owners and moderators can change this');
  END IF;
  IF _realm_room_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.realm_rooms r WHERE r.id = _realm_room_id AND r.realm_id = _realm_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That channel is not part of this realm');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.bot_commands c
    JOIN public.realm_bot_installs i ON i.bot_id = c.bot_id AND i.realm_id = _realm_id
    WHERE c.id = _command_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That command does not belong to an installed bot');
  END IF;

  UPDATE public.realm_bot_command_settings
  SET enabled = coalesce(_enabled, false), updated_at = now()
  WHERE realm_id = _realm_id
    AND coalesce(realm_room_id, realm_id) = v_room_key
    AND command_id = _command_id;

  IF NOT FOUND THEN
    INSERT INTO public.realm_bot_command_settings (realm_id, realm_room_id, command_id, enabled)
    VALUES (_realm_id, _realm_room_id, _command_id, coalesce(_enabled, false));
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

/** Everything the realm's bot settings screen needs, in one request. */
CREATE OR REPLACE FUNCTION public.realm_bots(_realm_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT CASE
    WHEN NOT public.is_realm_member(_realm_id) THEN '{}'::jsonb
    ELSE jsonb_build_object(
      'can_manage', public.can_manage_realm_bots(_realm_id, auth.uid()),
      'allow_member_bots', coalesce((SELECT r.allow_member_bots FROM public.realms r WHERE r.id = _realm_id), false),
      'bots', coalesce(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'bot_id', b.id,
              'name', b.name,
              'description', b.description,
              'avatar_url', b.avatar_url,
              'is_builtin', b.is_builtin,
              'enabled', i.enabled,
              'commands', coalesce(
                (
                  SELECT jsonb_agg(
                    jsonb_build_object('id', c.id, 'name', c.name, 'description', c.description)
                    ORDER BY c.name
                  )
                  FROM public.bot_commands c
                  WHERE c.bot_id = b.id AND c.enabled_globally
                ),
                '[]'::jsonb
              )
            )
            ORDER BY b.is_builtin DESC, b.name
          )
          FROM public.realm_bot_installs i
          JOIN public.bots b ON b.id = i.bot_id
          WHERE i.realm_id = _realm_id
        ),
        '[]'::jsonb
      ),
      'channel_settings', coalesce(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'command_id', s.command_id,
              'realm_room_id', s.realm_room_id,
              'enabled', s.enabled
            )
          )
          FROM public.realm_bot_command_settings s
          WHERE s.realm_id = _realm_id
        ),
        '[]'::jsonb
      )
    )
  END;
$function$;

/**
 * The commands offered by the composer's "/" menu in one channel.
 *
 * Members only, and only commands whose bot is installed and enabled and whose
 * per-channel switch is not off.
 */
CREATE OR REPLACE FUNCTION public.realm_slash_commands(_realm_id uuid, _realm_room_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT CASE
    WHEN NOT public.is_realm_member(_realm_id) THEN '[]'::jsonb
    ELSE coalesce(
      jsonb_agg(
        jsonb_build_object(
          'command_id', c.id,
          'name', c.name,
          'description', c.description,
          'options', c.options,
          'bot_id', b.id,
          'bot_name', b.name,
          'bot_avatar_url', b.avatar_url,
          'is_builtin', b.is_builtin
        )
        ORDER BY b.is_builtin DESC, b.name, c.name
      ),
      '[]'::jsonb
    )
  END
  FROM public.bot_commands c
  JOIN public.bots b ON b.id = c.bot_id
  JOIN public.realm_bot_installs i
    ON i.bot_id = b.id AND i.realm_id = _realm_id AND i.enabled
  WHERE c.enabled_globally
    AND public.bot_command_allowed_in_channel(_realm_id, _realm_room_id, c.id);
$function$;

REVOKE ALL ON FUNCTION public.create_bot(text, text, text, text, text, text[], text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_bot(uuid, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.regenerate_bot_token(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_bot_public(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_bot(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_bots() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_bot_command(uuid, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_bot_command(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bot_directory(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.install_realm_bot(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.uninstall_realm_bot(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_realm_bot_enabled(uuid, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_realm_allow_member_bots(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_realm_member_manage_bots(uuid, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_bot_command_channel_enabled(uuid, uuid, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.realm_bots(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.realm_slash_commands(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_bot(text, text, text, text, text, text[], text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_bot(uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_bot_token(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_bot_public(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_bot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_bots() TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_bot_command(uuid, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_bot_command(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bot_directory(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.install_realm_bot(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.uninstall_realm_bot(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_realm_bot_enabled(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_realm_allow_member_bots(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_realm_member_manage_bots(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_bot_command_channel_enabled(uuid, uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.realm_bots(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.realm_slash_commands(uuid, uuid) TO authenticated;

-- ------------------------------------------------- 10. the RIZZ BOT runner
/**
 * Runs one built-in RIZZ BOT command for the signed-in user.
 *
 * `_override_body` lets the server route hand in an LLM-written line when an API
 * key is configured; when it is null the curated line bank is used. Either way
 * the membership, install, channel and cooldown checks below are the only thing
 * that decides whether anything is posted.
 */
CREATE OR REPLACE FUNCTION public.run_builtin_bot_command(
  _command text,
  _args text,
  _realm_id uuid,
  _realm_room_id uuid,
  _override_body text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_bot_id uuid;
  v_command public.bot_commands;
  v_name text := lower(btrim(coalesce(_command, '')));
  v_args text := btrim(coalesce(_args, ''));
  v_body text;
  v_message_id uuid;
  v_line text;
  v_target uuid;
  v_target_name text;
  v_me_name text;
  v_score integer;
  v_kind text;
  v_cooldown integer;
  v_next_at timestamptz;
  v_room_ok boolean;
  v_battle public.rizz_bot_battles;
  v_text text;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to use bot commands');
  END IF;
  IF _realm_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Slash commands only work inside a realm');
  END IF;
  IF NOT public.is_realm_member(_realm_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Join this realm to use its bot commands');
  END IF;

  -- A voice channel holds no messages, so commands are refused there.
  IF _realm_room_id IS NOT NULL THEN
    SELECT (r.kind <> 'voice') INTO v_room_ok
    FROM public.realm_rooms r
    WHERE r.id = _realm_room_id AND r.realm_id = _realm_id;
    IF coalesce(v_room_ok, false) IS NOT TRUE THEN
      RETURN jsonb_build_object('ok', false, 'error', 'That is not a text channel of this realm');
    END IF;
  END IF;

  SELECT id INTO v_bot_id FROM public.bots WHERE is_builtin AND name = 'RIZZ BOT';
  IF v_bot_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The house bot is not available');
  END IF;
  IF NOT public.bot_installed_in_realm(_realm_id, v_bot_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RIZZ BOT is not installed in this realm');
  END IF;

  SELECT * INTO v_command
  FROM public.bot_commands
  WHERE bot_id = v_bot_id AND name = v_name;

  IF v_command.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unknown command /' || v_name);
  END IF;
  IF NOT v_command.enabled_globally THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That command is switched off');
  END IF;
  IF NOT public.bot_command_allowed_in_channel(_realm_id, _realm_room_id, v_command.id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That command is switched off in this channel');
  END IF;

  -- Opportunistic housekeeping, so battles settle without a scheduled job.
  PERFORM public.rizz_bot_settle_realm(_realm_id);

  v_cooldown := CASE v_name
    WHEN 'help' THEN 5
    WHEN 'rizz' THEN 10
    WHEN 'rizzboard' THEN 15
    WHEN 'icebreaker' THEN 15
    WHEN 'rizzme' THEN 20
    WHEN 'rate' THEN 30
    WHEN 'compliment' THEN 30
    WHEN 'rizzsubmit' THEN 2
    WHEN 'daily' THEN 3600
    WHEN 'rizzbattle' THEN 120
    ELSE 15
  END;

  SELECT next_at INTO v_next_at
  FROM public.rizz_bot_cooldowns
  WHERE realm_id = _realm_id AND user_id = v_user AND command = v_name;

  IF v_next_at IS NOT NULL AND v_next_at > now() THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Slow down — /' || v_name || ' is ready again in ' ||
        greatest(1, ceil(extract(epoch FROM (v_next_at - now()))))::int || 's'
    );
  END IF;

  -- Resolve an optional "@user" or user id argument.
  v_target := public.safe_uuid(v_args);
  IF v_target IS NULL AND v_args LIKE '@%' THEN
    SELECT p.id INTO v_target
    FROM public.profiles p
    WHERE lower(p.username) = lower(split_part(substring(v_args FROM 2), ' ', 1))
    LIMIT 1;
  END IF;

  IF v_target IS NOT NULL THEN
    SELECT coalesce(p.display_name, p.username, 'someone') INTO v_target_name
    FROM public.profiles p WHERE p.id = v_target;
  END IF;
  SELECT coalesce(p.display_name, p.username, 'someone') INTO v_me_name
  FROM public.profiles p WHERE p.id = v_user;

  IF v_name IN ('rate', 'compliment', 'rizzbattle', 'rizz') AND v_args <> '' AND v_target IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'I could not find that person. Try picking them from the list.');
  END IF;

  IF v_name = 'help' THEN
    SELECT string_agg('`/' || c.name || '` — ' || c.description, E'\n' ORDER BY c.name)
    INTO v_text
    FROM public.bot_commands c
    WHERE c.bot_id = v_bot_id
      AND c.enabled_globally
      AND c.name <> 'help'
      AND public.bot_command_allowed_in_channel(_realm_id, _realm_room_id, c.id);
    v_body := 'Here is what I can do in this channel:' || E'\n' || coalesce(v_text, 'Nothing yet.');

  ELSIF v_name = 'daily' THEN
    WITH lines AS (
      SELECT body, row_number() OVER (ORDER BY body) AS rn, count(*) OVER () AS total
      FROM public.rizz_bot_lines
      WHERE kind = 'daily' AND is_active
    )
    SELECT body INTO v_line
    FROM lines
    WHERE rn = (abs(hashtext(_realm_id::text || current_date::text)) % total) + 1;
    v_body := 'Today''s rizz challenge: ' || coalesce(v_line, 'Be kind, be curious, be quick to reply.');

  ELSIF v_name = 'rizzboard' THEN
    SELECT string_agg(
      (CASE WHEN rn = 1 THEN '🥇' WHEN rn = 2 THEN '🥈' WHEN rn = 3 THEN '🥉' ELSE rn::text || '.' END)
        || ' ' || name || ' — ' || points || ' pts',
      E'\n' ORDER BY rn
    )
    INTO v_text
    FROM (
      SELECT coalesce(p.display_name, p.username, 'someone') AS name, pts.points,
             row_number() OVER (ORDER BY pts.points DESC, p.username) AS rn
      FROM public.rizz_bot_points pts
      JOIN public.profiles p ON p.id = pts.user_id
      WHERE pts.realm_id = _realm_id AND pts.points > 0
      LIMIT 10
    ) ranked;
    v_body := CASE
      WHEN v_text IS NULL THEN 'The rizzboard is empty. Try `/rate @someone` or `/compliment @someone` to put people on it.'
      ELSE 'Realm rizzboard:' || E'\n' || v_text
    END;

  ELSIF v_name = 'rizz' THEN
    v_kind := CASE WHEN v_target IS NULL THEN 'smooth' ELSE 'personal' END;
    SELECT body INTO v_line FROM public.rizz_bot_lines
    WHERE kind = v_kind AND is_active ORDER BY random() LIMIT 1;
    v_line := coalesce(v_line, 'You are doing better than you think.');
    IF v_kind = 'personal' THEN
      v_line := replace(v_line, '{name}', coalesce(v_target_name, 'friend'));
    END IF;
    v_body := v_line;

  ELSIF v_name = 'compliment' THEN
    IF v_target IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Tell me who to compliment: /compliment @someone');
    END IF;
    SELECT body INTO v_line FROM public.rizz_bot_lines
    WHERE kind = 'compliment' AND is_active ORDER BY random() LIMIT 1;
    v_body := coalesce(v_target_name, 'friend') || ', ' || coalesce(v_line, 'you are good company.');
    INSERT INTO public.rizz_bot_points (realm_id, user_id, points, updated_at)
    VALUES (_realm_id, v_target, 1, now())
    ON CONFLICT (realm_id, user_id) DO UPDATE
    SET points = public.rizz_bot_points.points + 1, updated_at = now();

  ELSIF v_name = 'icebreaker' THEN
    SELECT body INTO v_line FROM public.rizz_bot_lines
    WHERE kind = 'icebreaker' AND is_active ORDER BY random() LIMIT 1;
    v_body := coalesce(v_line, 'What is something small that made your week better?');

  ELSIF v_name = 'rate' THEN
    IF v_target IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Tell me who to rate: /rate @someone');
    END IF;
    -- Deterministic for the day, so the number is stable when people ask twice.
    v_score := abs(hashtext(v_target::text || current_date::text)) % 101;
    SELECT body INTO v_line FROM public.rizz_bot_lines
    WHERE kind = CASE
        WHEN v_score < 35 THEN 'rate_low'
        WHEN v_score < 60 THEN 'rate_mid'
        WHEN v_score < 85 THEN 'rate_high'
        ELSE 'rate_elite'
      END
      AND is_active
    ORDER BY (abs(hashtext(body || v_target::text || current_date::text)) % 97)
    LIMIT 1;
    v_body := coalesce(v_target_name, 'They') || ' scores ' || v_score || '/100. ' ||
      coalesce(v_line, 'Jury is still out.');
    INSERT INTO public.rizz_bot_points (realm_id, user_id, points, updated_at)
    VALUES (_realm_id, v_target, 1, now())
    ON CONFLICT (realm_id, user_id) DO UPDATE
    SET points = public.rizz_bot_points.points + 1, updated_at = now();

  ELSIF v_name = 'rizzme' THEN
    IF v_args = '' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Describe the situation: /rizzme she left me on read');
    END IF;
    SELECT string_agg('• ' || body, E'\n')
    INTO v_text
    FROM (
      SELECT body FROM public.rizz_bot_lines
      WHERE kind = 'smooth' AND is_active ORDER BY random() LIMIT 2
    ) picks;
    v_body := 'For "' || left(v_args, 140) || '", try:' || E'\n' || coalesce(v_text, '• Keep it short and specific.');

  ELSIF v_name = 'rizzbattle' THEN
    IF v_target IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Challenge someone: /rizzbattle @someone');
    END IF;
    IF v_target = v_user THEN
      RETURN jsonb_build_object('ok', false, 'error', 'You cannot battle yourself');
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.rizz_bot_battles b
      WHERE b.realm_id = _realm_id AND b.status <> 'settled'
        AND (b.challenger_id IN (v_user, v_target) OR b.target_id IN (v_user, v_target))
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'One of you already has a battle running here');
    END IF;

    INSERT INTO public.rizz_bot_battles (
      realm_id, realm_room_id, challenger_id, target_id, status,
      collect_until
    )
    VALUES (
      _realm_id, _realm_room_id, v_user, v_target, 'collecting',
      now() + interval '2 minutes'
    );

    v_body := v_me_name || ' vs ' || coalesce(v_target_name, 'challenger') || E' 🤼\n' ||
      '2 minutes on the clock. Both of you, drop your best line with `/rizzsubmit <your line>`. The realm votes with reactions.';

  ELSIF v_name = 'rizzsubmit' THEN
    IF v_args = '' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Add your line: /rizzsubmit <your line>');
    END IF;

    SELECT * INTO v_battle
    FROM public.rizz_bot_battles b
    WHERE b.realm_id = _realm_id
      AND b.status = 'collecting'
      AND (b.challenger_id = v_user OR b.target_id = v_user)
    ORDER BY b.created_at DESC
    LIMIT 1;

    IF v_battle.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'You have no open battle in this realm');
    END IF;
    IF v_battle.collect_until <= now() THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Submission time is over for that battle');
    END IF;

    UPDATE public.rizz_bot_battles
    SET challenger_line = CASE WHEN challenger_id = v_user THEN left(v_args, 280) ELSE challenger_line END,
        target_line = CASE WHEN target_id = v_user THEN left(v_args, 280) ELSE target_line END
    WHERE id = v_battle.id;

    v_body := 'Line submitted. ' || CASE
      WHEN v_user = v_battle.challenger_id THEN coalesce(v_target_name, 'Your opponent')
      ELSE v_me_name
    END || ' is still needed.';

  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'That command is not available');
  END IF;

  -- A configured LLM may replace the curated wording, never the checks above.
  IF _override_body IS NOT NULL AND btrim(_override_body) <> '' THEN
    v_body := left(btrim(_override_body), 2000);
  END IF;

  v_message_id := public.bot_insert_message(v_bot_id, _realm_id, _realm_room_id, v_body);

  INSERT INTO public.rizz_bot_cooldowns (realm_id, user_id, command, next_at)
  VALUES (_realm_id, v_user, v_name, now() + make_interval(secs => v_cooldown))
  ON CONFLICT (realm_id, user_id, command)
  DO UPDATE SET next_at = now() + make_interval(secs => v_cooldown);

  RETURN jsonb_build_object('ok', true, 'message_id', v_message_id, 'body', v_body);
END;
$function$;

/**
 * Moves every open RIZZ BOT battle in a realm forward one step.
 *
 * Battles waiting for lines either open for voting (when both arrived) or are
 * cancelled. Battles in voting count the realm's reactions and announce a
 * winner. Returns how many battles changed state.
 */
CREATE OR REPLACE FUNCTION public.rizz_bot_settle_realm(_realm_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_bot_id uuid;
  v_battle public.rizz_bot_battles;
  v_a uuid;
  v_b uuid;
  v_a_name text;
  v_b_name text;
  v_count integer := 0;
  v_votes_a integer;
  v_votes_b integer;
BEGIN
  SELECT id INTO v_bot_id FROM public.bots WHERE is_builtin AND name = 'RIZZ BOT';
  IF v_bot_id IS NULL THEN RETURN 0; END IF;
  IF NOT public.bot_installed_in_realm(_realm_id, v_bot_id) THEN RETURN 0; END IF;

  FOR v_battle IN
    SELECT * FROM public.rizz_bot_battles b
    WHERE b.realm_id = _realm_id AND b.status = 'collecting'
      AND (b.collect_until <= now() OR (b.challenger_line IS NOT NULL AND b.target_line IS NOT NULL))
    ORDER BY b.created_at
  LOOP
    SELECT coalesce(p.display_name, p.username, 'someone') INTO v_a_name
    FROM public.profiles p WHERE p.id = v_battle.challenger_id;
    SELECT coalesce(p.display_name, p.username, 'someone') INTO v_b_name
    FROM public.profiles p WHERE p.id = v_battle.target_id;

    IF v_battle.challenger_line IS NOT NULL AND v_battle.target_line IS NOT NULL THEN
      v_a := public.bot_insert_message(
        v_bot_id, _realm_id, v_battle.realm_room_id,
        '🎲 ' || coalesce(v_a_name, 'challenger') || ': ' || v_battle.challenger_line
      );
      v_b := public.bot_insert_message(
        v_bot_id, _realm_id, v_battle.realm_room_id,
        '🎲 ' || coalesce(v_b_name, 'challenger') || ': ' || v_battle.target_line
      );
      UPDATE public.rizz_bot_battles
      SET status = 'voting', message_a_id = v_a, message_b_id = v_b,
          vote_until = now() + interval '90 seconds'
      WHERE id = v_battle.id;

      PERFORM public.bot_insert_message(
        v_bot_id, _realm_id, v_battle.realm_room_id,
        'Both lines are in. React to the one you rate higher — 90 seconds. 🗳'
      );
    ELSE
      UPDATE public.rizz_bot_battles SET status = 'settled' WHERE id = v_battle.id;
      PERFORM public.bot_insert_message(
        v_bot_id, _realm_id, v_battle.realm_room_id,
        'Battle called off: not enough lines arrived. 🤷'
      );
    END IF;

    v_count := v_count + 1;
  END LOOP;

  FOR v_battle IN
    SELECT * FROM public.rizz_bot_battles b
    WHERE b.realm_id = _realm_id AND b.status = 'voting' AND b.vote_until <= now()
    ORDER BY b.created_at
  LOOP
    SELECT count(*) INTO v_votes_a FROM public.message_reactions
    WHERE message_type = 'realm' AND message_id = v_battle.message_a_id AND user_id IS NOT NULL;
    SELECT count(*) INTO v_votes_b FROM public.message_reactions
    WHERE message_type = 'realm' AND message_id = v_battle.message_b_id AND user_id IS NOT NULL;

    SELECT coalesce(p.display_name, p.username, 'someone') INTO v_a_name
    FROM public.profiles p WHERE p.id = v_battle.challenger_id;
    SELECT coalesce(p.display_name, p.username, 'someone') INTO v_b_name
    FROM public.profiles p WHERE p.id = v_battle.target_id;

    UPDATE public.rizz_bot_battles
    SET status = 'settled',
        winner_id = CASE
          WHEN v_votes_a > v_votes_b THEN v_battle.challenger_id
          WHEN v_votes_b > v_votes_a THEN v_battle.target_id
          ELSE NULL
        END
    WHERE id = v_battle.id;

    IF v_votes_a = v_votes_b THEN
      PERFORM public.bot_insert_message(
        v_bot_id, _realm_id, v_battle.realm_room_id,
        'It is a tie: ' || v_votes_a || ' to ' || v_votes_b || '. You are both dangerous. 🤝'
      );
    ELSE
      PERFORM public.bot_insert_message(
        v_bot_id, _realm_id, v_battle.realm_room_id,
        '🏆 ' || (CASE WHEN v_votes_a > v_votes_b THEN v_a_name ELSE v_b_name END) ||
        ' takes it, ' || greatest(v_votes_a, v_votes_b) || ' to ' || least(v_votes_a, v_votes_b) || '.'
      );
    END IF;

    -- The winner gets the points.
    INSERT INTO public.rizz_bot_points (realm_id, user_id, points, updated_at)
    SELECT _realm_id, w, 3, now()
    FROM (
      SELECT CASE
        WHEN v_votes_a > v_votes_b THEN v_battle.challenger_id
        WHEN v_votes_b > v_votes_a THEN v_battle.target_id
        ELSE NULL
      END AS w
    ) picked
    WHERE w IS NOT NULL
    ON CONFLICT (realm_id, user_id) DO UPDATE
    SET points = public.rizz_bot_points.points + 3, updated_at = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.run_builtin_bot_command(text, text, uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rizz_bot_settle_realm(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_builtin_bot_command(text, text, uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rizz_bot_settle_realm(uuid) TO authenticated, service_role;

-- ------------------------------------------------------- 11. RLS + grants
-- Every bot write goes through a SECURITY DEFINER function, so there are no
-- INSERT/UPDATE/DELETE policies at all: a client can only read.
DO $rls$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bots', 'bot_commands', 'realm_bot_installs', 'realm_bot_command_settings',
    'bot_rate_limits', 'bot_interactions', 'rizz_bot_lines', 'rizz_bot_points',
    'rizz_bot_cooldowns', 'rizz_bot_battles'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END
$rls$;

GRANT SELECT ON public.bots TO authenticated;
GRANT SELECT ON public.bot_commands TO authenticated;
GRANT SELECT ON public.realm_bot_installs TO authenticated;
GRANT SELECT ON public.realm_bot_command_settings TO authenticated;
GRANT SELECT ON public.bot_interactions TO authenticated;
GRANT SELECT ON public.rizz_bot_lines TO authenticated;
GRANT SELECT ON public.rizz_bot_points TO authenticated;
GRANT SELECT ON public.rizz_bot_battles TO authenticated;

ALTER TABLE public.realm_bot_installs REPLICA IDENTITY FULL;
ALTER TABLE public.bot_commands REPLICA IDENTITY FULL;
ALTER TABLE public.rizz_bot_battles REPLICA IDENTITY FULL;
ALTER TABLE public.rizz_bot_points REPLICA IDENTITY FULL;

-- A bot row is visible to its owner, and to anyone who belongs to a realm it is
-- installed in (they need the name and avatar on messages).
DROP POLICY IF EXISTS bots_readable ON public.bots;
CREATE POLICY bots_readable ON public.bots
  FOR SELECT TO authenticated
  USING (
    is_builtin
    OR is_public
    OR owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.realm_bot_installs i
      WHERE i.bot_id = bots.id AND public.is_realm_member(i.realm_id)
    )
  );

DROP POLICY IF EXISTS bot_commands_readable ON public.bot_commands;
CREATE POLICY bot_commands_readable ON public.bot_commands
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bots b
      WHERE b.id = bot_commands.bot_id
        AND (
          b.is_builtin
          OR b.is_public
          OR b.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.realm_bot_installs i
            WHERE i.bot_id = b.id AND public.is_realm_member(i.realm_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS realm_bot_installs_read ON public.realm_bot_installs;
CREATE POLICY realm_bot_installs_read ON public.realm_bot_installs
  FOR SELECT TO authenticated
  USING (public.is_realm_member(realm_id));

DROP POLICY IF EXISTS realm_bot_command_settings_read ON public.realm_bot_command_settings;
CREATE POLICY realm_bot_command_settings_read ON public.realm_bot_command_settings
  FOR SELECT TO authenticated
  USING (public.is_realm_member(realm_id));

-- An interaction is visible to the realm it happened in, plus the bot's owner.
DROP POLICY IF EXISTS bot_interactions_read ON public.bot_interactions;
CREATE POLICY bot_interactions_read ON public.bot_interactions
  FOR SELECT TO authenticated
  USING (
    public.is_realm_member(realm_id)
    OR EXISTS (SELECT 1 FROM public.bots b WHERE b.id = bot_interactions.bot_id AND b.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS rizz_bot_lines_read ON public.rizz_bot_lines;
CREATE POLICY rizz_bot_lines_read ON public.rizz_bot_lines
  FOR SELECT TO authenticated
  USING (is_active);

DROP POLICY IF EXISTS rizz_bot_points_read ON public.rizz_bot_points;
CREATE POLICY rizz_bot_points_read ON public.rizz_bot_points
  FOR SELECT TO authenticated
  USING (public.is_realm_member(realm_id));

DROP POLICY IF EXISTS rizz_bot_battles_read ON public.rizz_bot_battles;
CREATE POLICY rizz_bot_battles_read ON public.rizz_bot_battles
  FOR SELECT TO authenticated
  USING (public.is_realm_member(realm_id));

-- ------------------------------------------------------------- 12. realtime
-- Bot installs, commands and battles reach every open realm live.
DO $pub$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['realm_bot_installs', 'bot_commands', 'rizz_bot_battles', 'rizz_bot_points']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END
$pub$;

-- --------------------------------------------- 13. external bot dispatch
/**
 * Records that a member invoked one of an installed bot's commands.
 *
 * Returns the interaction id so the server route can hand it to the bot and the
 * bot can answer it later through bot_api(action => 'respond'). The webhook URL
 * is deliberately NOT returned here: it stays server-side.
 */
CREATE OR REPLACE FUNCTION public.create_bot_interaction(
  _command_id uuid,
  _realm_id uuid,
  _realm_room_id uuid,
  _args text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_command public.bot_commands;
  v_id uuid;
  v_recent integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to use bot commands');
  END IF;
  IF _realm_id IS NULL OR NOT public.is_realm_member(_realm_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Slash commands only work inside a realm you belong to');
  END IF;

  SELECT * INTO v_command FROM public.bot_commands WHERE id = _command_id;
  IF v_command.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unknown command');
  END IF;
  IF NOT v_command.enabled_globally THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That command is switched off');
  END IF;
  IF NOT public.bot_installed_in_realm(_realm_id, v_command.bot_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That bot is not installed in this realm');
  END IF;
  IF NOT public.bot_command_allowed_in_channel(_realm_id, _realm_room_id, v_command.id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That command is switched off in this channel');
  END IF;
  IF _realm_room_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.realm_rooms r
    WHERE r.id = _realm_room_id AND r.realm_id = _realm_id AND r.kind <> 'voice'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That is not a text channel of this realm');
  END IF;

  -- A bot command is not a way to spam a webhook endpoint.
  SELECT count(*) INTO v_recent
  FROM public.bot_interactions
  WHERE user_id = v_user AND realm_id = _realm_id
    AND created_at > now() - interval '1 minute';
  IF v_recent >= 15 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Slow down a little and try again in a minute');
  END IF;

  INSERT INTO public.bot_interactions (
    bot_id, realm_id, realm_room_id, user_id, command_name, args, status
  )
  VALUES (
    v_command.bot_id, _realm_id, _realm_room_id, v_user, v_command.name,
    left(coalesce(_args, ''), 400), 'pending'
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'interaction_id', v_id, 'bot_id', v_command.bot_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_bot_interaction(uuid, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_bot_interaction(uuid, uuid, uuid, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
