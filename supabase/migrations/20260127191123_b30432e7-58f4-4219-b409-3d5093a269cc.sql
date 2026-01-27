-- =============================================
-- SYSTÈME DE SOUS-COMPTES ET PERMISSIONS
-- =============================================

-- Table des sous-comptes (utilisateurs liés à un compte principal)
CREATE TABLE public.sub_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role_name TEXT DEFAULT 'staff', -- 'manager', 'receptionist', 'supervisor', 'staff'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(parent_user_id, email)
);

-- Table des permissions granulaires par sous-compte
CREATE TABLE public.sub_account_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id UUID NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL, -- Ex: 'rooms.import', 'linen.add_types', 'ai.training'
  is_allowed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sub_account_id, permission_key)
);

-- Table des templates de rôles avec permissions par défaut
CREATE TABLE public.permission_role_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  default_permissions JSONB DEFAULT '[]'::jsonb, -- Liste des permission_key autorisées
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default role templates
INSERT INTO public.permission_role_templates (role_name, display_name, description, default_permissions, is_system) VALUES
('manager', 'Manager', 'Accès complet à toutes les fonctionnalités', 
 '["rooms.view", "rooms.import", "rooms.edit", "rooms.delete", "linen.view", "linen.add_types", "linen.scan", "ai.training", "ai.rules", "reports.view", "reports.export", "staff.view", "staff.manage", "incidents.view", "incidents.manage", "incidents.add_items"]'::jsonb, true),
 
('supervisor', 'Superviseur', 'Supervision des opérations quotidiennes',
 '["rooms.view", "rooms.edit", "linen.view", "linen.scan", "reports.view", "staff.view", "incidents.view", "incidents.manage"]'::jsonb, true),
 
('receptionist', 'Réceptionniste', 'Gestion des chambres et rapports',
 '["rooms.view", "rooms.import", "rooms.edit", "reports.view", "incidents.view"]'::jsonb, true),
 
('staff', 'Personnel', 'Accès en lecture seule',
 '["rooms.view", "linen.view", "reports.view", "incidents.view"]'::jsonb, true);

-- Modifier la table daily_action_logs pour inclure l'info du sous-compte
ALTER TABLE public.daily_action_logs 
  ADD COLUMN IF NOT EXISTS sub_account_id UUID REFERENCES public.sub_accounts(id),
  ADD COLUMN IF NOT EXISTS sub_account_name TEXT;

-- Modifier la table activities pour inclure l'info du sous-compte  
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS sub_account_id UUID REFERENCES public.sub_accounts(id),
  ADD COLUMN IF NOT EXISTS sub_account_name TEXT;

-- Enable RLS
ALTER TABLE public.sub_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_account_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_role_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies pour sub_accounts
CREATE POLICY "Users can view their own sub-accounts"
  ON public.sub_accounts FOR SELECT
  USING (parent_user_id = auth.uid());

CREATE POLICY "Users can create sub-accounts"
  ON public.sub_accounts FOR INSERT
  WITH CHECK (parent_user_id = auth.uid());

CREATE POLICY "Users can update their sub-accounts"
  ON public.sub_accounts FOR UPDATE
  USING (parent_user_id = auth.uid());

CREATE POLICY "Users can delete their sub-accounts"
  ON public.sub_accounts FOR DELETE
  USING (parent_user_id = auth.uid());

-- RLS Policies pour permissions
CREATE POLICY "Users can view permissions of their sub-accounts"
  ON public.sub_account_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sub_accounts sa 
      WHERE sa.id = sub_account_id AND sa.parent_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage permissions of their sub-accounts"
  ON public.sub_account_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.sub_accounts sa 
      WHERE sa.id = sub_account_id AND sa.parent_user_id = auth.uid()
    )
  );

-- RLS Policy pour templates (lecture publique)
CREATE POLICY "Anyone can view role templates"
  ON public.permission_role_templates FOR SELECT
  USING (true);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION public.update_sub_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_sub_accounts_updated_at
  BEFORE UPDATE ON public.sub_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_sub_accounts_updated_at();

-- Fonction pour vérifier si un sous-compte a une permission
CREATE OR REPLACE FUNCTION public.sub_account_has_permission(
  p_sub_account_id UUID,
  p_permission_key TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_permission BOOLEAN;
BEGIN
  -- Check explicit permission
  SELECT is_allowed INTO v_has_permission
  FROM public.sub_account_permissions
  WHERE sub_account_id = p_sub_account_id 
    AND permission_key = p_permission_key;
  
  IF v_has_permission IS NOT NULL THEN
    RETURN v_has_permission;
  END IF;
  
  -- Check role default permissions
  SELECT EXISTS (
    SELECT 1 
    FROM public.sub_accounts sa
    JOIN public.permission_role_templates prt ON prt.role_name = sa.role_name
    WHERE sa.id = p_sub_account_id
      AND prt.default_permissions ? p_permission_key
  ) INTO v_has_permission;
  
  RETURN COALESCE(v_has_permission, false);
END;
$$;

-- Ajouter colonne import_mode aux hotels pour le switch IA/Manuel
ALTER TABLE public.hotels
  ADD COLUMN IF NOT EXISTS import_mode TEXT DEFAULT 'auto' CHECK (import_mode IN ('auto', 'manual'));

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_sub_accounts_parent ON public.sub_accounts(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_sub_account_permissions_account ON public.sub_account_permissions(sub_account_id);
CREATE INDEX IF NOT EXISTS idx_daily_action_logs_sub_account ON public.daily_action_logs(sub_account_id);
CREATE INDEX IF NOT EXISTS idx_activities_sub_account ON public.activities(sub_account_id);