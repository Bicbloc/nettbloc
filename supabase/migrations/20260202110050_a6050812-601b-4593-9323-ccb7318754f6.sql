-- Ajout des champs de facturation et onboarding au profil
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS billing_company_name TEXT,
ADD COLUMN IF NOT EXISTS billing_address TEXT,
ADD COLUMN IF NOT EXISTS billing_postal_code TEXT,
ADD COLUMN IF NOT EXISTS billing_city TEXT,
ADD COLUMN IF NOT EXISTS billing_country TEXT DEFAULT 'France',
ADD COLUMN IF NOT EXISTS billing_phone TEXT,
ADD COLUMN IF NOT EXISTS billing_contact_name TEXT,
ADD COLUMN IF NOT EXISTS billing_contact_email TEXT,
ADD COLUMN IF NOT EXISTS billing_tva_number TEXT,
ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_duration_months INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS trial_reminder_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_warning_level INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS gocardless_mandate_id TEXT,
ADD COLUMN IF NOT EXISTS gocardless_customer_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none';

-- Index pour faciliter les requêtes sur le statut d'onboarding et trial
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding ON public.profiles(onboarding_completed_at);
CREATE INDEX IF NOT EXISTS idx_profiles_trial_end ON public.profiles(trial_end_date);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON public.profiles(subscription_status);

-- Fonction pour vérifier si l'essai expire bientôt
CREATE OR REPLACE FUNCTION public.get_trial_warning_level(p_user_id uuid)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trial_end TIMESTAMP WITH TIME ZONE;
  v_days_remaining INTEGER;
BEGIN
  SELECT trial_end_date INTO v_trial_end
  FROM public.profiles
  WHERE id = p_user_id;
  
  IF v_trial_end IS NULL THEN
    RETURN 0;
  END IF;
  
  v_days_remaining := EXTRACT(DAY FROM (v_trial_end - NOW()));
  
  IF v_days_remaining <= 0 THEN
    RETURN 4; -- Essai expiré
  ELSIF v_days_remaining <= 3 THEN
    RETURN 3; -- Critique: 3 jours ou moins
  ELSIF v_days_remaining <= 7 THEN
    RETURN 2; -- Avertissement: 1 semaine
  ELSIF v_days_remaining <= 14 THEN
    RETURN 1; -- Info: 2 semaines
  ELSE
    RETURN 0; -- OK
  END IF;
END;
$$;

-- Fonction pour démarrer la période d'essai
CREATE OR REPLACE FUNCTION public.start_trial_period(p_user_id uuid)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trial_end TIMESTAMP WITH TIME ZONE;
BEGIN
  v_trial_end := NOW() + INTERVAL '3 months';
  
  UPDATE public.profiles
  SET 
    trial_start_date = NOW(),
    trial_end_date = v_trial_end,
    trial_duration_months = 3,
    subscription_status = 'trial',
    subscription_type = 'trial'
  WHERE id = p_user_id;
  
  RETURN v_trial_end;
END;
$$;