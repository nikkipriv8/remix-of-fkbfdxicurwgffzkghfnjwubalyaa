-- Tighten RLS to prevent public/over-broad access to sensitive CRM data

-- PROFILES: remove public SELECT and require authentication
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Moderators can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- LEADS: require authentication and restrict unassigned leads visibility
DROP POLICY IF EXISTS "View leads based on role" ON public.leads;
CREATE POLICY "View leads based on role"
ON public.leads
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    is_admin(auth.uid())
    OR has_role(auth.uid(), 'broker'::public.user_role)
    OR broker_id = get_user_profile_id(auth.uid())
  )
);

-- PROPERTIES: require authentication for SELECT
DROP POLICY IF EXISTS "Authenticated users can view properties" ON public.properties;
CREATE POLICY "Authenticated users can view properties"
ON public.properties
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- VISITS: require authentication + staff role for SELECT
DROP POLICY IF EXISTS "Authenticated users can view visits" ON public.visits;
CREATE POLICY "Staff can view visits"
ON public.visits
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    is_admin(auth.uid())
    OR has_role(auth.uid(), 'broker'::public.user_role)
    OR has_role(auth.uid(), 'attendant'::public.user_role)
  )
);

-- INTERACTIONS: restrict SELECT + INSERT to staff roles
DROP POLICY IF EXISTS "Authenticated users can view interactions" ON public.interactions;
CREATE POLICY "Staff can view interactions"
ON public.interactions
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    is_admin(auth.uid())
    OR has_role(auth.uid(), 'broker'::public.user_role)
    OR has_role(auth.uid(), 'attendant'::public.user_role)
  )
);

DROP POLICY IF EXISTS "Authenticated users can create interactions" ON public.interactions;
CREATE POLICY "Staff can create interactions"
ON public.interactions
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    is_admin(auth.uid())
    OR has_role(auth.uid(), 'broker'::public.user_role)
    OR has_role(auth.uid(), 'attendant'::public.user_role)
  )
);

-- WHATSAPP_CONVERSATIONS: restrict INSERT/UPDATE to staff roles (service role policy stays)
DROP POLICY IF EXISTS "Authenticated users can insert conversations" ON public.whatsapp_conversations;
CREATE POLICY "Staff can insert WhatsApp conversations"
ON public.whatsapp_conversations
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    is_admin(auth.uid())
    OR has_role(auth.uid(), 'broker'::public.user_role)
    OR has_role(auth.uid(), 'attendant'::public.user_role)
  )
);

DROP POLICY IF EXISTS "Authenticated users can update conversations" ON public.whatsapp_conversations;
CREATE POLICY "Staff can update WhatsApp conversations"
ON public.whatsapp_conversations
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND (
    is_admin(auth.uid())
    OR has_role(auth.uid(), 'broker'::public.user_role)
    OR has_role(auth.uid(), 'attendant'::public.user_role)
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    is_admin(auth.uid())
    OR has_role(auth.uid(), 'broker'::public.user_role)
    OR has_role(auth.uid(), 'attendant'::public.user_role)
  )
);

-- WHATSAPP_MESSAGES: remove permissive SELECT and restrict INSERT/UPDATE to staff roles
DROP POLICY IF EXISTS "Authenticated users can view messages" ON public.whatsapp_messages;

DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.whatsapp_messages;
CREATE POLICY "Staff can insert WhatsApp messages"
ON public.whatsapp_messages
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    is_admin(auth.uid())
    OR has_role(auth.uid(), 'broker'::public.user_role)
    OR has_role(auth.uid(), 'attendant'::public.user_role)
  )
);

DROP POLICY IF EXISTS "Authenticated users can update messages" ON public.whatsapp_messages;
CREATE POLICY "Staff can update WhatsApp messages"
ON public.whatsapp_messages
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND (
    is_admin(auth.uid())
    OR has_role(auth.uid(), 'broker'::public.user_role)
    OR has_role(auth.uid(), 'attendant'::public.user_role)
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    is_admin(auth.uid())
    OR has_role(auth.uid(), 'broker'::public.user_role)
    OR has_role(auth.uid(), 'attendant'::public.user_role)
  )
);
