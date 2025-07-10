-- Phase 1: Simplifier la création d'hôtel
-- Ajouter la colonne adresse à la table hotels
ALTER TABLE public.hotels 
ADD COLUMN address TEXT;

-- Créer une séquence pour les IDs courts d'hôtel
CREATE SEQUENCE IF NOT EXISTS hotel_short_id_seq START 1;

-- Créer une fonction pour générer un ID court d'hôtel
CREATE OR REPLACE FUNCTION generate_short_hotel_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  next_num INTEGER;
  short_id TEXT;
BEGIN
  -- Obtenir le prochain numéro de la séquence
  SELECT nextval('hotel_short_id_seq') INTO next_num;
  
  -- Formater comme HTL001, HTL002, etc.
  short_id := 'HTL' || LPAD(next_num::TEXT, 3, '0');
  
  RETURN short_id;
END;
$$;

-- Créer une fonction pour générer automatiquement hotel_code si vide
CREATE OR REPLACE FUNCTION auto_generate_hotel_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Si hotel_code est vide ou NULL, générer automatiquement
  IF NEW.hotel_code IS NULL OR NEW.hotel_code = '' THEN
    NEW.hotel_code := generate_short_hotel_id();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Créer un trigger pour auto-générer le hotel_code à l'insertion
CREATE TRIGGER trigger_auto_generate_hotel_code
  BEFORE INSERT ON public.hotels
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_hotel_code();