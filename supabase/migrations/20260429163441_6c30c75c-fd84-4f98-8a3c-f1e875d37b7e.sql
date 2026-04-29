-- 1) Ajout colonnes pays / langue / TVA sur profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS vat_number text,
  ADD COLUMN IF NOT EXISTS is_b2b_reverse_charge boolean DEFAULT false;

-- Contraintes
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_preferred_language_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_preferred_language_check
  CHECK (preferred_language IN ('fr', 'en'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_country_code_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_country_code_check
  CHECK (country_code IS NULL OR length(country_code) = 2);

-- 2) Bannières administrateur
CREATE TABLE IF NOT EXISTS public.admin_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  message_en text,
  banner_type text NOT NULL DEFAULT 'info' CHECK (banner_type IN ('info','maintenance','promotion','urgent')),
  action_label text,
  action_label_en text,
  action_url text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  is_dismissible boolean NOT NULL DEFAULT true,
  -- Ciblage
  target_scope text NOT NULL DEFAULT 'all' CHECK (target_scope IN ('all','countries','plans','hotels')),
  target_countries text[] DEFAULT NULL,
  target_plans text[] DEFAULT NULL,
  target_hotel_ids uuid[] DEFAULT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_banners_active ON public.admin_banners(is_active, starts_at, ends_at);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_admin_banners_updated_at ON public.admin_banners;
CREATE TRIGGER trg_admin_banners_updated_at
  BEFORE UPDATE ON public.admin_banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.admin_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view banners" ON public.admin_banners;
CREATE POLICY "Authenticated users can view banners"
  ON public.admin_banners FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Super admins can insert banners" ON public.admin_banners;
CREATE POLICY "Super admins can insert banners"
  ON public.admin_banners FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Super admins can update banners" ON public.admin_banners;
CREATE POLICY "Super admins can update banners"
  ON public.admin_banners FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Super admins can delete banners" ON public.admin_banners;
CREATE POLICY "Super admins can delete banners"
  ON public.admin_banners FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 3) Mémorisation de la fermeture par utilisateur
CREATE TABLE IF NOT EXISTS public.admin_banner_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  banner_id uuid NOT NULL REFERENCES public.admin_banners(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (banner_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_banner_dismissals_user ON public.admin_banner_dismissals(user_id);

ALTER TABLE public.admin_banner_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own dismissals" ON public.admin_banner_dismissals;
CREATE POLICY "Users can view own dismissals"
  ON public.admin_banner_dismissals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own dismissals" ON public.admin_banner_dismissals;
CREATE POLICY "Users can insert own dismissals"
  ON public.admin_banner_dismissals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own dismissals" ON public.admin_banner_dismissals;
CREATE POLICY "Users can delete own dismissals"
  ON public.admin_banner_dismissals FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4) Fonction utilitaire : récupérer les bannières actives ciblant l'utilisateur courant
CREATE OR REPLACE FUNCTION public.get_active_banners_for_user()
RETURNS TABLE (
  id uuid,
  title text,
  message text,
  message_en text,
  banner_type text,
  action_label text,
  action_label_en text,
  action_url text,
  is_dismissible boolean,
  starts_at timestamptz,
  ends_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_country text;
  v_plan text;
  v_hotel_ids uuid[];
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT p.country_code, p.subscription_type
    INTO v_country, v_plan
  FROM public.profiles p
  WHERE p.id = v_uid;

  SELECT array_agg(h.id) INTO v_hotel_ids
  FROM public.hotels h
  WHERE h.user_id = v_uid;

  RETURN QUERY
  SELECT b.id, b.title, b.message, b.message_en, b.banner_type,
         b.action_label, b.action_label_en, b.action_url,
         b.is_dismissible, b.starts_at, b.ends_at
  FROM public.admin_banners b
  WHERE b.is_active = true
    AND b.starts_at <= now()
    AND (b.ends_at IS NULL OR b.ends_at > now())
    AND (
      b.target_scope = 'all'
      OR (b.target_scope = 'countries' AND v_country = ANY(b.target_countries))
      OR (b.target_scope = 'plans' AND v_plan = ANY(b.target_plans))
      OR (b.target_scope = 'hotels' AND v_hotel_ids && b.target_hotel_ids)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.admin_banner_dismissals d
      WHERE d.banner_id = b.id AND d.user_id = v_uid
    )
  ORDER BY
    CASE b.banner_type WHEN 'urgent' THEN 1 WHEN 'maintenance' THEN 2 WHEN 'promotion' THEN 3 ELSE 4 END,
    b.created_at DESC;
END;
$$;