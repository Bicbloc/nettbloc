-- Fonction SECURITY DEFINER pour démarrer la période d'essai
-- Cette fonction contourne les problèmes RLS en s'exécutant avec les privilèges du propriétaire
DROP FUNCTION IF EXISTS public.start_trial_period(uuid);

CREATE OR REPLACE FUNCTION public.start_trial_period(p_user_id uuid)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trial_end TIMESTAMP WITH TIME ZONE;
  v_profile_exists BOOLEAN;
BEGIN
  -- Vérifier si le profil existe
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = p_user_id) INTO v_profile_exists;
  
  -- Si le profil n'existe pas, le créer
  IF NOT v_profile_exists THEN
    INSERT INTO public.profiles (id, created_at, updated_at)
    VALUES (p_user_id, NOW(), NOW());
  END IF;

  v_trial_end := NOW() + INTERVAL '3 months';
  
  UPDATE public.profiles
  SET 
    trial_start_date = NOW(),
    trial_end_date = v_trial_end,
    trial_duration_months = 3,
    subscription_status = 'trial',
    subscription_type = 'trial',
    updated_at = NOW()
  WHERE id = p_user_id;
  
  RETURN v_trial_end;
END;
$$;

-- Fonction SECURITY DEFINER pour sauvegarder les infos d'onboarding
CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_user_id uuid,
  p_company_name text DEFAULT NULL,
  p_contact_name text DEFAULT NULL,
  p_contact_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_siret text DEFAULT NULL,
  p_tva_number text DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_exists BOOLEAN;
  v_trial_end TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Vérifier si le profil existe
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = p_user_id) INTO v_profile_exists;
  
  -- Si le profil n'existe pas, le créer d'abord
  IF NOT v_profile_exists THEN
    INSERT INTO public.profiles (id, created_at, updated_at)
    VALUES (p_user_id, NOW(), NOW());
  END IF;
  
  v_trial_end := NOW() + INTERVAL '3 months';
  
  -- Mettre à jour le profil avec toutes les infos
  UPDATE public.profiles
  SET 
    billing_company_name = COALESCE(p_company_name, billing_company_name),
    billing_contact_name = COALESCE(p_contact_name, billing_contact_name),
    billing_contact_email = COALESCE(p_contact_email, billing_contact_email),
    billing_phone = COALESCE(p_phone, billing_phone),
    siret = COALESCE(p_siret, siret),
    billing_tva_number = COALESCE(p_tva_number, billing_tva_number),
    onboarding_completed_at = NOW(),
    trial_start_date = NOW(),
    trial_end_date = v_trial_end,
    trial_duration_months = 3,
    subscription_status = 'trial',
    subscription_type = 'trial',
    updated_at = NOW()
  WHERE id = p_user_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in complete_onboarding: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- Accorder les permissions d'exécution
GRANT EXECUTE ON FUNCTION public.start_trial_period(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(uuid, text, text, text, text, text, text) TO authenticated;