-- ============================================================================
-- PHASE 3 follow-up: reaction rules.
--
-- Reactions were already optimistic, deduped and unique per (message, user,
-- emoji). Three rules were still missing, and a trigger is the right place for
-- all three because it also covers rows written by an older client:
--
--   1. an unsent (soft-deleted) message keeps no reactions,
--   2. a message carries at most 20 different emoji,
--   3. an unsent message cannot be reacted to at all.
--
-- Safe to re-run.
-- ============================================================================

/** Shared rule set, one trigger body for both reaction tables. */
CREATE OR REPLACE FUNCTION public.reactions_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $guard$
DECLARE
  v_scope text;
  v_unique integer;
BEGIN
  -- The scope comes from the table, because dm_reactions has no message_type
  -- column and touching NEW.message_type on it would raise.
  IF TG_TABLE_NAME = 'dm_reactions' THEN
    v_scope := 'dm';
  ELSE
    v_scope := coalesce(to_jsonb(NEW)->>'message_type', 'realm');
  END IF;

  IF v_scope = 'dm' THEN
    IF EXISTS (SELECT 1 FROM public.direct_messages d WHERE d.id = NEW.message_id AND d.deleted_at IS NOT NULL) THEN
      RAISE EXCEPTION 'You cannot react to an unsent message';
    END IF;
  ELSIF v_scope = 'group' THEN
    IF EXISTS (SELECT 1 FROM public.group_messages g WHERE g.id = NEW.message_id AND g.deleted_at IS NOT NULL) THEN
      RAISE EXCEPTION 'You cannot react to an unsent message';
    END IF;
  END IF;

  -- At most 20 different emoji on one message; a repeat of an existing one is
  -- always allowed (that is just someone else joining in).
  IF TG_TABLE_NAME = 'dm_reactions' THEN
    SELECT count(DISTINCT emoji) INTO v_unique
    FROM public.dm_reactions WHERE message_id = NEW.message_id;
    IF v_unique >= 20 AND NOT EXISTS (
      SELECT 1 FROM public.dm_reactions
      WHERE message_id = NEW.message_id AND emoji = NEW.emoji
    ) THEN
      RAISE EXCEPTION 'This message already has 20 different reactions';
    END IF;
  ELSE
    SELECT count(DISTINCT emoji) INTO v_unique
    FROM public.message_reactions
    WHERE message_id = NEW.message_id AND message_type = v_scope;
    IF v_unique >= 20 AND NOT EXISTS (
      SELECT 1 FROM public.message_reactions
      WHERE message_id = NEW.message_id AND message_type = v_scope AND emoji = NEW.emoji
    ) THEN
      RAISE EXCEPTION 'This message already has 20 different reactions';
    END IF;
  END IF;

  RETURN NEW;
END
$guard$;

REVOKE ALL ON FUNCTION public.reactions_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reactions_guard_t ON public.message_reactions;
CREATE TRIGGER reactions_guard_t
  BEFORE INSERT ON public.message_reactions
  FOR EACH ROW EXECUTE FUNCTION public.reactions_guard();

DROP TRIGGER IF EXISTS dm_reactions_guard_t ON public.dm_reactions;
CREATE TRIGGER dm_reactions_guard_t
  BEFORE INSERT ON public.dm_reactions
  FOR EACH ROW EXECUTE FUNCTION public.reactions_guard();

/**
 * Unsending clears the reactions that were attached to the message, so the row
 * does not come back to life if the message is ever restored.
 */
CREATE OR REPLACE FUNCTION public.clear_reactions_on_unsend()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $clear$
BEGIN
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND NEW.deleted_at IS NOT NULL THEN
    IF TG_TABLE_NAME = 'direct_messages' THEN
      DELETE FROM public.dm_reactions WHERE message_id = NEW.id;
    ELSE
      DELETE FROM public.message_reactions
      WHERE message_id = NEW.id AND message_type = 'group';
    END IF;
  END IF;
  RETURN NEW;
END
$clear$;

REVOKE ALL ON FUNCTION public.clear_reactions_on_unsend() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS direct_messages_clear_reactions_t ON public.direct_messages;
CREATE TRIGGER direct_messages_clear_reactions_t
  AFTER UPDATE ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.clear_reactions_on_unsend();

DROP TRIGGER IF EXISTS group_messages_clear_reactions_t ON public.group_messages;
CREATE TRIGGER group_messages_clear_reactions_t
  AFTER UPDATE ON public.group_messages
  FOR EACH ROW EXECUTE FUNCTION public.clear_reactions_on_unsend();

NOTIFY pgrst, 'reload schema';
