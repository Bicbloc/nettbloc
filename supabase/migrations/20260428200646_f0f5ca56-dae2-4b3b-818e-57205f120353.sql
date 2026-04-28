-- 1) Colonne d'activation des fonctionnalités IA par client
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_features_enabled boolean NOT NULL DEFAULT true;

-- 2) Fonction RPC : seuls les super_admin peuvent basculer l'IA d'un client
CREATE OR REPLACE FUNCTION public.admin_set_ai_features_enabled(
  p_user_id uuid,
  p_enabled boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Seuls les super administrateurs peuvent modifier ce paramètre';
  END IF;

  UPDATE public.profiles
     SET ai_features_enabled = p_enabled,
         updated_at = now()
   WHERE id = p_user_id;

  PERFORM public.log_admin_action(
    'set_ai_features_enabled',
    p_user_id,
    jsonb_build_object('enabled', p_enabled)
  );

  RETURN true;
END;
$$;