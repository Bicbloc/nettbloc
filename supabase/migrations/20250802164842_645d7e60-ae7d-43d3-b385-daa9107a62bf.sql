-- NETTOYAGE COMPLET - Suppression de toutes les femmes de chambre et codes d'accès
-- Supprimer tous les codes d'accès
DELETE FROM public.housekeeper_access_codes;

-- Supprimer toutes les femmes de chambre  
DELETE FROM public.housekeepers;

-- Nettoyer tous les tokens
DELETE FROM public.housekeeper_tokens;