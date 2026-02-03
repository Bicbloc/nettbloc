-- Fix onboarding RPC: profiles.email is NOT NULL, so we must populate it.
-- Also secure the SECURITY DEFINER function to prevent acting on other users.

CREATE OR REPLACE FUNCTION public.complete_onboarding_simple(
  p_user_id uuid,
  p_company_name text,
  p_contact_name text,
  p_phone text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trial_end timestamptz;
  v_email text;
BEGIN
  -- Security: only allow the authenticated user to complete their own onboarding
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Get email from JWT claims (avoids selecting from auth.users)
  v_email := COALESCE(
    auth.jwt() ->> 'email',
    (auth.jwt() -> 'user_metadata' ->> 'email')
  );

  IF v_email IS NULL OR length(trim(v_email)) = 0 THEN
    RAISE EXCEPTION 'email missing from token';
  END IF;

  v_trial_end := now() + interval '3 months';

  INSERT INTO public.profiles (
    id,
    email,
    company_name,
    billing_company_name,
    billing_contact_name,
    billing_phone,
    onboarding_completed_at,
    trial_start_date,
    trial_end_date,
    trial_duration_months,
    subscription_status,
    subscription_type
  )
  VALUES (
    p_user_id,
    v_email,
    p_company_name,
    p_company_name,
    p_contact_name,
    p_phone,
    now(),
    now(),
    v_trial_end,
    3,
    'trial',
    'trial'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    company_name = EXCLUDED.company_name,
    billing_company_name = EXCLUDED.billing_company_name,
    billing_contact_name = EXCLUDED.billing_contact_name,
    billing_phone = EXCLUDED.billing_phone,
    onboarding_completed_at = EXCLUDED.onboarding_completed_at,
    trial_start_date = EXCLUDED.trial_start_date,
    trial_end_date = EXCLUDED.trial_end_date,
    trial_duration_months = EXCLUDED.trial_duration_months,
    subscription_status = EXCLUDED.subscription_status,
    subscription_type = EXCLUDED.subscription_type,
    updated_at = now();

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_onboarding_simple(uuid, text, text, text) TO authenticated;
