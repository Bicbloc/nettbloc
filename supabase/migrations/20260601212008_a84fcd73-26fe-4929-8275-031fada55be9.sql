CREATE OR REPLACE FUNCTION public.admin_get_ai_usage_by_function(p_days integer DEFAULT 30)
RETURNS TABLE(function_name text, calls bigint, tokens bigint, last_at timestamp with time zone)
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
    MAX(aul.created_at) AS last_at
  FROM public.ai_usage_logs aul
  WHERE aul.created_at >= now() - (p_days || ' days')::interval
  GROUP BY 1
  ORDER BY tokens DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_get_ai_usage_by_function(integer) TO authenticated;