DROP FUNCTION IF EXISTS public.admin_get_api_clients(integer);
DROP FUNCTION IF EXISTS public.admin_get_ai_usage_by_function(integer);

CREATE OR REPLACE FUNCTION public.ai_cost_eur(p_model text, p_prompt integer, p_completion integer)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT (
    COALESCE(p_prompt, 0) * (
      CASE
        WHEN p_model ILIKE '%flash-lite%' THEN 0.10
        WHEN p_model ILIKE '%2.5-flash%'  THEN 0.30
        WHEN p_model ILIKE '%3-flash%'    THEN 0.30
        WHEN p_model ILIKE '%pro%'        THEN 1.25
        ELSE 0.30
      END
    )
    + COALESCE(p_completion, 0) * (
      CASE
        WHEN p_model ILIKE '%flash-lite%' THEN 0.40
        WHEN p_model ILIKE '%2.5-flash%'  THEN 2.50
        WHEN p_model ILIKE '%3-flash%'    THEN 2.50
        WHEN p_model ILIKE '%pro%'        THEN 10.00
        ELSE 2.50
      END
    )
  ) / 1000000.0 * 0.92
$$;

CREATE FUNCTION public.admin_get_api_clients(p_days integer DEFAULT 30)
 RETURNS TABLE(hotel_id uuid, hotel_name text, hotel_code text, pms_type text, pms_active boolean, pms_last_sync timestamp with time zone, pms_last_status text, pms_syncs bigint, ai_calls bigint, ai_tokens bigint, ai_cost numeric, ai_last_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Accès réservé aux super administrateurs';
  END IF;

  RETURN QUERY
  SELECT
    h.id,
    h.name,
    h.hotel_code,
    pc.pms_type,
    pc.is_active,
    pc.last_sync_at,
    pc.last_sync_status,
    COALESCE(sl.cnt, 0),
    COALESCE(au.calls, 0),
    COALESCE(au.tokens, 0),
    COALESCE(au.cost, 0),
    au.last_at
  FROM public.hotels h
  LEFT JOIN public.hotel_pms_configs pc ON pc.hotel_id = h.id
  LEFT JOIN (
    SELECT psl.hotel_id AS hid, COUNT(*) AS cnt
    FROM public.pms_sync_logs psl
    WHERE psl.sync_started_at >= now() - (p_days || ' days')::interval
    GROUP BY psl.hotel_id
  ) sl ON sl.hid = h.id
  LEFT JOIN (
    SELECT aul.hotel_id AS hid,
           COUNT(*) AS calls,
           SUM(aul.total_tokens) AS tokens,
           SUM(public.ai_cost_eur(aul.model, aul.prompt_tokens, aul.completion_tokens)) AS cost,
           MAX(aul.created_at) AS last_at
    FROM public.ai_usage_logs aul
    WHERE aul.created_at >= now() - (p_days || ' days')::interval
    GROUP BY aul.hotel_id
  ) au ON au.hid = h.id
  WHERE pc.id IS NOT NULL OR au.calls IS NOT NULL
  ORDER BY COALESCE(au.tokens, 0) DESC, COALESCE(sl.cnt, 0) DESC;
END;
$function$;

CREATE FUNCTION public.admin_get_ai_usage_by_function(p_days integer DEFAULT 30)
 RETURNS TABLE(function_name text, calls bigint, tokens bigint, cost numeric, last_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Accès réservé aux super administrateurs';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(aul.function_name, 'inconnu') AS function_name,
    COUNT(*) AS calls,
    COALESCE(SUM(aul.total_tokens), 0) AS tokens,
    COALESCE(SUM(public.ai_cost_eur(aul.model, aul.prompt_tokens, aul.completion_tokens)), 0) AS cost,
    MAX(aul.created_at) AS last_at
  FROM public.ai_usage_logs aul
  WHERE aul.created_at >= now() - (p_days || ' days')::interval
  GROUP BY 1
  ORDER BY tokens DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_get_ai_usage_by_client_month(p_months integer DEFAULT 12)
 RETURNS TABLE(hotel_id uuid, hotel_name text, hotel_code text, month date, calls bigint, tokens bigint, cost numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Accès réservé aux super administrateurs';
  END IF;

  RETURN QUERY
  SELECT
    h.id,
    h.name,
    h.hotel_code,
    date_trunc('month', aul.created_at AT TIME ZONE 'UTC')::date AS month,
    COUNT(*) AS calls,
    COALESCE(SUM(aul.total_tokens), 0) AS tokens,
    COALESCE(SUM(public.ai_cost_eur(aul.model, aul.prompt_tokens, aul.completion_tokens)), 0) AS cost
  FROM public.ai_usage_logs aul
  JOIN public.hotels h ON h.id = aul.hotel_id
  WHERE aul.created_at >= date_trunc('month', now()) - ((p_months - 1) || ' months')::interval
  GROUP BY h.id, h.name, h.hotel_code, 4
  ORDER BY month DESC, cost DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ai_cost_eur(text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_api_clients(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_ai_usage_by_function(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_ai_usage_by_client_month(integer) TO authenticated, service_role;