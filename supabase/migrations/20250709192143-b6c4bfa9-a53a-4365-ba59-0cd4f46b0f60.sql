-- Activer realtime sur la table notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- S'assurer que la table notifications a REPLICA IDENTITY FULL pour le realtime
ALTER TABLE notifications REPLICA IDENTITY FULL;