-- Créer le profil manquant pour l'utilisateur aminekhellas2@gmail.com
INSERT INTO public.profiles (id, email, company_name)
VALUES (
  '6f0b2a40-afe8-4a61-96c5-63435877e6e6',
  'aminekhellas2@gmail.com',
  'Hotel Chat'
)
ON CONFLICT (id) DO UPDATE SET
  company_name = EXCLUDED.company_name,
  updated_at = now();

-- Créer une table pour stocker les codes d'accès des femmes de chambre avec un système plus robuste
CREATE TABLE IF NOT EXISTS public.housekeeper_access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  housekeeper_id uuid REFERENCES public.housekeepers(id) ON DELETE CASCADE,
  access_code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  used_at timestamp with time zone,
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.housekeeper_access_codes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage access codes for their hotels" 
ON public.housekeeper_access_codes 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h 
    WHERE h.id = housekeeper_access_codes.hotel_id 
    AND h.user_id = auth.uid()
  )
);

-- Améliorer la fonction de génération des codes d'accès
CREATE OR REPLACE FUNCTION public.generate_housekeeper_access_code(
  p_hotel_id uuid,
  p_housekeeper_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  hotel_code TEXT;
  access_code TEXT;
  random_suffix TEXT;
  attempts INTEGER := 0;
  max_attempts INTEGER := 10;
BEGIN
  -- Récupérer le code de l'hôtel
  SELECT h.hotel_code INTO hotel_code 
  FROM public.hotels h 
  WHERE h.id = p_hotel_id;
  
  IF hotel_code IS NULL THEN
    RAISE EXCEPTION 'Hôtel introuvable ou code manquant';
  END IF;
  
  -- Boucle pour générer un code unique
  LOOP
    -- Générer un suffixe aléatoire de 4 chiffres
    random_suffix := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    access_code := hotel_code || '-' || random_suffix;
    
    -- Vérifier que le code n'existe pas déjà
    IF NOT EXISTS (
      SELECT 1 FROM public.housekeeper_access_codes 
      WHERE access_code = access_code AND is_active = true
    ) THEN
      EXIT; -- Code unique trouvé
    END IF;
    
    attempts := attempts + 1;
    IF attempts >= max_attempts THEN
      RAISE EXCEPTION 'Impossible de générer un code unique après % tentatives', max_attempts;
    END IF;
  END LOOP;
  
  -- Insérer le nouveau code d'accès
  INSERT INTO public.housekeeper_access_codes (
    hotel_id,
    housekeeper_id,
    access_code,
    created_by
  ) VALUES (
    p_hotel_id,
    p_housekeeper_id,
    access_code,
    auth.uid()
  );
  
  RETURN access_code;
END;
$$;

-- Fonction pour valider un code d'accès
CREATE OR REPLACE FUNCTION public.validate_housekeeper_access_code(
  p_access_code text,
  p_hotel_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  code_record RECORD;
BEGIN
  -- Rechercher le code d'accès
  SELECT hac.*, h.hotel_code
  INTO code_record
  FROM public.housekeeper_access_codes hac
  JOIN public.hotels h ON h.id = hac.hotel_id
  WHERE hac.access_code = p_access_code 
    AND hac.hotel_id = p_hotel_id
    AND hac.is_active = true
    AND (hac.expires_at IS NULL OR hac.expires_at > now());
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Marquer le code comme utilisé
  UPDATE public.housekeeper_access_codes 
  SET used_at = now()
  WHERE id = code_record.id;
  
  RETURN true;
END;
$$;

-- Index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_housekeeper_access_codes_code ON public.housekeeper_access_codes(access_code);
CREATE INDEX IF NOT EXISTS idx_housekeeper_access_codes_hotel ON public.housekeeper_access_codes(hotel_id);
CREATE INDEX IF NOT EXISTS idx_housekeeper_access_codes_active ON public.housekeeper_access_codes(is_active) WHERE is_active = true;