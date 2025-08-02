-- Attribution du rôle super_admin pour l'utilisateur actuel
INSERT INTO public.user_roles (user_id, role) 
VALUES ('6f0b2a40-afe8-4a61-96c5-63435877e6e6', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Ajouter une colonne pour suspendre les comptes
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;

-- Table pour l'audit des actions admin
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id uuid NOT NULL,
  action text NOT NULL,
  target_user_id uuid,
  details jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy pour que seuls les super admins puissent voir les logs d'audit
CREATE POLICY "Super admins can view audit logs" 
ON public.admin_audit_log 
FOR SELECT 
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Policy pour que seuls les super admins puissent créer des logs d'audit
CREATE POLICY "Super admins can create audit logs" 
ON public.admin_audit_log 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Fonction pour logger les actions admin
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action text,
  p_target_user_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.admin_audit_log (admin_user_id, action, target_user_id, details)
  VALUES (auth.uid(), p_action, p_target_user_id, p_details);
END;
$$;