-- ============================================================
-- PHASE 4: screen sharing, opt-in.
--
-- The media itself never passes through the database: the peer connections
-- already negotiate a second, always-present video transceiver, so sharing a
-- screen is a track swap on both ends. This column is only the roster flag that
-- tells everyone else "there is something to look at", and it flips through the
-- existing "update your own participant row" policy.
-- ============================================================

ALTER TABLE public.voice_participants
  ADD COLUMN IF NOT EXISTS sharing_screen boolean NOT NULL DEFAULT false;
