-- Tighten permissive RLS policies flagged by linter (remove USING/WITH CHECK true)

-- interactions
DROP POLICY IF EXISTS "Authenticated users can create interactions" ON public.interactions;
CREATE POLICY "Authenticated users can create interactions"
ON public.interactions
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- properties
DROP POLICY IF EXISTS "Authenticated users can manage properties" ON public.properties;
CREATE POLICY "Staff can manage properties"
ON public.properties
FOR ALL
USING (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'broker'::public.user_role)
  OR (
    public.has_role(auth.uid(), 'attendant'::public.user_role)
    AND (broker_id IS NULL OR broker_id = public.get_user_profile_id(auth.uid()))
  )
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'broker'::public.user_role)
  OR (
    public.has_role(auth.uid(), 'attendant'::public.user_role)
    AND (broker_id IS NULL OR broker_id = public.get_user_profile_id(auth.uid()))
  )
);

-- visits
DROP POLICY IF EXISTS "Authenticated users can manage visits" ON public.visits;
CREATE POLICY "Staff can manage visits"
ON public.visits
FOR ALL
USING (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'broker'::public.user_role)
  OR public.has_role(auth.uid(), 'attendant'::public.user_role)
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'broker'::public.user_role)
  OR public.has_role(auth.uid(), 'attendant'::public.user_role)
);

-- whatsapp_conversations
DROP POLICY IF EXISTS "Authenticated users can insert conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Authenticated users can update conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Service role can manage conversations" ON public.whatsapp_conversations;

CREATE POLICY "Authenticated users can insert conversations"
ON public.whatsapp_conversations
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update conversations"
ON public.whatsapp_conversations
FOR UPDATE
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can manage conversations"
ON public.whatsapp_conversations
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- whatsapp_messages
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Authenticated users can update messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Service role can manage messages" ON public.whatsapp_messages;

CREATE POLICY "Authenticated users can insert messages"
ON public.whatsapp_messages
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update messages"
ON public.whatsapp_messages
FOR UPDATE
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can manage messages"
ON public.whatsapp_messages
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
