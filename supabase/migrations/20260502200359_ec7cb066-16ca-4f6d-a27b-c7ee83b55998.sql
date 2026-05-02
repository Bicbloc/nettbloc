-- P0.1: Sécuriser les vues SECURITY DEFINER (forcer security_invoker)
ALTER VIEW IF EXISTS public.all_users_view SET (security_invoker = on);
ALTER VIEW IF EXISTS public.sessions_enriched SET (security_invoker = on);
ALTER VIEW IF EXISTS public.hotels_stats_view SET (security_invoker = on);

-- P0.2: Restreindre les policies INSERT trop permissives à des utilisateurs authentifiés
-- staff_timesheets : seul un housekeeper authentifié devrait pouvoir insérer son timesheet
DROP POLICY IF EXISTS "Housekeepers can insert own timesheets" ON public.staff_timesheets;
CREATE POLICY "Housekeepers can insert own timesheets"
ON public.staff_timesheets
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- linen_training_samples : restreindre aux authentifiés
DROP POLICY IF EXISTS "Allow housekeepers to insert training samples" ON public.linen_training_samples;
CREATE POLICY "Allow authenticated to insert training samples"
ON public.linen_training_samples
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- password_reset_logs : conserver l'accès anonyme (utile pour le flow de reset) mais limiter via rate-friendly check
-- On garde la policy ouverte car nécessaire avant authentification, mais on documente.
-- (no-op intentionnel: un reset est demandé sans session active)

-- daily_action_logs : restreindre aux authentifiés
DROP POLICY IF EXISTS "Allow all inserts to action logs" ON public.daily_action_logs;
CREATE POLICY "Authenticated can insert action logs"
ON public.daily_action_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- hotel_access_sessions : conservé en anonyme car nécessaire pour la connexion par code housekeeper (avant session auth)
-- (no-op intentionnel)
