-- Add optional avatar for leads (profile photo)
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Track last read per user per conversation (for unread counts like WhatsApp)
CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_reads (
  user_id UUID NOT NULL,
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_id)
);

ALTER TABLE public.whatsapp_conversation_reads ENABLE ROW LEVEL SECURITY;

-- Policies: each user can manage only their own read state
DROP POLICY IF EXISTS "Users can view their own conversation read state" ON public.whatsapp_conversation_reads;
CREATE POLICY "Users can view their own conversation read state"
ON public.whatsapp_conversation_reads
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own conversation read state" ON public.whatsapp_conversation_reads;
CREATE POLICY "Users can insert their own conversation read state"
ON public.whatsapp_conversation_reads
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own conversation read state" ON public.whatsapp_conversation_reads;
CREATE POLICY "Users can update their own conversation read state"
ON public.whatsapp_conversation_reads
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Timestamp trigger
DROP TRIGGER IF EXISTS update_whatsapp_conversation_reads_updated_at ON public.whatsapp_conversation_reads;
CREATE TRIGGER update_whatsapp_conversation_reads_updated_at
BEFORE UPDATE ON public.whatsapp_conversation_reads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Mark a conversation as read (called by the app when user opens the chat)
CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.whatsapp_conversation_reads (user_id, conversation_id, last_read_at)
  VALUES (auth.uid(), _conversation_id, now())
  ON CONFLICT (user_id, conversation_id)
  DO UPDATE SET last_read_at = EXCLUDED.last_read_at, updated_at = now();
END;
$$;

-- Get unread counts for a batch of conversations
CREATE OR REPLACE FUNCTION public.get_unread_counts(conversation_ids UUID[])
RETURNS TABLE (conversation_id UUID, unread_count INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    c.id AS conversation_id,
    COALESCE(
      COUNT(m.id) FILTER (
        WHERE m.direction = 'inbound'
          AND m.created_at > COALESCE(r.last_read_at, '1970-01-01'::timestamptz)
      ),
      0
    )::int AS unread_count
  FROM public.whatsapp_conversations c
  LEFT JOIN public.whatsapp_conversation_reads r
    ON r.conversation_id = c.id
   AND r.user_id = auth.uid()
  LEFT JOIN public.whatsapp_messages m
    ON m.conversation_id = c.id
  WHERE c.id = ANY(conversation_ids)
  GROUP BY c.id, r.last_read_at;
$$;