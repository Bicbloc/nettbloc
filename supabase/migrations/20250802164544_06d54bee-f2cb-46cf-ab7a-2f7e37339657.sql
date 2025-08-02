-- NETTOYAGE URGENT - DOUBLONS DETECTES
-- Supprimer TOUS les codes d'accès pour cet hôtel
DELETE FROM public.housekeeper_access_codes WHERE hotel_id = '8925d462-e1c8-4699-bcbe-cb16e5d707c1';

-- Supprimer TOUTES les femmes de chambre pour cet hôtel
DELETE FROM public.housekeepers WHERE hotel_id = '8925d462-e1c8-4699-bcbe-cb16e5d707c1';

-- Nettoyer tous les tokens
DELETE FROM public.housekeeper_tokens WHERE user_id = '6f0b2a40-afe8-4a61-96c5-63435877e6e6';