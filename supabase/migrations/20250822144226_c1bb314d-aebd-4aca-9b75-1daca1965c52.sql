-- Mise à jour automatique des hotel_codes manquants
UPDATE hotels 
SET hotel_code = 'HTL' || LPAD(FLOOR(RANDOM() * 999 + 1)::TEXT, 3, '0')
WHERE hotel_code IS NULL;

-- Créer un trigger pour s'assurer que tous les nouveaux hôtels ont un hotel_code
CREATE OR REPLACE FUNCTION ensure_hotel_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Si hotel_code est manquant, en générer un automatiquement
  IF NEW.hotel_code IS NULL OR NEW.hotel_code = '' THEN
    NEW.hotel_code := 'HTL' || LPAD(FLOOR(RANDOM() * 999 + 1)::TEXT, 3, '0');
    
    -- Vérifier l'unicité en cas de collision
    WHILE EXISTS (SELECT 1 FROM hotels WHERE hotel_code = NEW.hotel_code AND id != NEW.id) LOOP
      NEW.hotel_code := 'HTL' || LPAD(FLOOR(RANDOM() * 999 + 1)::TEXT, 3, '0');
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger sur INSERT et UPDATE
DROP TRIGGER IF EXISTS ensure_hotel_code_trigger ON hotels;
CREATE TRIGGER ensure_hotel_code_trigger
  BEFORE INSERT OR UPDATE ON hotels
  FOR EACH ROW
  EXECUTE FUNCTION ensure_hotel_code();