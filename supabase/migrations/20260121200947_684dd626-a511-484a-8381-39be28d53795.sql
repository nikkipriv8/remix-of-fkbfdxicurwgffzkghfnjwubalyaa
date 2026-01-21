ALTER TABLE public.whatsapp_messages
ADD COLUMN IF NOT EXISTS transcription text,
ADD COLUMN IF NOT EXISTS transcription_status text,
ADD COLUMN IF NOT EXISTS transcription_error text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_transcription_status
ON public.whatsapp_messages (transcription_status);