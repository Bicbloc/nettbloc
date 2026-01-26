-- ============================================================
-- Phase 1 & 2: Index, vues enrichies et vue utilisateurs consolidée
-- ============================================================

-- Index manquants sur admin_audit_log pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_user_id ON public.admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_user_id ON public.admin_audit_log(target_user_id);

-- Vue enrichie pour les logs d'audit (élimine les N+1 queries)
CREATE OR REPLACE VIEW public.audit_logs_enriched AS
SELECT 
  al.id,
  al.admin_user_id,
  al.action,
  al.target_user_id,
  al.details,
  al.created_at,
  admin_p.email AS admin_email,
  admin_p.company_name AS admin_company,
  target_p.email AS target_email,
  target_p.company_name AS target_company
FROM public.admin_audit_log al
LEFT JOIN public.profiles admin_p ON al.admin_user_id = admin_p.id
LEFT JOIN public.profiles target_p ON al.target_user_id = target_p.id;

-- Vue enrichie pour les sessions utilisateur (élimine les N+1 queries)
CREATE OR REPLACE VIEW public.sessions_enriched AS
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
FROM public.user_sessions s
LEFT JOIN public.hotels h ON s.hotel_id = h.id
LEFT JOIN public.profiles p ON s.user_id = p.id;

-- Vue enrichie pour les activités (élimine les N+1 queries)
CREATE OR REPLACE VIEW public.activities_enriched AS
SELECT 
  a.id,
  a.hotel_id,
  a.activity_type,
  a.entity_type,
  a.entity_id,
  a.actor_name,
  a.actor_type,
  a.details,
  a.timestamp,
  a.created_at,
  h.name AS hotel_name,
  h.hotel_code
FROM public.activities a
LEFT JOIN public.hotels h ON a.hotel_id = h.id;

-- Vue enrichie pour les logs journaliers (élimine les N+1 queries)
CREATE OR REPLACE VIEW public.daily_logs_enriched AS
SELECT 
  d.id,
  d.hotel_id,
  d.action_type,
  d.description,
  d.room_number,
  d.actor_name,
  d.actor_type,
  d.log_date,
  d.created_at,
  d.details,
  h.name AS hotel_name,
  h.hotel_code
FROM public.daily_action_logs d
LEFT JOIN public.hotels h ON d.hotel_id = h.id;

-- Vue consolidée de tous les utilisateurs (établissements, femmes de chambre, techniciens, gouvernantes)
-- Utilisation de TEXT pour la colonne role (pas l'enum app_role)
CREATE OR REPLACE VIEW public.all_users_view AS
-- Utilisateurs établissements (profiles)
SELECT 
  p.id,
  p.email,
  p.company_name AS name,
  'establishment'::text AS user_type,
  p.is_suspended,
  p.subscription_type,
  p.trial_end_date,
  p.created_at,
  NULL::uuid AS linked_hotel_id,
  NULL::text AS linked_hotel_name,
  COALESCE(
    (SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = p.id LIMIT 1),
    'user'
  ) AS role
FROM public.profiles p

UNION ALL

-- Femmes de chambre (avec profil)
SELECT 
  hp.id,
  hp.email,
  hp.name,
  'housekeeper'::text AS user_type,
  NOT hp.is_active AS is_suspended,
  NULL::text AS subscription_type,
  NULL::timestamp with time zone AS trial_end_date,
  hp.created_at,
  NULL::uuid AS linked_hotel_id,
  NULL::text AS linked_hotel_name,
  'staff'::text AS role
FROM public.housekeeper_profiles hp

UNION ALL

-- Techniciens (avec profil)
SELECT 
  tp.id,
  tp.email,
  tp.name,
  'technician'::text AS user_type,
  NOT tp.is_active AS is_suspended,
  NULL::text AS subscription_type,
  NULL::timestamp with time zone AS trial_end_date,
  tp.created_at,
  NULL::uuid AS linked_hotel_id,
  NULL::text AS linked_hotel_name,
  'staff'::text AS role
FROM public.technician_profiles tp

UNION ALL

-- Gouvernantes (avec profil)
SELECT 
  gp.id,
  gp.email,
  gp.name,
  'governess'::text AS user_type,
  NOT gp.is_active AS is_suspended,
  NULL::text AS subscription_type,
  NULL::timestamp with time zone AS trial_end_date,
  gp.created_at,
  NULL::uuid AS linked_hotel_id,
  NULL::text AS linked_hotel_name,
  'staff'::text AS role
FROM public.governess_profiles gp;

-- Vue enrichie des codes d'accès (élimine les N+1 queries)
CREATE OR REPLACE VIEW public.access_codes_enriched AS
SELECT 
  hac.id,
  hac.access_code,
  hac.is_active,
  hac.created_at,
  hac.used_at,
  hac.expires_at,
  hac.hotel_id,
  hac.housekeeper_id,
  hac.invited_name,
  h.name AS hotel_name,
  h.hotel_code,
  COALESCE(hk.name, hac.invited_name, 'Non assigné') AS housekeeper_name
FROM public.housekeeper_access_codes hac
LEFT JOIN public.hotels h ON hac.hotel_id = h.id
LEFT JOIN public.housekeepers hk ON hac.housekeeper_id = hk.id;

-- Vue enrichie des statistiques hôtels (élimine les N+1 queries)
CREATE OR REPLACE VIEW public.hotels_stats_view AS
SELECT 
  h.id,
  h.name,
  h.hotel_code,
  h.created_at,
  h.user_id,
  p.email AS owner_email,
  p.company_name AS owner_company,
  (SELECT COUNT(*) FROM public.housekeepers hk WHERE hk.hotel_id = h.id AND hk.is_active = true) AS housekeepers_count,
  (SELECT COUNT(*) FROM public.user_sessions us WHERE us.hotel_id = h.id AND us.is_active = true) AS active_sessions_count,
  (SELECT COUNT(*) FROM public.rooms r WHERE r.hotel_id = h.id) AS rooms_count
FROM public.hotels h
LEFT JOIN public.profiles p ON h.user_id = p.id;

-- Autoriser les utilisateurs authentifiés à accéder aux vues
GRANT SELECT ON public.audit_logs_enriched TO authenticated;
GRANT SELECT ON public.sessions_enriched TO authenticated;
GRANT SELECT ON public.activities_enriched TO authenticated;
GRANT SELECT ON public.daily_logs_enriched TO authenticated;
GRANT SELECT ON public.all_users_view TO authenticated;
GRANT SELECT ON public.access_codes_enriched TO authenticated;
GRANT SELECT ON public.hotels_stats_view TO authenticated;