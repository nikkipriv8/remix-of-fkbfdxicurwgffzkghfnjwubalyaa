-- Migration support tables for importing legacy data into the current project

-- 1) Runs
CREATE TABLE IF NOT EXISTS public.migration_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_by uuid NULL,
  status text NOT NULL DEFAULT 'created',
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb
);

-- 2) Staging tables (raw payload + old ids)
CREATE TABLE IF NOT EXISTS public.staging_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  old_profile_id uuid NULL,
  email text NOT NULL,
  full_name text NULL,
  phone text NULL,
  creci text NULL,
  role public.user_role NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.staging_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  old_property_id uuid NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.staging_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  old_lead_id uuid NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.staging_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  old_task_id uuid NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.staging_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  old_visit_id uuid NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- 3) Mapping tables (old -> new)
CREATE TABLE IF NOT EXISTS public.profile_id_map (
  old_profile_id uuid PRIMARY KEY,
  email text NOT NULL,
  new_profile_id uuid NOT NULL,
  new_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.property_id_map (
  old_property_id uuid PRIMARY KEY,
  new_property_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_id_map (
  old_lead_id uuid PRIMARY KEY,
  new_lead_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.visit_id_map (
  old_visit_id uuid PRIMARY KEY,
  new_visit_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_id_map (
  old_task_id uuid PRIMARY KEY,
  new_task_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4) Indexes
CREATE INDEX IF NOT EXISTS idx_staging_profiles_email ON public.staging_profiles (email);

-- 5) Enable RLS
ALTER TABLE public.migration_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staging_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staging_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staging_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staging_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staging_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_id_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_id_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_id_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_id_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_id_map ENABLE ROW LEVEL SECURITY;

-- 6) Policies (admin-only)
DO $$ BEGIN
  -- migration_runs
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='migration_runs' AND policyname='Admins can manage migration runs'
  ) THEN
    CREATE POLICY "Admins can manage migration runs"
    ON public.migration_runs
    FOR ALL
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  -- staging_* tables
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='staging_profiles' AND policyname='Admins can manage staging_profiles'
  ) THEN
    CREATE POLICY "Admins can manage staging_profiles"
    ON public.staging_profiles
    FOR ALL
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='staging_properties' AND policyname='Admins can manage staging_properties'
  ) THEN
    CREATE POLICY "Admins can manage staging_properties"
    ON public.staging_properties
    FOR ALL
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='staging_leads' AND policyname='Admins can manage staging_leads'
  ) THEN
    CREATE POLICY "Admins can manage staging_leads"
    ON public.staging_leads
    FOR ALL
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='staging_tasks' AND policyname='Admins can manage staging_tasks'
  ) THEN
    CREATE POLICY "Admins can manage staging_tasks"
    ON public.staging_tasks
    FOR ALL
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='staging_visits' AND policyname='Admins can manage staging_visits'
  ) THEN
    CREATE POLICY "Admins can manage staging_visits"
    ON public.staging_visits
    FOR ALL
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  -- maps
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profile_id_map' AND policyname='Admins can manage profile_id_map'
  ) THEN
    CREATE POLICY "Admins can manage profile_id_map"
    ON public.profile_id_map
    FOR ALL
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='property_id_map' AND policyname='Admins can manage property_id_map'
  ) THEN
    CREATE POLICY "Admins can manage property_id_map"
    ON public.property_id_map
    FOR ALL
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lead_id_map' AND policyname='Admins can manage lead_id_map'
  ) THEN
    CREATE POLICY "Admins can manage lead_id_map"
    ON public.lead_id_map
    FOR ALL
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='visit_id_map' AND policyname='Admins can manage visit_id_map'
  ) THEN
    CREATE POLICY "Admins can manage visit_id_map"
    ON public.visit_id_map
    FOR ALL
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_id_map' AND policyname='Admins can manage task_id_map'
  ) THEN
    CREATE POLICY "Admins can manage task_id_map"
    ON public.task_id_map
    FOR ALL
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;