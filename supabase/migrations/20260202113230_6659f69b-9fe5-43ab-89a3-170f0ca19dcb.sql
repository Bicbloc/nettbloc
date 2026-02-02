-- Mise à jour de la vue sessions_enriched pour inclure gouvernantes
DROP VIEW IF EXISTS public.sessions_enriched;

CREATE VIEW public.sessions_enriched AS
-- Sessions admin et femmes de chambre depuis user_sessions
SELECT 
    s.id,
    s.user_id,
    s.user_name,
    s.user_type,
    s.hotel_id,
    s.login_time,
    s.last_activity,
    s.is_active,
    s.session_token,
    s.housekeeper_id,
    h.name AS hotel_name,
    h.hotel_code,
    p.email AS user_email
FROM user_sessions s
LEFT JOIN hotels h ON s.hotel_id = h.id
LEFT JOIN profiles p ON s.user_id = p.id

UNION ALL

-- Sessions gouvernantes depuis governess_hotel_sessions
SELECT 
    ghs.id,
    ghs.governess_profile_id AS user_id,
    gp.name AS user_name,
    'governess'::text AS user_type,
    ghs.hotel_id,
    ghs.started_at AS login_time,
    COALESCE(ghs.ended_at, ghs.started_at) AS last_activity,
    ghs.is_active,
    NULL::text AS session_token,
    NULL::text AS housekeeper_id,
    ghs.hotel_name,
    h.hotel_code,
    gp.email AS user_email
FROM governess_hotel_sessions ghs
LEFT JOIN governess_profiles gp ON ghs.governess_profile_id = gp.id
LEFT JOIN hotels h ON ghs.hotel_id = h.id;

-- Permettre la lecture de la vue pour les admins
GRANT SELECT ON public.sessions_enriched TO authenticated;