-- Phase 1: Correction immédiate des données

-- 1. Créer le profil manquant pour cet utilisateur
INSERT INTO public.profiles (id, email, company_name, subscription_type, created_at, updated_at)
VALUES (
  '34494c71-87ab-4148-a33d-3c632444dfbc',
  'khellas.amine@icloud.com',
  'Hotel B',
  'trial',
  now(),
  now()
);

-- 2. Garder seulement le premier hôtel et le corriger
UPDATE public.hotels 
SET name = 'Hotel B'
WHERE id = '617ff6c1-d219-4d7d-9cc7-d9c3eed4303c';

-- 3. Supprimer les hôtels dupliqués
DELETE FROM public.hotels 
WHERE id IN ('209fadf6-f5c0-4a19-97c9-037581c5a706', '349bb27e-4eef-4555-89b3-d606454ed932');

-- Phase 2: Amélioration du trigger handle_new_user pour éviter les échecs futurs

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  company_name_from_meta text;
  profile_exists boolean;
  hotel_exists boolean;
BEGIN
  -- Extraire le nom de l'entreprise depuis les métadonnées
  company_name_from_meta := COALESCE(new.raw_user_meta_data->>'company_name', 'Mon Établissement');
  
  -- Vérifier si le profil existe déjà
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = new.id) INTO profile_exists;
  
  -- Créer le profil seulement s'il n'existe pas
  IF NOT profile_exists THEN
    INSERT INTO public.profiles (id, email, company_name, subscription_type)
    VALUES (
      new.id, 
      new.email,
      company_name_from_meta,
      'trial'
    );
    
    RAISE LOG 'Profile created for user %: %', new.email, company_name_from_meta;
  END IF;
  
  -- Vérifier si l'hôtel existe déjà
  SELECT EXISTS(SELECT 1 FROM public.hotels WHERE user_id = new.id) INTO hotel_exists;
  
  -- Créer l'hôtel seulement s'il n'existe pas
  IF NOT hotel_exists THEN
    INSERT INTO public.hotels (name, email, user_id, address)
    VALUES (
      company_name_from_meta,
      new.email,
      new.id,
      null
    );
    
    RAISE LOG 'Hotel created for user %: %', new.email, company_name_from_meta;
  END IF;
  
  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Logger l'erreur mais ne pas bloquer la création de l'utilisateur
    RAISE LOG 'Error in handle_new_user for %: %', new.email, SQLERRM;
    RETURN new;
END;
$function$;