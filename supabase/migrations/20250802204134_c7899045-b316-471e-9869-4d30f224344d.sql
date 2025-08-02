-- Corriger la logique de création des femmes de chambre et codes d'accès
-- Supprimer l'ancienne fonction problématique
DROP FUNCTION IF EXISTS public.generate_housekeeper_access_code_with_user(uuid, uuid, text, uuid);

-- Recréer une fonction simplifiée qui génère juste le code sans l'insérer
CREATE OR REPLACE FUNCTION public.generate_housekeeper_access_code_simple(
  p_hotel_id uuid, 
  p_housekeeper_name text DEFAULT NULL::text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  hotel_code TEXT;
  generated_access_code TEXT;
  random_suffix TEXT;
  name_part TEXT;
  attempts INTEGER := 0;
  max_attempts INTEGER := 10;
BEGIN
  -- Récupérer le code de l'hôtel et vérifier ownership
  SELECT h.hotel_code INTO hotel_code 
  FROM public.hotels h 
  WHERE h.id = p_hotel_id AND h.user_id = auth.uid();
  
  IF hotel_code IS NULL THEN
    RAISE EXCEPTION 'Hôtel introuvable ou accès non autorisé';
  END IF;
  
  -- Créer la partie nom (3 premières lettres en majuscules)
  IF p_housekeeper_name IS NOT NULL THEN
    name_part := UPPER(LEFT(p_housekeeper_name, 3));
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
      SELECT 1 FROM public.housekeepers 
      WHERE access_code = generated_access_code AND is_active = true
    ) AND NOT EXISTS (
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
$function$;

-- Nettoyer les codes d'accès orphelins (sans housekeeper_id)
DELETE FROM public.housekeeper_access_codes 
WHERE housekeeper_id IS NULL 
AND access_code IN (
  SELECT hac.access_code 
  FROM public.housekeeper_access_codes hac
  JOIN public.housekeepers h ON h.access_code = hac.access_code
  WHERE hac.housekeeper_id IS NULL
);