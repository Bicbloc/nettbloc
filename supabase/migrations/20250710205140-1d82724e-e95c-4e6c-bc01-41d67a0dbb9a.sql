-- Mise à jour des hôtels existants pour assigner le bon user_id
-- Ceci corrige le problème RLS où les hôtels n'ont pas de user_id assigné

-- D'abord, vérifier s'il y a des profils créés
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