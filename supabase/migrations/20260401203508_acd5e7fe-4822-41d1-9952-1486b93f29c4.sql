CREATE OR REPLACE FUNCTION public.check_email_exists_for_role(p_email TEXT)
RETURNS TABLE(found_in TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check establishment: match by auth user email via user_id, not hotel contact email
  RETURN QUERY
  SELECT 'establishment'::TEXT 
  FROM hotels h
  INNER JOIN auth.users u ON u.id = h.user_id
  WHERE lower(u.email) = lower(p_email) 
  LIMIT 1;

  -- Check sub-accounts by auth user email
  RETURN QUERY
  SELECT 'establishment'::TEXT 
  FROM sub_accounts sa
  INNER JOIN auth.users u ON u.id = sa.user_id
  WHERE lower(u.email) = lower(p_email) AND sa.is_active = true
  LIMIT 1;

  RETURN QUERY
  SELECT 'housekeeper'::TEXT FROM housekeeper_profiles WHERE lower(email) = lower(p_email) LIMIT 1;

  RETURN QUERY
  SELECT 'governess'::TEXT FROM governess_profiles WHERE lower(email) = lower(p_email) LIMIT 1;

  RETURN QUERY
  SELECT 'technician'::TEXT FROM technician_profiles WHERE lower(email) = lower(p_email) LIMIT 1;
END;
$$;