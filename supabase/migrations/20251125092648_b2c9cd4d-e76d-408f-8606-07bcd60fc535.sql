-- Étape 1: Ajouter la politique RLS manquante sur housekeeper_access_requests
-- Permet aux femmes de chambre de voir leurs propres demandes d'accès
CREATE POLICY "Housekeepers can view their own access requests"
ON public.housekeeper_access_requests FOR SELECT
USING (housekeeper_profile_id = public.get_housekeeper_profile_id());

-- Étape 2: Nettoyer les doublons de demandes "pending" pour HTL904
-- Garder uniquement la demande la plus récente pour chaque combinaison housekeeper/hotel
DELETE FROM public.housekeeper_access_requests
WHERE id IN (
  SELECT har.id
  FROM public.housekeeper_access_requests har
  INNER JOIN (
    SELECT 
      housekeeper_profile_id,
      hotel_id,
      status,
      MAX(requested_at) as latest_request
    FROM public.housekeeper_access_requests
    WHERE status = 'pending'
    GROUP BY housekeeper_profile_id, hotel_id, status
    HAVING COUNT(*) > 1
  ) duplicates 
  ON har.housekeeper_profile_id = duplicates.housekeeper_profile_id
    AND har.hotel_id = duplicates.hotel_id
    AND har.status = duplicates.status
    AND har.requested_at < duplicates.latest_request
);