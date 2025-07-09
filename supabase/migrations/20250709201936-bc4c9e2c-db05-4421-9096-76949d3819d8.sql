-- Permettre la création d'hôtels avec des IDs personnalisés
-- Modifier la contrainte PRIMARY KEY pour permettre des IDs personnalisés

-- D'abord supprimer la contrainte de génération automatique si elle existe
ALTER TABLE public.hotels ALTER COLUMN id DROP DEFAULT;

-- Permettre l'insertion manuelle d'IDs dans la table hotels
-- (PostgreSQL permet déjà cela par défaut, mais on s'assure que c'est bien configuré)

-- Ajouter une fonction pour valider les IDs d'hôtels
CREATE OR REPLACE FUNCTION public.validate_hotel_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Vérifier que l'ID commence par 'hotel-' pour les IDs déterministes
  IF NEW.id LIKE 'hotel-%' THEN
    -- C'est un ID déterministe valide
    RETURN NEW;
  ELSIF NEW.id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    -- C'est un UUID standard valide
    RETURN NEW;
  ELSE
    -- ID invalide
    RAISE EXCEPTION 'ID d''hôtel invalide. Doit être un UUID valide ou commencer par "hotel-"';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Créer un trigger pour valider les IDs avant insertion
DROP TRIGGER IF EXISTS validate_hotel_id_trigger ON public.hotels;
CREATE TRIGGER validate_hotel_id_trigger
  BEFORE INSERT OR UPDATE ON public.hotels
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_hotel_id();

-- S'assurer que la table hotels peut accepter des IDs personnalisés
-- En conservant la possibilité de générer automatiquement des UUIDs si aucun ID n'est fourni
ALTER TABLE public.hotels 
  ALTER COLUMN id SET DEFAULT gen_random_uuid();