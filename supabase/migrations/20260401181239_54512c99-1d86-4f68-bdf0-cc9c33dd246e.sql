
CREATE OR REPLACE FUNCTION public.check_email_exists_for_role(p_email TEXT)
RETURNS TABLE(found_in TEXT) 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 'establishment'::TEXT FROM hotels WHERE lower(email) = lower(p_email) LIMIT 1;

  RETURN QUERY
  SELECT 'establishment'::TEXT FROM sub_accounts WHERE lower(email) = lower(p_email) LIMIT 1;

  RETURN QUERY
  SELECT 'housekeeper'::TEXT FROM housekeeper_profiles WHERE lower(email) = lower(p_email) LIMIT 1;

  RETURN QUERY
  SELECT 'governess'::TEXT FROM governess_profiles WHERE lower(email) = lower(p_email) LIMIT 1;

  RETURN QUERY
  SELECT 'technician'::TEXT FROM technician_profiles WHERE lower(email) = lower(p_email) LIMIT 1;
END;
$$;
