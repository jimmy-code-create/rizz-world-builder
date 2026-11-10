-- Edit your own direct messages.
--
-- The original policy only let the recipient update a DM (to mark it read), so
-- the sender's edit request was rejected by RLS. This permissive policy is
-- additive; the recipient's read policy remains in place.

DROP POLICY IF EXISTS "sender edits own direct message" ON public.direct_messages;
CREATE POLICY "sender edits own direct message"
  ON public.direct_messages
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);
