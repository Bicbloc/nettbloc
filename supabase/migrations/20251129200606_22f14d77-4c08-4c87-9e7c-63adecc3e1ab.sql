-- Activer la réplication complète pour la table rooms
ALTER TABLE rooms REPLICA IDENTITY FULL;

-- Ajouter la table rooms à la publication realtime
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;