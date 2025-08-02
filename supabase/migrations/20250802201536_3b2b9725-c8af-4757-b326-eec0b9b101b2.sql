-- Corriger les rôles super admin - seul operations@bicbloc.eu doit être super admin
DELETE FROM public.user_roles 
WHERE role = 'super_admin' 
AND user_id IN (
  SELECT id FROM auth.users WHERE email != 'operations@bicbloc.eu'
);

-- S'assurer que operations@bicbloc.eu a le rôle super admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::app_role 
FROM auth.users 
WHERE email = 'operations@bicbloc.eu'
ON CONFLICT (user_id, role) DO NOTHING;

-- Ajouter une colonne pour gérer les périodes d'essai étendues
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS trial_extension_days integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS trial_extension_granted_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS trial_extension_granted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS trial_extension_reason text;

-- Fonction pour étendre la période d'essai
CREATE OR REPLACE FUNCTION public.extend_trial_period(
  p_user_id uuid,
  p_extension_days integer,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_trial_end timestamp with time zone;
  new_trial_end timestamp with time zone;
BEGIN
  -- Vérifier que seul un super admin peut faire cela
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Seuls les super administrateurs peuvent étendre les périodes d''essai';
  END IF;

  -- Récupérer la date de fin d'essai actuelle
  SELECT trial_end_date INTO current_trial_end
  FROM public.profiles 
  WHERE id = p_user_id;

  -- Calculer la nouvelle date de fin
  IF current_trial_end IS NULL OR current_trial_end < now() THEN
    -- Si pas de période d'essai ou expirée, commencer depuis maintenant
    new_trial_end := now() + (p_extension_days || ' days')::interval;
  ELSE
    -- Sinon, étendre depuis la date de fin actuelle
    new_trial_end := current_trial_end + (p_extension_days || ' days')::interval;
  END IF;

  -- Mettre à jour le profil
  UPDATE public.profiles 
  SET 
    trial_end_date = new_trial_end,
    trial_extension_days = trial_extension_days + p_extension_days,
    trial_extension_granted_by = auth.uid(),
    trial_extension_granted_at = now(),
    trial_extension_reason = p_reason,
    subscription_type = 'trial'
  WHERE id = p_user_id;

  -- Logger l'action
  PERFORM public.log_admin_action(
    'extend_trial',
    p_user_id,
    jsonb_build_object(
      'extension_days', p_extension_days,
      'new_trial_end', new_trial_end,
      'reason', p_reason
    )
  );

  RETURN true;
END;
$$;

-- Fonction pour changer le statut d'abonnement
CREATE OR REPLACE FUNCTION public.change_subscription_status(
  p_user_id uuid,
  p_new_status text,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Vérifier que seul un super admin peut faire cela
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Seuls les super administrateurs peuvent changer les statuts d''abonnement';
  END IF;

  -- Valider le statut
  IF p_new_status NOT IN ('free', 'trial', 'premium') THEN
    RAISE EXCEPTION 'Statut invalide: %', p_new_status;
  END IF;

  -- Mettre à jour le profil
  UPDATE public.profiles 
  SET 
    subscription_type = p_new_status,
    updated_at = now()
  WHERE id = p_user_id;

  -- Si changement vers gratuit, supprimer la date de fin d'essai
  IF p_new_status = 'free' THEN
    UPDATE public.profiles 
    SET trial_end_date = NULL
    WHERE id = p_user_id;
  END IF;

  -- Logger l'action
  PERFORM public.log_admin_action(
    'change_subscription',
    p_user_id,
    jsonb_build_object(
      'new_status', p_new_status,
      'reason', p_reason
    )
  );

  RETURN true;
END;
$$;