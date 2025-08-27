-- Phase 1: Nettoyage et synchronisation des codes d'accès

-- 1. Nettoyer les codes d'accès orphelins (sans housekeeper_id)
UPDATE public.housekeeper_access_codes 
SET is_active = false 
WHERE housekeeper_id IS NULL;

-- 2. Créer une fonction pour synchroniser les codes d'accès
CREATE OR REPLACE FUNCTION public.sync_access_codes_with_housekeepers()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  housekeeper_record RECORD;
  synced_count INTEGER := 0;
BEGIN
  -- Pour chaque femme de chambre active qui n'a pas de code dans housekeeper_access_codes
  FOR housekeeper_record IN 
    SELECT h.id, h.hotel_id, h.name, h.access_code
    FROM public.housekeepers h
    WHERE h.is_active = true 
      AND h.access_code IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.housekeeper_access_codes hac 
        WHERE hac.housekeeper_id = h.id AND hac.is_active = true
      )
  LOOP
    -- Insérer le code dans housekeeper_access_codes
    INSERT INTO public.housekeeper_access_codes (
      hotel_id,
      housekeeper_id,
      access_code,
      is_active,
      expires_at,
      created_by
    ) VALUES (
      housekeeper_record.hotel_id,
      housekeeper_record.id,
      housekeeper_record.access_code,
      true,
      NULL, -- Code permanent
      (SELECT user_id FROM public.hotels WHERE id = housekeeper_record.hotel_id)
    )
    ON CONFLICT (access_code) DO NOTHING;
    
    synced_count := synced_count + 1;
  END LOOP;
  
  RETURN synced_count;
END;
$$;

-- 3. Créer une fonction pour générer des codes manquants
CREATE OR REPLACE FUNCTION public.generate_missing_access_codes_for_hotel(p_hotel_id uuid)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  housekeeper_record RECORD;
  new_access_code TEXT;
  generated_count INTEGER := 0;
  hotel_code TEXT;
BEGIN
  -- Récupérer le code de l'hôtel
  SELECT h.hotel_code INTO hotel_code 
  FROM public.hotels h 
  WHERE h.id = p_hotel_id;
  
  IF hotel_code IS NULL THEN
    RAISE EXCEPTION 'Code hôtel manquant pour %', p_hotel_id;
  END IF;
  
  -- Pour chaque femme de chambre active sans code d'accès
  FOR housekeeper_record IN 
    SELECT h.id, h.hotel_id, h.name
    FROM public.housekeepers h
    WHERE h.hotel_id = p_hotel_id 
      AND h.is_active = true 
      AND (h.access_code IS NULL OR h.access_code = '')
  LOOP
    -- Générer un nouveau code
    new_access_code := public.generate_housekeeper_access_code_simple(p_hotel_id, housekeeper_record.name);
    
    -- Mettre à jour la femme de chambre
    UPDATE public.housekeepers 
    SET access_code = new_access_code
    WHERE id = housekeeper_record.id;
    
    -- Créer l'entrée dans housekeeper_access_codes
    INSERT INTO public.housekeeper_access_codes (
      hotel_id,
      housekeeper_id,
      access_code,
      is_active,
      expires_at,
      created_by
    ) VALUES (
      housekeeper_record.hotel_id,
      housekeeper_record.id,
      new_access_code,
      true,
      NULL,
      (SELECT user_id FROM public.hotels WHERE id = p_hotel_id)
    );
    
    generated_count := generated_count + 1;
  END LOOP;
  
  RETURN generated_count;
END;
$$;