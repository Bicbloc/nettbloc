-- Permettre aux utilisateurs anonymes de créer des sessions d'accès hôtel
CREATE POLICY "Anonymous can create hotel access sessions"
ON public.hotel_access_sessions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Permettre la lecture des sessions actives à tous
CREATE POLICY "Anyone can view active sessions"
ON public.hotel_access_sessions
FOR SELECT
TO anon, authenticated
USING (is_active = true AND expires_at > now());

-- Permettre la mise à jour des sessions actives
CREATE POLICY "Anyone can update active sessions"
ON public.hotel_access_sessions
FOR UPDATE
TO anon, authenticated
USING (is_active = true);