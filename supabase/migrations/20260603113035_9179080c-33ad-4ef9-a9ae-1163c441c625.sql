-- 1. Per-plan trial duration in days
ALTER TABLE public.pricing_config
  ADD COLUMN IF NOT EXISTS trial_days integer NOT NULL DEFAULT 30;

UPDATE public.pricing_config SET trial_days = 30 WHERE trial_days IS NULL;

-- 2. Global app settings table (key/value)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT SELECT ON public.app_settings TO anon;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "App settings readable by everyone" ON public.app_settings;
CREATE POLICY "App settings readable by everyone"
ON public.app_settings
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Super admins manage app settings" ON public.app_settings;
CREATE POLICY "Super admins manage app settings"
ON public.app_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Seed default trial days = 30
INSERT INTO public.app_settings (key, value)
VALUES ('default_trial_days', '30'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 3. RPC for super admins to set the default trial days
CREATE OR REPLACE FUNCTION public.set_default_trial_days(p_days integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Seuls les super administrateurs peuvent modifier ce paramètre';
  END IF;

  IF p_days IS NULL OR p_days < 0 THEN
    RAISE EXCEPTION 'La durée d''essai doit être un nombre positif';
  END IF;

  INSERT INTO public.app_settings (key, value, updated_at, updated_by)
  VALUES ('default_trial_days', to_jsonb(p_days), now(), auth.uid())
  ON CONFLICT (key) DO UPDATE SET
    value = to_jsonb(p_days),
    updated_at = now(),
    updated_by = auth.uid();

  PERFORM public.log_admin_action(
    'set_default_trial_days',
    NULL,
    jsonb_build_object('days', p_days)
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_default_trial_days(integer) TO authenticated;

-- 4. Update onboarding to use configurable default trial days (fallback 30)
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
  v_trial_days integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_email := COALESCE(
    auth.jwt() ->> 'email',
    (auth.jwt() -> 'user_metadata' ->> 'email')
  );

  IF v_email IS NULL OR length(trim(v_email)) = 0 THEN
    RAISE EXCEPTION 'email missing from token';
  END IF;

  -- Read configurable default trial days, fallback 30
  SELECT COALESCE((value)::text::integer, 30) INTO v_trial_days
  FROM public.app_settings
  WHERE key = 'default_trial_days';

  IF v_trial_days IS NULL OR v_trial_days < 0 THEN
    v_trial_days := 30;
  END IF;

  v_trial_end := now() + (v_trial_days || ' days')::interval;

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
    0,
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