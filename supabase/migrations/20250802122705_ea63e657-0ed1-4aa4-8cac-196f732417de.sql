-- Corriger la fonction de génération des codes d'accès
CREATE OR REPLACE FUNCTION public.generate_housekeeper_access_code(
  p_hotel_id uuid,
  p_housekeeper_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  hotel_code TEXT;
  generated_access_code TEXT;
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
    generated_access_code := hotel_code || '-' || random_suffix;
    
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
  
  -- Insérer le nouveau code d'accès
  INSERT INTO public.housekeeper_access_codes (
    hotel_id,
    housekeeper_id,
    access_code,
    created_by
  ) VALUES (
    p_hotel_id,
    p_housekeeper_id,
    generated_access_code,
    auth.uid()
  );
  
  RETURN generated_access_code;
END;
$$;