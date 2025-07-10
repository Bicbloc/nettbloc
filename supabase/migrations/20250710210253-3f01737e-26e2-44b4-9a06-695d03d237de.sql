-- Phase 1: Critical database fixes

-- Create the missing sequence for hotel short IDs
CREATE SEQUENCE IF NOT EXISTS public.hotel_short_id_seq START 1;

-- Recreate the generate_short_hotel_id function with the correct sequence
CREATE OR REPLACE FUNCTION public.generate_short_hotel_id()
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
  next_num INTEGER;
  short_id TEXT;
BEGIN
  -- Get the next number from the sequence
  SELECT nextval('public.hotel_short_id_seq') INTO next_num;
  
  -- Format as HTL001, HTL002, etc.
  short_id := 'HTL' || LPAD(next_num::TEXT, 3, '0');
  
  RETURN short_id;
END;
$function$;

-- Fix the handle_new_user function to handle errors gracefully
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  company_name_from_meta text;
BEGIN
  -- Insert user profile
  INSERT INTO public.profiles (id, email, company_name)
  VALUES (
    new.id, 
    new.email,
    COALESCE(new.raw_user_meta_data->>'company_name', 'Mon Établissement')
  );
  
  -- Extract company name from metadata
  company_name_from_meta := COALESCE(new.raw_user_meta_data->>'company_name', 'Mon Établissement');
  
  -- Create hotel for the new user
  INSERT INTO public.hotels (name, email, user_id, address)
  VALUES (
    company_name_from_meta,
    new.email,
    new.id,
    null
  );
  
  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't block user creation
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN new;
END;
$function$;