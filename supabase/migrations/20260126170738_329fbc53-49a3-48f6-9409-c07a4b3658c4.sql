-- Corriger les vues pour utiliser security_invoker au lieu de security_definer
-- Cela permet aux vues d'utiliser les permissions de l'utilisateur appelant

ALTER VIEW public.audit_logs_enriched SET (security_invoker = on);
ALTER VIEW public.sessions_enriched SET (security_invoker = on);
ALTER VIEW public.activities_enriched SET (security_invoker = on);
ALTER VIEW public.daily_logs_enriched SET (security_invoker = on);
ALTER VIEW public.all_users_view SET (security_invoker = on);
ALTER VIEW public.access_codes_enriched SET (security_invoker = on);
ALTER VIEW public.hotels_stats_view SET (security_invoker = on);