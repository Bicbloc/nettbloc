-- Supprimer l'ancienne fonction et recréer une version simplifiée
DROP FUNCTION IF EXISTS public.complete_onboarding(uuid, text, text, text, text, text, text);

-- Fonction ultra-simplifiée pour l'onboarding
CREATE OR REPLACE FUNCTION public.complete_onboarding_simple(
  p_user_id uuid,
  p_company_name text,
  p_contact_name text,
  p_phone text
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trial_end TIMESTAMP WITH TIME ZONE;
BEGIN
  v_trial_end := NOW() + INTERVAL '3 months';
  
  -- Upsert le profil - INSERT si n'existe pas, UPDATE sinon
  INSERT INTO public.profiles (
    id, 
    billing_company_name,
    billing_contact_name,
    billing_phone,
    onboarding_completed_at,
    trial_start_date,
    trial_end_date,
    trial_duration_months,
    subscription_status,
    subscription_type,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    p_company_name,
    p_contact_name,
    p_phone,
    NOW(),
    NOW(),
    v_trial_end,
    3,
    'trial',
    'trial',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    billing_company_name = EXCLUDED.billing_company_name,
    billing_contact_name = EXCLUDED.billing_contact_name,
    billing_phone = EXCLUDED.billing_phone,
    onboarding_completed_at = EXCLUDED.onboarding_completed_at,
    trial_start_date = EXCLUDED.trial_start_date,
    trial_end_date = EXCLUDED.trial_end_date,
    trial_duration_months = EXCLUDED.trial_duration_months,
    subscription_status = EXCLUDED.subscription_status,
    subscription_type = EXCLUDED.subscription_type,
    updated_at = NOW();
  
  RETURN TRUE;
END;
$$;

-- Accorder les permissions
GRANT EXECUTE ON FUNCTION public.complete_onboarding_simple(uuid, text, text, text) TO authenticated;