-- Add INSERT policy for whatsapp_messages
CREATE POLICY "Authenticated users can insert messages"
ON public.whatsapp_messages
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add UPDATE policy for whatsapp_messages
CREATE POLICY "Authenticated users can update messages"
ON public.whatsapp_messages
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Add INSERT policy for whatsapp_conversations
CREATE POLICY "Authenticated users can insert conversations"
ON public.whatsapp_conversations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add UPDATE policy for whatsapp_conversations
CREATE POLICY "Authenticated users can update conversations"
ON public.whatsapp_conversations
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);