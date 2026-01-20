-- Add missing SELECT policies for WhatsApp tables so the app can load conversations/messages

-- Conversations
DROP POLICY IF EXISTS "Staff can view WhatsApp conversations" ON public.whatsapp_conversations;
CREATE POLICY "Staff can view WhatsApp conversations"
ON public.whatsapp_conversations
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    is_admin(auth.uid())
    OR has_role(auth.uid(), 'broker'::public.user_role)
    OR has_role(auth.uid(), 'attendant'::public.user_role)
  )
);

-- Messages
DROP POLICY IF EXISTS "Staff can view WhatsApp messages" ON public.whatsapp_messages;
CREATE POLICY "Staff can view WhatsApp messages"
ON public.whatsapp_messages
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    is_admin(auth.uid())
    OR has_role(auth.uid(), 'broker'::public.user_role)
    OR has_role(auth.uid(), 'attendant'::public.user_role)
  )
);
