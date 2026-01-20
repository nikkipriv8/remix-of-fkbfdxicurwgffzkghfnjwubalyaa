-- Fix RLS: restrict profile visibility to self + admins/brokers
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins and brokers can view all profiles"
ON public.profiles
FOR SELECT
USING (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'broker'::public.user_role)
);

-- Fix RLS: ensure WhatsApp messages are selectable by staff
DROP POLICY IF EXISTS "Staff can view WhatsApp messages" ON public.whatsapp_messages;

CREATE POLICY "Staff can view WhatsApp messages"
ON public.whatsapp_messages
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'broker'::public.user_role)
    OR public.has_role(auth.uid(), 'attendant'::public.user_role)
  )
);
