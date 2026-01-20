-- =============================================
-- SISTEMA DE CARGOS SEGURO
-- =============================================

-- 1. Criar tabela user_roles separada
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role user_role NOT NULL DEFAULT 'attendant',
    created_at timestamptz DEFAULT now(),
    UNIQUE (user_id)
);

-- 2. Habilitar RLS na tabela user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Migrar cargos existentes da tabela profiles para user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, role FROM public.profiles WHERE user_id IS NOT NULL;

-- 4. Promover o primeiro usuário existente para admin (Kayke)
UPDATE public.user_roles 
SET role = 'admin' 
WHERE user_id = 'd010ffd2-433d-45f5-98bb-782d3f161f99';

-- 5. Atualizar função has_role para usar a nova tabela
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 6. Atualizar função get_user_role para usar a nova tabela
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- 7. Atualizar função is_admin para usar a nova tabela
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- 8. Atualizar função is_admin_or_moderator para usar a nova tabela
CREATE OR REPLACE FUNCTION public.is_admin_or_moderator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'broker')
  )
$$;

-- 9. Atualizar função can_manage_users para usar a nova tabela
CREATE OR REPLACE FUNCTION public.can_manage_users(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'broker')
  )
$$;

-- 10. Criar RLS policies para user_roles

-- Apenas admins podem ver todos os cargos
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()) OR user_id = auth.uid());

-- Apenas admins podem inserir cargos
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

-- Apenas admins podem atualizar cargos (mas não o próprio)
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()) AND user_id != auth.uid())
WITH CHECK (public.is_admin(auth.uid()) AND user_id != auth.uid());

-- Apenas admins podem deletar cargos (mas não o próprio)
CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()) AND user_id != auth.uid());

-- 11. Atualizar trigger handle_new_user para criar cargo 'attendant' automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Criar perfil
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  
  -- Criar cargo padrão (attendant)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'attendant');
  
  RETURN NEW;
END;
$$;