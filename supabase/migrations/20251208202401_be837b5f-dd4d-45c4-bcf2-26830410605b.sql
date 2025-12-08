-- Configuration des prix (administration)
CREATE TABLE IF NOT EXISTS public.pricing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name TEXT NOT NULL UNIQUE,
  price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_yearly DECIMAL(10,2),
  max_rooms INTEGER,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Activer RLS
ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;

-- Politique de lecture publique pour les prix
CREATE POLICY "Anyone can view pricing" ON public.pricing_config
  FOR SELECT USING (true);

-- Politique d'écriture pour super admins
CREATE POLICY "Super admins can manage pricing" ON public.pricing_config
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Ajouter les nouvelles colonnes à profiles pour le nouveau système de souscription
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS max_rooms INTEGER DEFAULT 15,
  ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_duration_months INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS features_enabled JSONB DEFAULT '{"incidents": false, "linen": false, "access_codes": false, "ai_learning": false, "api_access": false}'::jsonb;

-- Insérer les configurations de prix par défaut
INSERT INTO public.pricing_config (plan_name, price_monthly, price_yearly, max_rooms, features)
VALUES 
  ('free', 0, 0, 15, '{"pdf_analysis": true, "auto_distribution": true, "basic_report": true, "incidents": false, "linen": false, "access_codes": false, "ai_learning": false, "api_access": false}'),
  ('premium', 49.99, 499.99, null, '{"pdf_analysis": true, "auto_distribution": true, "basic_report": true, "incidents": true, "linen": true, "access_codes": true, "ai_learning": true, "api_access": true, "unlimited_rooms": true}')
ON CONFLICT (plan_name) DO UPDATE SET
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_rooms = EXCLUDED.max_rooms,
  features = EXCLUDED.features,
  updated_at = now();

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION public.update_pricing_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_pricing_config_updated_at ON public.pricing_config;
CREATE TRIGGER update_pricing_config_updated_at
  BEFORE UPDATE ON public.pricing_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pricing_config_updated_at();

-- Mettre à jour les utilisateurs existants avec trial_start_date s'ils sont en trial
UPDATE public.profiles
SET trial_start_date = created_at
WHERE subscription_type = 'trial' AND trial_start_date IS NULL;