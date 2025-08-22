-- Fix access code inconsistencies
-- Update Hotel ARTOIS (HTL904) housekeepers with HTL002 codes to HTL904
UPDATE housekeepers 
SET access_code = REPLACE(access_code, 'HTL002-', 'HTL904-')
WHERE hotel_id = '8925d462-e1c8-4699-bcbe-cb16e5d707c1' 
  AND access_code LIKE 'HTL002-%';

-- Update le A hotel (HTL009) housekeepers with HTL014 codes to HTL009  
UPDATE housekeepers
SET access_code = REPLACE(access_code, 'HTL014-', 'HTL009-')
WHERE hotel_id = '3463c73a-e2ed-4fd1-ab8a-4152817bd544'
  AND access_code LIKE 'HTL014-%';

-- Create a function to fix all code inconsistencies
CREATE OR REPLACE FUNCTION fix_access_code_inconsistencies()
RETURNS TABLE(hotel_name text, hotel_code text, fixed_housekeepers integer)
LANGUAGE plpgsql
AS $$
DECLARE
  hotel_record RECORD;
  fixed_count integer;
BEGIN
  -- Loop through all hotels
  FOR hotel_record IN 
    SELECT h.id, h.name, h.hotel_code 
    FROM hotels h 
    WHERE h.hotel_code IS NOT NULL
  LOOP
    -- Count and fix housekeepers with incorrect codes
    UPDATE housekeepers 
    SET access_code = hotel_record.hotel_code || SUBSTRING(access_code FROM POSITION('-' IN access_code))
    WHERE hotel_id = hotel_record.id 
      AND access_code IS NOT NULL
      AND access_code NOT LIKE (hotel_record.hotel_code || '-%')
      AND POSITION('-' IN access_code) > 0;
    
    GET DIAGNOSTICS fixed_count = ROW_COUNT;
    
    IF fixed_count > 0 THEN
      RETURN QUERY SELECT hotel_record.name, hotel_record.hotel_code, fixed_count;
    END IF;
  END LOOP;
END;
$$;