-- ============================================================
-- PHASE 3: Rooms inside each realm
-- realm_rooms: text/announcement/voice rooms scoped to a realm.
-- messages.realm_room_id: per-room message routing.
-- voice_rooms.realm_room_id: per-room voice staging.
-- ============================================================

-- ---------- 1. Table ----------
CREATE TABLE IF NOT EXISTS public.realm_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES public.realms(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'text'
    CHECK (kind IN ('text','announcement','voice')),
  topic text,
  position integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (realm_id, name)
);

CREATE INDEX IF NOT EXISTS idx_realm_rooms_realm
ON public.realm_rooms (realm_id, position);

-- Keep names sane (same limits the UI enforces).
ALTER TABLE public.realm_rooms
  ADD CONSTRAINT realm_rooms_name_len CHECK (char_length(name) BETWEEN 1 AND 40);
ALTER TABLE public.realm_rooms
  ADD CONSTRAINT realm_rooms_topic_len CHECK (char_length(topic) <= 160);

ALTER TABLE public.realm_rooms ENABLE ROW LEVEL SECURITY;

-- Members (of that realm) read; owners/mods write.
DROP POLICY IF EXISTS "realm rooms readable by members" ON public.realm_rooms;
CREATE POLICY "realm rooms readable by members"
ON public.realm_rooms FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.realms r
    WHERE r.id = realm_rooms.realm_id
      AND (r.is_public OR EXISTS (
        SELECT 1 FROM public.realm_members rm
        WHERE rm.realm_id = realm_rooms.realm_id AND rm.user_id = auth.uid()
      ))
  )
);

DROP POLICY IF EXISTS "realm rooms writable by mods" ON public.realm_rooms;
CREATE POLICY "realm rooms writable by mods"
ON public.realm_rooms FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.realms r
    WHERE r.id = realm_rooms.realm_id
      AND (
        r.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.realm_members rm
          WHERE rm.realm_id = realm_rooms.realm_id
            AND rm.user_id = auth.uid()
            AND rm.role IN ('owner','mod')
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.realms r
    WHERE r.id = realm_rooms.realm_id
      AND (
        r.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.realm_members rm
          WHERE rm.realm_id = realm_rooms.realm_id
            AND rm.user_id = auth.uid()
            AND rm.role IN ('owner','mod')
        )
      )
  )
);

-- ---------- 2. Messages room scoping ----------
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS realm_room_id uuid
  REFERENCES public.realm_rooms(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_messages_realm_room
ON public.messages (realm_room_id, created_at DESC);

-- ---------- 3. Voice rooms room scoping ----------
ALTER TABLE public.voice_rooms
  ADD COLUMN IF NOT EXISTS realm_room_id uuid
  REFERENCES public.realm_rooms(id) ON DELETE SET NULL;

-- ---------- 4. Trigger functions ----------
CREATE OR REPLACE FUNCTION public.add_default_realm_room()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.realm_rooms (realm_id, name, kind, position, is_default)
  VALUES (
    NEW.id,
    CASE NEW.kind WHEN 'voice' THEN 'General voice' ELSE 'general' END,
    CASE NEW.kind WHEN 'voice' THEN 'voice' ELSE 'text' END,
    0,
    true
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS add_default_room_t ON public.realms;
CREATE TRIGGER add_default_room_t AFTER INSERT ON public.realms
  FOR EACH ROW EXECUTE FUNCTION public.add_default_realm_room();

-- Backfill: give existing realms a default room if they have none.
INSERT INTO public.realm_rooms (realm_id, name, kind, position, is_default)
SELECT r.id,
       CASE r.kind WHEN 'voice' THEN 'General voice' ELSE 'general' END,
       CASE r.kind WHEN 'voice' THEN 'voice' ELSE 'text' END,
       0, true
FROM public.realms r
WHERE NOT EXISTS (
  SELECT 1 FROM public.realm_rooms rr WHERE rr.realm_id = r.id
);

-- ---------- 5. Realtime ----------
DO $pub$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'realm_rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.realm_rooms;
  END IF;
END;
$pub$;
