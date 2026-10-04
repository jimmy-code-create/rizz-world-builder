-- Allow a sender to permanently delete only their own direct messages.
GRANT DELETE ON TABLE public.direct_messages TO authenticated;

-- Remove direct-message reactions along with the message they belong to.
ALTER TABLE public.dm_reactions
  ADD CONSTRAINT dm_reactions_message_id_fkey
  FOREIGN KEY (message_id)
  REFERENCES public.direct_messages(id)
  ON DELETE CASCADE
  NOT VALID;

DROP POLICY IF EXISTS "senders delete own direct messages" ON public.direct_messages;
CREATE POLICY "senders delete own direct messages"
  ON public.direct_messages
  FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);