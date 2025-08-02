-- NETTOYAGE TOTAL ET COMPLET
-- Supprimer toutes les dépendances et données
DELETE FROM public.room_status_updates;
DELETE FROM public.housekeeper_tokens;
DELETE FROM public.housekeeper_access_codes;
DELETE FROM public.housekeepers;

-- Nettoyer complètement les sessions d'hôtel
DELETE FROM public.hotel_sessions WHERE is_active = true;

-- Nettoyer les sessions utilisateur actives
UPDATE public.user_sessions SET is_active = false WHERE is_active = true;