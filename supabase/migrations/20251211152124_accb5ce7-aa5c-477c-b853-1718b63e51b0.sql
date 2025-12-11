-- Ajouter une politique permettant aux femmes de chambre d'accéder à leurs assignations via sessions d'accès
-- Cette politique permet l'accès anonyme si une session active existe pour l'hôtel

CREATE POLICY "Housekeepers can view assignments through access sessions"
ON public.assignments
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.hotel_access_sessions has
    WHERE has.hotel_id = assignments.hotel_id
      AND has.is_active = true
      AND has.expires_at > now()
  )
);

-- Politique pour mettre à jour les assignations via sessions d'accès
CREATE POLICY "Housekeepers can update assignments through access sessions"
ON public.assignments
FOR UPDATE
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.hotel_access_sessions has
    WHERE has.hotel_id = assignments.hotel_id
      AND has.is_active = true
      AND has.expires_at > now()
  )
);

-- Politique pour voir les chambres via sessions (renforcer si nécessaire)
DROP POLICY IF EXISTS "Anonymous can view rooms with valid session" ON public.rooms;
CREATE POLICY "Anonymous can view rooms with valid session"
ON public.rooms
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.hotel_access_sessions has
    WHERE has.hotel_id = rooms.hotel_id
      AND has.is_active = true
      AND has.expires_at > now()
  )
);