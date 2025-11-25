-- Ajouter une politique RLS pour permettre aux femmes de chambre de voir leurs propres assignations
CREATE POLICY "Housekeepers can view their own assignments"
ON public.assignments FOR SELECT
USING (
  housekeeper_id = get_housekeeper_profile_id()::text
  OR EXISTS (
    SELECT 1 FROM public.hotel_access_sessions has
    WHERE has.hotel_id = assignments.hotel_id
    AND has.is_active = true
    AND has.expires_at > now()
  )
);

-- Ajouter une politique RLS pour permettre aux femmes de chambre authentifiées de voir les chambres
CREATE POLICY "Authenticated housekeepers can view rooms"
ON public.rooms FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.housekeeper_access_requests har
    WHERE har.hotel_id = rooms.hotel_id
    AND har.housekeeper_profile_id = get_housekeeper_profile_id()
    AND har.status = 'approved'
  )
);

-- Nettoyer les doublons dans housekeeper_access_requests
-- Garder uniquement la demande la plus récente pour chaque combinaison housekeeper_profile_id + hotel_id
DELETE FROM public.housekeeper_access_requests
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY housekeeper_profile_id, hotel_id 
             ORDER BY created_at DESC
           ) as rn
    FROM public.housekeeper_access_requests
    WHERE status = 'approved'
  ) sub
  WHERE rn > 1
);