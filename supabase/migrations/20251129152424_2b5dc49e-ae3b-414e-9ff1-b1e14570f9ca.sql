-- Activer REPLICA IDENTITY FULL pour les mises à jour complètes en temps réel
-- Ceci permet de recevoir toutes les données lors des événements UPDATE via realtime
ALTER TABLE public.assignments REPLICA IDENTITY FULL;
ALTER TABLE public.rooms REPLICA IDENTITY FULL;