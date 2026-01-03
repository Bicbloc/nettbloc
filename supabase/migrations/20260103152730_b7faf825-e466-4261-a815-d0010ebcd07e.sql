-- Mettre à jour les configurations de prix avec les nouveaux plans
DELETE FROM pricing_config;

INSERT INTO pricing_config (plan_name, price_monthly, max_rooms, features, is_active) VALUES
('freemium', 0, 30, '{"pdf_analysis": true, "auto_distribution": true, "download_reports": true, "max_housekeepers": 5, "email_support": true}', true),
('basic', 150, 70, '{"pdf_analysis": true, "auto_distribution": true, "download_reports": true, "housekeepers_unlimited": true, "email_support": true, "incidents": false, "linen_inventory": false, "inspection": false}', true),
('basic_plus', 250, 170, '{"pdf_analysis": true, "auto_distribution": true, "download_reports": true, "housekeepers_unlimited": true, "email_support": true, "incidents": false, "linen_inventory": false, "inspection": false}', true),
('premium', 200, 150, '{"pdf_analysis": true, "auto_distribution": true, "download_reports": true, "housekeepers_unlimited": true, "priority_support": true, "incidents": true, "linen_inventory": true, "inspection": true, "advanced_reports": true}', true),
('platinum', 400, null, '{"pdf_analysis": true, "auto_distribution": true, "download_reports": true, "housekeepers_unlimited": true, "priority_support": true, "incidents": true, "linen_inventory": true, "inspection": true, "advanced_reports": true, "api_access": true, "unlimited_rooms": true}', true);

-- Créer la table des tickets de support
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  admin_notes TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS pour les tickets
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Super admins can view all tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Super admins can update tickets" ON public.support_tickets;

CREATE POLICY "Users can view their own tickets" ON public.support_tickets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admins can view all tickets" ON public.support_tickets
  FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update tickets" ON public.support_tickets
  FOR UPDATE USING (public.has_role(auth.uid(), 'super_admin'));

-- Créer la table des codes promo
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_months')),
  discount_value NUMERIC NOT NULL,
  applicable_plans TEXT[] DEFAULT ARRAY['basic', 'basic_plus', 'premium', 'platinum'],
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT now(),
  valid_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table pour suivre l'utilisation des codes promo
CREATE TABLE IF NOT EXISTS public.promo_code_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  subscription_id TEXT,
  discount_applied NUMERIC
);

-- RLS pour les codes promo
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_uses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can manage promo codes" ON public.promo_codes;
DROP POLICY IF EXISTS "Users can view active promo codes" ON public.promo_codes;
DROP POLICY IF EXISTS "Super admins can view promo uses" ON public.promo_code_uses;
DROP POLICY IF EXISTS "Users can use promo codes" ON public.promo_code_uses;

CREATE POLICY "Super admins can manage promo codes" ON public.promo_codes
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can view active promo codes" ON public.promo_codes
  FOR SELECT USING (is_active = true AND (valid_until IS NULL OR valid_until > now()));

CREATE POLICY "Super admins can view promo uses" ON public.promo_code_uses
  FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can use promo codes" ON public.promo_code_uses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Fonction pour valider un code promo
CREATE OR REPLACE FUNCTION public.validate_promo_code(p_code TEXT, p_plan TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  discount_type TEXT,
  discount_value NUMERIC,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo promo_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_promo FROM promo_codes 
  WHERE code = UPPER(p_code) 
    AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::NUMERIC, 'Code promo invalide';
    RETURN;
  END IF;
  
  IF v_promo.valid_until IS NOT NULL AND v_promo.valid_until < now() THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::NUMERIC, 'Code promo expiré';
    RETURN;
  END IF;
  
  IF v_promo.max_uses IS NOT NULL AND v_promo.current_uses >= v_promo.max_uses THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::NUMERIC, 'Code promo épuisé';
    RETURN;
  END IF;
  
  IF NOT (p_plan = ANY(v_promo.applicable_plans)) THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::NUMERIC, 'Code non applicable à ce plan';
    RETURN;
  END IF;
  
  RETURN QUERY SELECT true, v_promo.discount_type, v_promo.discount_value, NULL::TEXT;
END;
$$;