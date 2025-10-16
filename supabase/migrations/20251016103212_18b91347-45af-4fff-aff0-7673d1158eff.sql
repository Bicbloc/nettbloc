-- Fonction pour générer un code d'accès et l'insérer correctement
CREATE OR REPLACE FUNCTION generate_and_insert_access_code(
  p_hotel_id UUID,
  p_housekeeper_name TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_code TEXT;
  v_access_code TEXT;
  v_housekeeper_id UUID;
  v_name_part TEXT;
  v_random_suffix TEXT;
  v_exists BOOLEAN;
  v_attempts INT := 0;
  v_user_id UUID;
BEGIN
  -- Récupérer l'ID de l'utilisateur courant
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  -- Récupérer le code de l'hôtel
  SELECT hotel_code INTO v_hotel_code
  FROM hotels
  WHERE id = p_hotel_id;

  IF v_hotel_code IS NULL THEN
    RAISE EXCEPTION 'Hôtel non trouvé';
  END IF;

  -- Générer la partie nom (3 premières lettres en majuscules)
  v_name_part := UPPER(SUBSTRING(REGEXP_REPLACE(p_housekeeper_name, '[^A-Za-z]', '', 'g'), 1, 3));

  -- Générer un code unique
  LOOP
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'Impossible de générer un code unique après 10 tentatives';
    END IF;

    -- Générer un suffixe aléatoire de 4 chiffres
    v_random_suffix := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    v_access_code := v_hotel_code || '-' || v_name_part || '-' || v_random_suffix;

    -- Vérifier l'unicité dans les deux tables
    SELECT EXISTS (
      SELECT 1 FROM housekeeper_access_codes 
      WHERE access_code = v_access_code AND is_active = true
    ) OR EXISTS (
      SELECT 1 FROM housekeepers 
      WHERE access_code = v_access_code AND is_active = true
    ) INTO v_exists;

    EXIT WHEN NOT v_exists;
  END LOOP;

  -- Vérifier si la femme de chambre existe déjà
  SELECT id INTO v_housekeeper_id
  FROM housekeepers
  WHERE hotel_id = p_hotel_id 
    AND name = p_housekeeper_name
    AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_housekeeper_id IS NULL THEN
    -- Créer la femme de chambre
    INSERT INTO housekeepers (hotel_id, name, access_code, is_active, user_id)
    VALUES (p_hotel_id, p_housekeeper_name, v_access_code, true, v_user_id)
    RETURNING id INTO v_housekeeper_id;
  ELSE
    -- Mettre à jour le code d'accès de la femme de chambre existante
    UPDATE housekeepers
    SET access_code = v_access_code, updated_at = NOW()
    WHERE id = v_housekeeper_id;
  END IF;

  -- Insérer ou mettre à jour dans housekeeper_access_codes
  INSERT INTO housekeeper_access_codes (
    hotel_id, 
    housekeeper_id, 
    access_code, 
    is_active, 
    created_by
  )
  VALUES (
    p_hotel_id,
    v_housekeeper_id,
    v_access_code,
    true,
    v_user_id
  )
  ON CONFLICT (hotel_id, housekeeper_id)
  DO UPDATE SET
    access_code = EXCLUDED.access_code,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

  RETURN v_access_code;
END;
$$;