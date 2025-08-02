-- NETTOYAGE COMPLET IMMEDIAT
-- Supprimer tous les codes d'accès pour cet hôtel
DELETE FROM public.housekeeper_access_codes WHERE hotel_id = '8925d462-e1c8-4699-bcbe-cb16e5d707c1';

-- Supprimer toutes les femmes de chambre pour cet hôtel
DELETE FROM public.housekeepers WHERE hotel_id = '8925d462-e1c8-4699-bcbe-cb16e5d707c1';

-- Supprimer tous les tokens de femmes de chambre pour cet utilisateur
DELETE FROM public.housekeeper_tokens WHERE user_id = '6f0b2a40-afe8-4a61-96c5-63435877e6e6';

-- Nettoyer les sessions de femmes de chambre orphelines
DELETE FROM public.user_sessions WHERE hotel_id = '8925d462-e1c8-4699-bcbe-cb16e5d707c1' AND user_type = 'housekeeper';