-- Fix access codes to be permanent and fix user sessions
-- 1. Add missing column to hotel_sessions if needed
ALTER TABLE hotel_sessions ADD COLUMN IF NOT EXISTS housekeeper_names jsonb DEFAULT '[]'::jsonb;

-- 2. Create or update function for permanent access codes (no expiration)
CREATE OR REPLACE FUNCTION public.generate_permanent_access_code(p_hotel_id uuid, p_housekeeper_name text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  hotel_code TEXT;
  generated_access_code TEXT;
  random_suffix TEXT;
  name_part TEXT;
  attempts INTEGER := 0;
  max_attempts INTEGER := 10;
BEGIN
  -- Get hotel code
  SELECT h.hotel_code INTO hotel_code 
  FROM public.hotels h 
  WHERE h.id = p_hotel_id;
  
  IF hotel_code IS NULL THEN
    RAISE EXCEPTION 'Hôtel introuvable ou code manquant';
  END IF;
  
  -- Create name part (first 3 letters uppercase)
  IF p_housekeeper_name IS NOT NULL THEN
    name_part := UPPER(LEFT(p_housekeeper_name, 3));
  ELSE
    name_part := 'HSK'; -- Fallback if no name
  END IF;
  
  -- Loop to generate unique code
  LOOP
    -- Generate random suffix of 4 digits
    random_suffix := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    generated_access_code := hotel_code || '-' || name_part || '-' || random_suffix;
    
    -- Check that code doesn't already exist (no expiration check)
    IF NOT EXISTS (
      SELECT 1 FROM public.housekeeper_access_codes 
      WHERE access_code = generated_access_code AND is_active = true
    ) THEN
      EXIT; -- Unique code found
    END IF;
    
    attempts := attempts + 1;
    IF attempts >= max_attempts THEN
      RAISE EXCEPTION 'Impossible de générer un code unique après % tentatives', max_attempts;
    END IF;
  END LOOP;
  
  -- Insert new permanent access code (no expiration)
  INSERT INTO public.housekeeper_access_codes (
    hotel_id,
    access_code,
    is_active,
    expires_at,
    created_by,
    invited_name
  ) VALUES (
    p_hotel_id,
    generated_access_code,
    true,
    NULL, -- No expiration
    auth.uid(),
    p_housekeeper_name
  );
  
  RETURN generated_access_code;
END;
$$;

-- 3. Create function to regenerate codes for existing housekeepers
CREATE OR REPLACE FUNCTION public.regenerate_housekeeper_codes(p_hotel_id uuid)
RETURNS TABLE(housekeeper_name text, new_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  housekeeper_record RECORD;
  new_access_code TEXT;
BEGIN
  -- Loop through all active housekeepers
  FOR housekeeper_record IN 
    SELECT h.id, h.name, h.access_code 
    FROM housekeepers h 
    WHERE h.hotel_id = p_hotel_id AND h.is_active = true
  LOOP
    -- Generate new permanent code
    new_access_code := public.generate_permanent_access_code(p_hotel_id, housekeeper_record.name);
    
    -- Update housekeeper with new code
    UPDATE housekeepers 
    SET access_code = new_access_code
    WHERE id = housekeeper_record.id;
    
    -- Return the result
    housekeeper_name := housekeeper_record.name;
    new_code := new_access_code;
    RETURN NEXT;
  END LOOP;
END;
$$;