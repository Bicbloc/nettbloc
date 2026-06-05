
-- 1. History table for hotel name changes
CREATE TABLE public.hotel_name_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  old_name text,
  new_name text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.hotel_name_history TO authenticated;
GRANT ALL ON public.hotel_name_history TO service_role;

ALTER TABLE public.hotel_name_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View hotel name history"
ON public.hotel_name_history
FOR SELECT
TO authenticated
USING (public.can_manage_hotel_data(hotel_id));

CREATE INDEX idx_hotel_name_history_hotel_id ON public.hotel_name_history(hotel_id, created_at DESC);

-- 2. Trigger that records the previous name whenever a hotel name changes
CREATE OR REPLACE FUNCTION public.record_hotel_name_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.name IS DISTINCT FROM OLD.name THEN
    INSERT INTO public.hotel_name_history (hotel_id, old_name, new_name, changed_by)
    VALUES (OLD.id, OLD.name, NEW.name, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_hotel_name_change ON public.hotels;
CREATE TRIGGER trg_record_hotel_name_change
AFTER UPDATE ON public.hotels
FOR EACH ROW
EXECUTE FUNCTION public.record_hotel_name_change();

-- 3. Make onboarding persist the hotel name + phone (not only the profile)
CREATE OR REPLACE FUNCTION public.complete_onboarding_simple(p_user_id uuid, p_company_name text, p_contact_name text, p_phone text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Keep the establishment (hotel) name and phone in sync with what the user entered.
  UPDATE public.hotels
  SET
    name = COALESCE(NULLIF(trim(p_company_name), ''), name),
    phone = COALESCE(NULLIF(trim(p_phone), ''), phone),
    updated_at = now()
  WHERE user_id = p_user_id;

  RETURN true;
END;
$function$;
