-- Nettoyage complet des données existantes pour l'hôtel HTL002
DELETE FROM public.housekeeper_access_codes WHERE hotel_id = '8925d462-e1c8-4699-bcbe-cb16e5d707c1';
DELETE FROM public.housekeepers WHERE hotel_id = '8925d462-e1c8-4699-bcbe-cb16e5d707c1';
DELETE FROM public.housekeeper_tokens WHERE user_id = '6f0b2a40-afe8-4a61-96c5-63435877e6e6';