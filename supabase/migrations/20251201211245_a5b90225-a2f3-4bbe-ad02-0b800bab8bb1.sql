
-- Fonction pour nettoyer les sessions inactives automatiquement
CREATE OR REPLACE FUNCTION cleanup_inactive_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Désactiver les sessions sans activité depuis plus de 24h
  UPDATE user_sessions 
  SET is_active = false 
  WHERE is_active = true 
  AND last_activity < NOW() - INTERVAL '24 hours';
  
  -- Désactiver les sessions hotel_access expirées
  UPDATE hotel_access_sessions
  SET is_active = false
  WHERE is_active = true
  AND expires_at < NOW();
END;
$$;

-- Créer une fonction RPC pour nettoyer les anciennes sessions d'un utilisateur
CREATE OR REPLACE FUNCTION cleanup_user_old_sessions(p_user_id uuid, p_current_session_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_current_session_id IS NOT NULL THEN
    UPDATE user_sessions 
    SET is_active = false 
    WHERE user_id = p_user_id 
    AND is_active = true
    AND id != p_current_session_id;
  ELSE
    UPDATE user_sessions 
    SET is_active = false 
    WHERE user_id = p_user_id 
    AND is_active = true;
  END IF;
END;
$$;

-- Nettoyer immédiatement les sessions dupliquées existantes
-- Garder seulement la session la plus récente par utilisateur
WITH latest_sessions AS (
  SELECT DISTINCT ON (user_id) id
  FROM user_sessions
  WHERE is_active = true
  ORDER BY user_id, last_activity DESC
)
UPDATE user_sessions
SET is_active = false
WHERE is_active = true
AND id NOT IN (SELECT id FROM latest_sessions);
