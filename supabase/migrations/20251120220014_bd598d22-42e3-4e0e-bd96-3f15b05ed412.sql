-- Fix ambiguous column reference in authenticate_housekeeper_by_code function
CREATE OR REPLACE FUNCTION public.authenticate_housekeeper_by_code(p_access_code text)
 RETURNS TABLE(success boolean, hotel_id uuid, hotel_name text, hotel_code text, housekeeper_id uuid, housekeeper_name text, resolved_access_code text, code_source text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  normalized text;
  parts text[];
  code_prefix text;
  suffix text;
  short_variant text;
  v_hotel_id uuid;
  v_hotel_name text;
  v_hotel_code text;
  v_housekeeper_id uuid;
  v_housekeeper_name text;
  v_access_code text;
  code_parts_count int;
BEGIN
  IF p_access_code IS NULL OR length(trim(p_access_code)) < 5 THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::text, NULL::uuid, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  normalized := upper(trim(p_access_code));
  parts := string_to_array(normalized, '-');
  code_parts_count := array_length(parts, 1);
  code_prefix := parts[1];
  IF code_parts_count >= 3 THEN
    suffix := parts[3];
  ELSE
    suffix := CASE WHEN code_parts_count >= 2 THEN parts[2] ELSE NULL END;
  END IF;
  IF suffix IS NOT NULL THEN
    short_variant := code_prefix || '-' || suffix;
  END IF;

  -- Use secure function to get hotel info instead of direct table access
  SELECT ghi.hotel_id, ghi.hotel_name, ghi.hotel_code 
  INTO v_hotel_id, v_hotel_name, v_hotel_code
  FROM public.get_hotel_info_for_access_code(code_prefix) ghi;

  IF v_hotel_id IS NULL THEN
    -- Hotel not found
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::text, NULL::uuid, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  -- 1) Try exact match in housekeeper_access_codes (active and not expired)
  SELECT hac.access_code, hac.housekeeper_id
  INTO v_access_code, v_housekeeper_id
  FROM public.housekeeper_access_codes hac
  WHERE hac.hotel_id = v_hotel_id
    AND hac.is_active = true
    AND (hac.expires_at IS NULL OR hac.expires_at > now())
    AND upper(hac.access_code) = normalized
  LIMIT 1;

  -- 2) If not found and short format, try pattern HTLXXX-%-SUFFIX
  IF v_access_code IS NULL AND code_parts_count = 2 AND suffix IS NOT NULL THEN
    SELECT hac.access_code, hac.housekeeper_id
    INTO v_access_code, v_housekeeper_id
    FROM public.housekeeper_access_codes hac
    WHERE hac.hotel_id = v_hotel_id
      AND hac.is_active = true
      AND (hac.expires_at IS NULL OR hac.expires_at > now())
      AND upper(hac.access_code) LIKE (code_prefix || '-%-' || suffix)
    LIMIT 1;
  END IF;

  -- 3) If long provided, try short variant HTLXXX-SUFFIX
  IF v_access_code IS NULL AND code_parts_count >= 3 AND short_variant IS NOT NULL THEN
    SELECT hac.access_code, hac.housekeeper_id
    INTO v_access_code, v_housekeeper_id
    FROM public.housekeeper_access_codes hac
    WHERE hac.hotel_id = v_hotel_id
      AND hac.is_active = true
      AND (hac.expires_at IS NULL OR hac.expires_at > now())
      AND upper(hac.access_code) = short_variant
    LIMIT 1;
  END IF;

  IF v_access_code IS NOT NULL THEN
    -- Resolve housekeeper if available or via housekeepers table
    IF v_housekeeper_id IS NULL THEN
      SELECT hk.id, hk.name
      INTO v_housekeeper_id, v_housekeeper_name
      FROM public.housekeepers hk
      WHERE hk.hotel_id = v_hotel_id
        AND hk.is_active = true
        AND upper(hk.access_code) IN (normalized, short_variant)
      LIMIT 1;
    ELSE
      SELECT hk.name INTO v_housekeeper_name FROM public.housekeepers hk WHERE hk.id = v_housekeeper_id;
    END IF;

    -- Mark code as used (best-effort)
    UPDATE public.housekeeper_access_codes SET used_at = now() WHERE access_code = v_access_code;

    RETURN QUERY SELECT true, v_hotel_id, v_hotel_name, v_hotel_code, v_housekeeper_id, v_housekeeper_name, v_access_code, 'access_code';
    RETURN;
  END IF;

  -- 4) Fallback: look directly in housekeepers table (for legacy codes)
  SELECT hk.id, hk.name, hk.access_code
  INTO v_housekeeper_id, v_housekeeper_name, v_access_code
  FROM public.housekeepers hk
  WHERE hk.hotel_id = v_hotel_id
    AND hk.is_active = true
    AND upper(hk.access_code) IN (normalized, COALESCE(short_variant, normalized))
  LIMIT 1;

  IF v_housekeeper_id IS NOT NULL THEN
    RETURN QUERY SELECT true, v_hotel_id, v_hotel_name, v_hotel_code, v_housekeeper_id, v_housekeeper_name, v_access_code, 'housekeeper';
    RETURN;
  END IF;

  -- 5) Fallback: check temporary sessions
  SELECT has.housekeeper_profile_id::uuid, hp.name, has.access_code
  INTO v_housekeeper_id, v_housekeeper_name, v_access_code
  FROM public.hotel_access_sessions has
  JOIN public.housekeeper_profiles hp ON hp.id = has.housekeeper_profile_id
  WHERE has.hotel_id = v_hotel_id
    AND has.is_active = true
    AND has.expires_at > now()
    AND upper(has.access_code) IN (normalized, COALESCE(short_variant, normalized))
  LIMIT 1;

  IF v_housekeeper_id IS NOT NULL THEN
    RETURN QUERY SELECT true, v_hotel_id, v_hotel_name, v_hotel_code, v_housekeeper_id, v_housekeeper_name, v_access_code, 'session';
    RETURN;
  END IF;

  -- Not found
  RETURN QUERY SELECT false, v_hotel_id, v_hotel_name, v_hotel_code, NULL::uuid, NULL::text, NULL::text, NULL::text;
END;
$function$;