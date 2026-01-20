-- Create helper functions for role-based permissions
-- Note: We keep roles in profiles table for simplicity, but use security definer functions

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Function to check if user is admin or moderator (broker)
CREATE OR REPLACE FUNCTION public.is_admin_or_moderator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND role IN ('admin', 'broker')
  )
$$;

-- Function to check if user can manage other users (only admins and moderators)
CREATE OR REPLACE FUNCTION public.can_manage_users(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND role IN ('admin', 'broker')
  )
$$;

-- Update leads RLS to allow moderators to see all leads and attendants only their assigned leads
DROP POLICY IF EXISTS "Users can view assigned or unassigned leads" ON public.leads;
CREATE POLICY "View leads based on role"
ON public.leads
FOR SELECT
USING (
  public.is_admin(auth.uid()) 
  OR public.has_role(auth.uid(), 'broker')
  OR broker_id IS NULL 
  OR broker_id = public.get_user_profile_id(auth.uid())
);

-- Update leads RLS for modifications - moderators can update any lead, attendants only their assigned
DROP POLICY IF EXISTS "Users can update assigned leads" ON public.leads;
CREATE POLICY "Update leads based on role"
ON public.leads
FOR UPDATE
USING (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'broker')
  OR broker_id = public.get_user_profile_id(auth.uid())
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'broker')
  OR broker_id = public.get_user_profile_id(auth.uid())
);

-- Update leads delete policy
DROP POLICY IF EXISTS "Users can delete assigned leads" ON public.leads;
CREATE POLICY "Delete leads based on role"
ON public.leads
FOR DELETE
USING (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'broker')
  OR broker_id = public.get_user_profile_id(auth.uid())
);

-- Update profiles policy - admins can manage all, moderators can view all, attendants only view
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles"
ON public.profiles
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Moderators (brokers) can view all profiles but only edit their own
CREATE POLICY "Moderators can view all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'broker') OR public.has_role(auth.uid(), 'attendant'));