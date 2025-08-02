-- NETTOYAGE TOTAL - Suppression complète de toutes les données des femmes de chambre
-- Supprimer d'abord toutes les dépendances
DELETE FROM public.room_status_updates;
DELETE FROM public.housekeeper_tokens;
DELETE FROM public.housekeeper_access_codes;

-- Supprimer toutes les femmes de chambre
DELETE FROM public.housekeepers;

-- Nettoyer les sessions d'hôtel (vider les données des femmes de chambre)
UPDATE public.hotel_sessions 
SET 
  housekeeper_names = '[]'::jsonb,
  housekeeper_assignments = '{}'::jsonb,
  is_distributed = false
WHERE is_active = true;