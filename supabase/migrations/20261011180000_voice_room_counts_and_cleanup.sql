-- ============================================================
-- VOICE ROOMS: real listener counts + stale-room reaper
--
-- Problems fixed:
-- 1. voice_rooms.listener_count stayed 0 forever (nothing wrote to it),
--    so every card showed "0 listening".
-- 2. Rooms whose host left never ended: rows stayed is_live=true,
--    so dead rooms like the duplicate "Chill" cards stayed on /voice.
--
-- Approach:
-- - Trigger keeps listener_count in sync with voice_participants.
-- - SECURITY DEFINER RPC end_stale_voice_rooms() flips is_live=false
--   for live rooms with no host participant in the last N minutes,
--   and prunes orphaned participant rows of long-gone live rooms.
-- - Anonymous (anon) can call the reaper so even signed-out visitors
--   on /voice clean up; it only mutates rows that are already dead.
-- ============================================================

-- ---------- 1. listener_count sync trigger ----------
CREATE OR REPLACE FUNCTION public.sync_voice_room_listener_count()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_room_id uuid;
BEGIN
  v_room_id := COALESCE(NEW.room_id, OLD.room_id);

  UPDATE public.voice_rooms
  SET listener_count = (
    SELECT count(*) FROM public.voice_participants
    WHERE room_id = v_room_id AND role = 'listener'
  )
  WHERE id = v_room_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_voice_room_listeners_t ON public.voice_participants;
CREATE TRIGGER sync_voice_room_listeners_t
AFTER INSERT OR UPDATE OF role OR DELETE ON public.voice_participants
FOR EACH ROW EXECUTE FUNCTION public.sync_voice_room_listener_count();

-- One-time backfill so existing rooms showched real numbers.
UPDATE public.voice_rooms r
SET listener_count = COALESCE((
  SELECT count(*) FROM public.voice_participants p
  WHERE p.room_id = r.id AND p.role = 'listener'
), 0);

-- ---------- 2. Stale-room reaper RPC ----------
CREATE OR REPLACE FUNCTION public.end_stale_voice_rooms(_max_host_absence_minutes integer DEFAULT 10)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ended integer := 0;
BEGIN
  -- A live room is stale when its host has no participant row.
  WITH stale AS (
    UPDATE public.voice_rooms r
    SET is_live = false,
        ended_at = now()
    WHERE r.is_live = true
      AND r.created_at < now() - interval '1 minute'
      AND NOT EXISTS (
        SELECT 1 FROM public.voice_participants p
        WHERE p.room_id = r.id AND p.role = 'host'
      )
      AND r.started_at < now() - make_interval(mins => GREATEST(_max_host_absence_minutes, 1))
    RETURNING 1
  )
  SELECT count(*) INTO v_ended FROM stale;

  -- Prune participants of rooms that just ended (no dangling rows).
  DELETE FROM public.voice_participants p
  USING public.voice_rooms r
  WHERE p.room_id = r.id
    AND r.is_live = false;

  RETURN v_ended;
END;
$$;

REVOKE ALL ON FUNCTION public.end_stale_voice_rooms(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.end_stale_voice_rooms(integer) TO anon, authenticated;
