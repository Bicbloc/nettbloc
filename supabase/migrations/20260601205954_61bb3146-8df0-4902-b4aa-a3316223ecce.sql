CREATE OR REPLACE FUNCTION public.admin_get_api_clients(p_days integer DEFAULT 30)
 RETURNS TABLE(hotel_id uuid, hotel_name text, hotel_code text, pms_type text, pms_active boolean, pms_last_sync timestamp with time zone, pms_last_status text, pms_syncs bigint, ai_calls bigint, ai_tokens bigint, ai_last_at timestamp with time zone)
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
    SELECT aul.hotel_id AS hid, COUNT(*) AS calls, SUM(aul.total_tokens) AS tokens, MAX(aul.created_at) AS last_at
    FROM public.ai_usage_logs aul
    WHERE aul.created_at >= now() - (p_days || ' days')::interval
    GROUP BY aul.hotel_id
  ) au ON au.hid = h.id
  WHERE pc.id IS NOT NULL OR au.calls IS NOT NULL
  ORDER BY COALESCE(au.tokens, 0) DESC, COALESCE(sl.cnt, 0) DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_get_establishment_connections()
 RETURNS TABLE(hotel_id uuid, hotel_name text, hotel_code text, owner_email text, last_login timestamp with time zone, active_sessions bigint, housekeepers_count bigint, governesses_count bigint, technicians_count bigint, subaccounts_count bigint)
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
    COALESCE(h.email, p.email),
    sess.last_login,
    COALESCE(sess.active_sessions, 0),
    COALESCE(hk.cnt, 0),
    COALESCE(gv.cnt, 0),
    COALESCE(tc.cnt, 0),
    COALESCE(sa.cnt, 0)
  FROM public.hotels h
  LEFT JOIN public.profiles p ON p.id = h.user_id
  LEFT JOIN (
    SELECT us.hotel_id AS hid, MAX(us.login_time) AS last_login,
           COUNT(*) FILTER (WHERE us.is_active) AS active_sessions
    FROM public.user_sessions us
    GROUP BY us.hotel_id
  ) sess ON sess.hid = h.id
  LEFT JOIN (
    SELECT hsk.hotel_id AS hid, COUNT(*) AS cnt FROM public.housekeepers hsk WHERE hsk.is_active = true GROUP BY hsk.hotel_id
  ) hk ON hk.hid = h.id
  LEFT JOIN (
    SELECT gar.hotel_id AS hid, COUNT(DISTINCT gar.governess_profile_id) AS cnt
    FROM public.governess_access_requests gar WHERE gar.status = 'approved' GROUP BY gar.hotel_id
  ) gv ON gv.hid = h.id
  LEFT JOIN (
    SELECT tar.hotel_id AS hid, COUNT(DISTINCT tar.technician_profile_id) AS cnt
    FROM public.technician_access_requests tar WHERE tar.status = 'approved' GROUP BY tar.hotel_id
  ) tc ON tc.hid = h.id
  LEFT JOIN (
    SELECT sac.hotel_id AS hid, COUNT(*) AS cnt FROM public.sub_accounts sac WHERE sac.is_active = true GROUP BY sac.hotel_id
  ) sa ON sa.hid = h.id
  ORDER BY sess.last_login DESC NULLS LAST;
END;
$function$;