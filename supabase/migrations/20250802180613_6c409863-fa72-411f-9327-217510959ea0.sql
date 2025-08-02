-- Corriger la fonction de génération pour créer des codes avec le prénom au milieu
CREATE OR REPLACE FUNCTION public.generate_housekeeper_access_code_with_name(
  p_hotel_id uuid, 
  p_housekeeper_id uuid DEFAULT NULL::uuid,
  p_housekeeper_name text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  hotel_code TEXT;
  housekeeper_name TEXT;
  generated_access_code TEXT;
  random_suffix TEXT;
  name_part TEXT;
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
  
  -- Récupérer le nom de la femme de chambre
  IF p_housekeeper_name IS NOT NULL THEN
    housekeeper_name := p_housekeeper_name;
  ELSIF p_housekeeper_id IS NOT NULL THEN
    SELECT h.name INTO housekeeper_name 
    FROM public.housekeepers h 
    WHERE h.id = p_housekeeper_id;
  END IF;
  
  -- Créer la partie nom (3 premières lettres en majuscules)
  IF housekeeper_name IS NOT NULL THEN
    name_part := UPPER(LEFT(housekeeper_name, 3));
  ELSE
    name_part := 'HSK'; -- Fallback si pas de nom
  END IF;
  
  -- Boucle pour générer un code unique
  LOOP
    -- Générer un suffixe aléatoire de 4 chiffres
    random_suffix := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    generated_access_code := hotel_code || '-' || name_part || '-' || random_suffix;
    
    -- Vérifier que le code n'existe pas déjà
    IF NOT EXISTS (
      SELECT 1 FROM public.housekeeper_access_codes 
      WHERE access_code = generated_access_code AND is_active = true
    ) THEN
      EXIT; -- Code unique trouvé
    END IF;
    
    attempts := attempts + 1;
    IF attempts >= max_attempts THEN
      RAISE EXCEPTION 'Impossible de générer un code unique après % tentatives', max_attempts;
    END IF;
  END LOOP;
  
  RETURN generated_access_code;
END;
$$;

-- Mettre à jour les codes existants avec le nouveau format
UPDATE public.housekeepers 
SET access_code = (
  SELECT public.generate_housekeeper_access_code_with_name(
    hotel_id, 
    id, 
    name
  )
)
WHERE hotel_id = '8925d462-e1c8-4699-bcbe-cb16e5d707c1' 
AND is_active = true;

-- Mettre à jour aussi la table housekeeper_access_codes
UPDATE public.housekeeper_access_codes 
SET access_code = (
  SELECT h.access_code 
  FROM public.housekeepers h 
  WHERE h.id = housekeeper_access_codes.housekeeper_id
)
WHERE hotel_id = '8925d462-e1c8-4699-bcbe-cb16e5d707c1' 
AND housekeeper_id IS NOT NULL;