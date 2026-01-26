-- Correction des données existantes : ajouter les femmes de chambre approuvées manquantes dans housekeepers
-- En évitant les doublons via la contrainte unique sur (hotel_id, lower(name))
INSERT INTO public.housekeepers (hotel_id, name, access_code, user_id, is_active)
SELECT 
  har.hotel_id,
  hp.name,
  har.hotel_code || '-' || UPPER(LEFT(hp.name, 3)) || '-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0'),
  hp.id,
  true
FROM public.housekeeper_access_requests har
JOIN public.housekeeper_profiles hp ON hp.id = har.housekeeper_profile_id
WHERE har.status = 'approved'
AND NOT EXISTS (
  SELECT 1 FROM public.housekeepers h 
  WHERE h.hotel_id = har.hotel_id 
  AND LOWER(h.name) = LOWER(hp.name)
);