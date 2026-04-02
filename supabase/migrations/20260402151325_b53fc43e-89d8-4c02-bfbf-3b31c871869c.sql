
-- Nettoyage complet des données orphelines pour getgrass24@gmail.com
-- user_id: 7a667693-503d-4179-9e1e-ad43ccfdf9db
-- hotel_id: c37cb704-6224-4b73-bcf7-0fdb5e1790ae

-- 1. Supprimer les dépendances des housekeepers
DELETE FROM public.housekeeper_access_codes WHERE hotel_id = 'c37cb704-6224-4b73-bcf7-0fdb5e1790ae';
DELETE FROM public.housekeepers WHERE hotel_id = 'c37cb704-6224-4b73-bcf7-0fdb5e1790ae';

-- 2. Supprimer les données opérationnelles
DELETE FROM public.assignments WHERE hotel_id = 'c37cb704-6224-4b73-bcf7-0fdb5e1790ae';
DELETE FROM public.rooms WHERE hotel_id = 'c37cb704-6224-4b73-bcf7-0fdb5e1790ae';
DELETE FROM public.daily_action_logs WHERE hotel_id = 'c37cb704-6224-4b73-bcf7-0fdb5e1790ae';
DELETE FROM public.hotel_rooms_registry WHERE hotel_id = 'c37cb704-6224-4b73-bcf7-0fdb5e1790ae';

-- 3. Supprimer les données utilisateur
DELETE FROM public.hotel_sessions WHERE user_id = '7a667693-503d-4179-9e1e-ad43ccfdf9db';
DELETE FROM public.user_roles WHERE user_id = '7a667693-503d-4179-9e1e-ad43ccfdf9db';

-- 4. Supprimer l'hôtel et le profil
DELETE FROM public.hotels WHERE id = 'c37cb704-6224-4b73-bcf7-0fdb5e1790ae';
DELETE FROM public.profiles WHERE id = '7a667693-503d-4179-9e1e-ad43ccfdf9db';
