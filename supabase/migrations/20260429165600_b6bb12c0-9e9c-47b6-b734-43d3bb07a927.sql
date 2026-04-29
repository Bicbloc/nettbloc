CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  company_name_from_meta text;
  country_from_meta text;
  language_from_meta text;
  vat_from_meta text;
  profile_exists boolean;
  hotel_exists boolean;
BEGIN
  company_name_from_meta := COALESCE(new.raw_user_meta_data->>'company_name', 'Mon Établissement');
  country_from_meta := upper(COALESCE(new.raw_user_meta_data->>'country_code', ''));
  language_from_meta := lower(COALESCE(new.raw_user_meta_data->>'preferred_language', 'fr'));
  vat_from_meta := NULLIF(trim(COALESCE(new.raw_user_meta_data->>'vat_number', '')), '');

  IF language_from_meta NOT IN ('fr','en') THEN
    language_from_meta := 'fr';
  END IF;
  IF country_from_meta = '' THEN
    country_from_meta := NULL;
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = new.id) INTO profile_exists;

  IF NOT profile_exists THEN
    INSERT INTO public.profiles (
      id, email, company_name, subscription_type,
      country_code, preferred_language, vat_number
    ) VALUES (
      new.id, new.email, company_name_from_meta, 'trial',
      country_from_meta, language_from_meta, vat_from_meta
    );
  ELSE
    -- Mettre à jour si non renseigné
    UPDATE public.profiles
       SET country_code = COALESCE(country_code, country_from_meta),
           preferred_language = COALESCE(preferred_language, language_from_meta),
           vat_number = COALESCE(vat_number, vat_from_meta)
     WHERE id = new.id;
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.hotels WHERE user_id = new.id) INTO hotel_exists;
  IF NOT hotel_exists THEN
    INSERT INTO public.hotels (name, email, user_id, address)
    VALUES (company_name_from_meta, new.email, new.id, null);
  END IF;

  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user for %: %', new.email, SQLERRM;
    RETURN new;
END;
$function$;