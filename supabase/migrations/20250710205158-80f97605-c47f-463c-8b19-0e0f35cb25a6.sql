-- Corriger d'abord la fonction de validation des IDs d'hôtel
CREATE OR REPLACE FUNCTION public.validate_hotel_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Vérifier que l'ID commence par 'hotel-' pour les IDs déterministes ou est un UUID valide
  IF NEW.id::text LIKE 'hotel-%' THEN
    -- C'est un ID déterministe valide
    RETURN NEW;
  ELSIF NEW.id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    -- C'est un UUID standard valide
    RETURN NEW;
  ELSE
    -- ID invalide
    RAISE EXCEPTION 'ID d''hôtel invalide. Doit être un UUID valide ou commencer par "hotel-"';
  END IF;
END;
$$;

-- Mise à jour des hôtels existants pour assigner le bon user_id
UPDATE public.hotels 
SET user_id = (
  SELECT p.id 
  FROM public.profiles p 
  WHERE p.email = hotels.email 
  LIMIT 1
)
WHERE user_id IS NULL 
AND email IN (SELECT email FROM public.profiles);

-- Mettre à jour la fonction handle_new_user pour créer automatiquement un hôtel
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  company_name_from_meta text;
BEGIN
  -- Insérer le profil utilisateur
  INSERT INTO public.profiles (id, email, company_name)
  VALUES (
    new.id, 
    new.email,
    COALESCE(new.raw_user_meta_data->>'company_name', 'Mon Établissement')
  );
  
  -- Extraire le nom de l'entreprise depuis les métadonnées
  company_name_from_meta := COALESCE(new.raw_user_meta_data->>'company_name', 'Mon Établissement');
  
  -- Créer automatiquement un hôtel pour le nouvel utilisateur
  INSERT INTO public.hotels (name, email, user_id, address)
  VALUES (
    company_name_from_meta,
    new.email,
    new.id,
    null  -- L'adresse sera ajoutée plus tard
  );
  
  RETURN new;
END;
$$;