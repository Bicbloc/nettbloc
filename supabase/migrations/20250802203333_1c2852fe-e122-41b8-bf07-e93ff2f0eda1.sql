-- Phase 1: Fix existing housekeepers data by setting correct user_id
-- Update housekeepers to link them to their hotel owners
UPDATE public.housekeepers 
SET user_id = h.user_id
FROM public.hotels h
WHERE housekeepers.hotel_id = h.id 
AND housekeepers.user_id IS NULL;

-- Phase 2: Remove duplicate housekeepers (keep the one with most recent created_at)
WITH duplicates AS (
  SELECT 
    id,
    name,
    hotel_id,
    ROW_NUMBER() OVER (PARTITION BY name, hotel_id ORDER BY created_at DESC) as rn
  FROM public.housekeepers
)
DELETE FROM public.housekeepers
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Phase 3: Improve RLS policies and constraints
-- Add NOT NULL constraint to user_id column
ALTER TABLE public.housekeepers 
ALTER COLUMN user_id SET NOT NULL;

-- Update RLS policy to ensure better isolation
DROP POLICY IF EXISTS "Users can manage housekeepers for their hotels" ON public.housekeepers;

CREATE POLICY "Users can manage housekeepers for their hotels" 
ON public.housekeepers 
FOR ALL 
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM public.hotels h 
    WHERE h.id = housekeepers.hotel_id 
    AND h.user_id = auth.uid()
  )
);

-- Phase 4: Fix housekeeper_access_codes user context
-- Update existing access codes to include user context
UPDATE public.housekeeper_access_codes 
SET created_by = h.user_id
FROM public.hotels h
WHERE housekeeper_access_codes.hotel_id = h.id 
AND housekeeper_access_codes.created_by IS NULL;

-- Phase 5: Improve the housekeeper creation function to include user_id
CREATE OR REPLACE FUNCTION public.generate_housekeeper_access_code_with_user(
  p_hotel_id uuid, 
  p_housekeeper_id uuid DEFAULT NULL::uuid, 
  p_housekeeper_name text DEFAULT NULL::text,
  p_user_id uuid DEFAULT NULL::uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  hotel_code TEXT;
  housekeeper_name TEXT;
  generated_access_code TEXT;
  random_suffix TEXT;
  name_part TEXT;
  attempts INTEGER := 0;
  max_attempts INTEGER := 10;
  user_context uuid;
BEGIN
  -- Get user context
  user_context := COALESCE(p_user_id, auth.uid());
  
  -- Get hotel code and verify ownership
  SELECT h.hotel_code INTO hotel_code 
  FROM public.hotels h 
  WHERE h.id = p_hotel_id AND h.user_id = user_context;
  
  IF hotel_code IS NULL THEN
    RAISE EXCEPTION 'Hôtel introuvable ou accès non autorisé';
  END IF;
  
  -- Get housekeeper name
  IF p_housekeeper_name IS NOT NULL THEN
    housekeeper_name := p_housekeeper_name;
  ELSIF p_housekeeper_id IS NOT NULL THEN
    SELECT h.name INTO housekeeper_name 
    FROM public.housekeepers h 
    WHERE h.id = p_housekeeper_id AND h.user_id = user_context;
  END IF;
  
  -- Create name part (3 first letters in uppercase)
  IF housekeeper_name IS NOT NULL THEN
    name_part := UPPER(LEFT(housekeeper_name, 3));
  ELSE
    name_part := 'HSK'; -- Fallback if no name
  END IF;
  
  -- Loop to generate unique code
  LOOP
    -- Generate random 4-digit suffix
    random_suffix := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    generated_access_code := hotel_code || '-' || name_part || '-' || random_suffix;
    
    -- Check if code doesn't already exist
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
  
  -- Insert the new access code with user context
  INSERT INTO public.housekeeper_access_codes (
    hotel_id,
    housekeeper_id,
    access_code,
    created_by
  ) VALUES (
    p_hotel_id,
    p_housekeeper_id,
    generated_access_code,
    user_context
  );
  
  RETURN generated_access_code;
END;
$function$;