-- Step 1: Remove duplicate leads keeping only the most recent one for each phone
-- First, update whatsapp_conversations to point to the most recent lead
WITH latest_leads AS (
  SELECT DISTINCT ON (phone) id, phone
  FROM leads
  ORDER BY phone, created_at DESC
),
duplicate_leads AS (
  SELECT l.id, ll.id as keep_id
  FROM leads l
  JOIN latest_leads ll ON l.phone = ll.phone
  WHERE l.id != ll.id
)
UPDATE whatsapp_conversations wc
SET lead_id = dl.keep_id
FROM duplicate_leads dl
WHERE wc.lead_id = dl.id;

-- Step 2: Delete duplicate leads (keeping only the most recent)
DELETE FROM leads
WHERE id NOT IN (
  SELECT DISTINCT ON (phone) id
  FROM leads
  ORDER BY phone, created_at DESC
);

-- Step 3: Add unique constraint on phone field to prevent future duplicates
ALTER TABLE public.leads ADD CONSTRAINT leads_phone_unique UNIQUE (phone);

-- Step 4: Fix the infinite recursion in profiles RLS policy
-- Drop the problematic policy that causes recursion
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- Recreate using the is_admin() function which doesn't cause recursion
CREATE POLICY "Admins can manage all profiles"
ON public.profiles
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Step 5: Fix tasks RLS policy that also has recursion issue
DROP POLICY IF EXISTS "Admins can view all tasks" ON public.tasks;

CREATE POLICY "Admins can view all tasks"
ON public.tasks
FOR SELECT
USING (public.is_admin(auth.uid()));