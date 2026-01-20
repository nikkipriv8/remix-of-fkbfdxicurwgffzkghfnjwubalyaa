-- Create a security definer function to check user's profile id
CREATE OR REPLACE FUNCTION public.get_user_profile_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Create a security definer function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- Drop existing overly permissive policies on leads
DROP POLICY IF EXISTS "Authenticated users can manage leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can view all leads" ON public.leads;

-- Create proper RLS policies for leads table
-- Admins can do everything
CREATE POLICY "Admins can manage all leads"
ON public.leads
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Brokers can view leads assigned to them OR unassigned leads (for initial assignment)
CREATE POLICY "Users can view assigned or unassigned leads"
ON public.leads
FOR SELECT
TO authenticated
USING (
  broker_id IS NULL 
  OR broker_id = public.get_user_profile_id(auth.uid())
);

-- Brokers can create leads (will be assigned to them or left unassigned)
CREATE POLICY "Users can create leads"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (
  broker_id IS NULL 
  OR broker_id = public.get_user_profile_id(auth.uid())
);

-- Brokers can update only their assigned leads
CREATE POLICY "Users can update assigned leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (broker_id = public.get_user_profile_id(auth.uid()))
WITH CHECK (broker_id = public.get_user_profile_id(auth.uid()));

-- Brokers can delete only their assigned leads
CREATE POLICY "Users can delete assigned leads"
ON public.leads
FOR DELETE
TO authenticated
USING (broker_id = public.get_user_profile_id(auth.uid()));