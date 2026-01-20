-- Add automation_enabled field to whatsapp_conversations
ALTER TABLE public.whatsapp_conversations
ADD COLUMN IF NOT EXISTS automation_enabled boolean NOT NULL DEFAULT true;

-- Add human_takeover_at to track when human took over
ALTER TABLE public.whatsapp_conversations
ADD COLUMN IF NOT EXISTS human_takeover_at timestamp with time zone DEFAULT NULL;

COMMENT ON COLUMN public.whatsapp_conversations.automation_enabled IS 'Whether AI automation is enabled for this conversation';
COMMENT ON COLUMN public.whatsapp_conversations.human_takeover_at IS 'Timestamp when human agent took over the conversation';