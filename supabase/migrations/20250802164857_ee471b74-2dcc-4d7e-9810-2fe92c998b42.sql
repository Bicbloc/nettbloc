-- NETTOYAGE COMPLET AVEC GESTION DES CONTRAINTES
-- Supprimer d'abord les dépendances
DELETE FROM public.room_status_updates;

-- Supprimer tous les codes d'accès
DELETE FROM public.housekeeper_access_codes;

-- Nettoyer tous les tokens
DELETE FROM public.housekeeper_tokens;

-- Supprimer toutes les femmes de chambre  
DELETE FROM public.housekeepers;