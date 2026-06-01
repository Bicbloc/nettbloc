
-- 1) AI usage tracking table
CREATE TABLE public.ai_usage_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id uuid,
  user_id uuid,
  function_name text NOT NULL,
  model text,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_hotel ON public.ai_usage_logs(hotel_id);
CREATE INDEX idx_ai_usage_created ON public.ai_usage_logs(created_at DESC);
CREATE INDEX idx_ai_usage_function ON public.ai_usage_logs(function_name);

GRANT SELECT ON public.ai_usage_logs TO authenticated;
GRANT ALL ON public.ai_usage_logs TO service_role;

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read AI usage"
ON public.ai_usage_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 2) API + AI clients aggregation
CREATE OR REPLACE FUNCTION public.admin_get_api_clients(p_days integer DEFAULT 30)
RETURNS TABLE(
  hotel_id uuid,
  hotel_name text,
  hotel_code text,
  pms_type text,
  pms_active boolean,
  pms_last_sync timestamp with time zone,
  pms_last_status text,
  pms_syncs bigint,
  ai_calls bigint,
  ai_tokens bigint,
  ai_last_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    SELECT hotel_id, COUNT(*) AS cnt
    FROM public.pms_sync_logs
    WHERE sync_started_at >= now() - (p_days || ' days')::interval
    GROUP BY hotel_id
  ) sl ON sl.hotel_id = h.id
  LEFT JOIN (
    SELECT hotel_id, COUNT(*) AS calls, SUM(total_tokens) AS tokens, MAX(created_at) AS last_at
    FROM public.ai_usage_logs
    WHERE created_at >= now() - (p_days || ' days')::interval
    GROUP BY hotel_id
  ) au ON au.hotel_id = h.id
  WHERE pc.id IS NOT NULL OR au.calls IS NOT NULL
  ORDER BY COALESCE(au.tokens, 0) DESC, COALESCE(sl.cnt, 0) DESC;
END;
$$;

-- 3) Daily AI usage trend
CREATE OR REPLACE FUNCTION public.admin_get_ai_usage_daily(p_days integer DEFAULT 30)
RETURNS TABLE(
  day date,
  calls bigint,
  tokens bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Accès réservé aux super administrateurs';
  END IF;

  RETURN QUERY
  SELECT
    (created_at AT TIME ZONE 'UTC')::date AS day,
    COUNT(*) AS calls,
    COALESCE(SUM(total_tokens), 0) AS tokens
  FROM public.ai_usage_logs
  WHERE created_at >= now() - (p_days || ' days')::interval
  GROUP BY 1
  ORDER BY 1;
END;
$$;

-- 4) Daily connections trend by user type
CREATE OR REPLACE FUNCTION public.admin_get_connections_daily(p_days integer DEFAULT 30)
RETURNS TABLE(
  day date,
  user_type text,
  connections bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Accès réservé aux super administrateurs';
  END IF;

  RETURN QUERY
  SELECT
    (login_time AT TIME ZONE 'UTC')::date AS day,
    COALESCE(user_type, 'unknown') AS user_type,
    COUNT(*) AS connections
  FROM public.user_sessions
  WHERE login_time >= now() - (p_days || ' days')::interval
  GROUP BY 1, 2
  ORDER BY 1;
END;
$$;

-- 5) Per-establishment connection + staff summary
CREATE OR REPLACE FUNCTION public.admin_get_establishment_connections()
RETURNS TABLE(
  hotel_id uuid,
  hotel_name text,
  hotel_code text,
  owner_email text,
  last_login timestamp with time zone,
  active_sessions bigint,
  housekeepers_count bigint,
  governesses_count bigint,
  technicians_count bigint,
  subaccounts_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Accès réservé aux super administrateurs';
  END IF;

  RETURN QUERY
  SELECT
    h.id,
    h.name,
    h.hotel_code,
    u.email,
    sess.last_login,
    COALESCE(sess.active_sessions, 0),
    COALESCE(hk.cnt, 0),
    COALESCE(gv.cnt, 0),
    COALESCE(tc.cnt, 0),
    COALESCE(sa.cnt, 0)
  FROM public.hotels h
  LEFT JOIN auth.users u ON u.id = h.user_id
  LEFT JOIN (
    SELECT hotel_id, MAX(login_time) AS last_login,
           COUNT(*) FILTER (WHERE is_active) AS active_sessions
    FROM public.user_sessions
    GROUP BY hotel_id
  ) sess ON sess.hotel_id = h.id
  LEFT JOIN (
    SELECT hotel_id, COUNT(*) AS cnt FROM public.housekeepers WHERE is_active = true GROUP BY hotel_id
  ) hk ON hk.hotel_id = h.id
  LEFT JOIN (
    SELECT hotel_id, COUNT(DISTINCT governess_profile_id) AS cnt
    FROM public.governess_access_requests WHERE status = 'approved' GROUP BY hotel_id
  ) gv ON gv.hotel_id = h.id
  LEFT JOIN (
    SELECT hotel_id, COUNT(DISTINCT technician_profile_id) AS cnt
    FROM public.technician_access_requests WHERE status = 'approved' GROUP BY hotel_id
  ) tc ON tc.hotel_id = h.id
  LEFT JOIN (
    SELECT hotel_id, COUNT(*) AS cnt FROM public.sub_accounts WHERE is_active = true GROUP BY hotel_id
  ) sa ON sa.hotel_id = h.id
  ORDER BY sess.last_login DESC NULLS LAST;
END;
$$;
