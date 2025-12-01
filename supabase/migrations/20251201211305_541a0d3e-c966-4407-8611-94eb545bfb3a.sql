
-- Corriger les fonctions avec search_path pour la sécurité
CREATE OR REPLACE FUNCTION cleanup_inactive_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_sessions 
  SET is_active = false 
  WHERE is_active = true 
  AND last_activity < NOW() - INTERVAL '24 hours';
  
  UPDATE hotel_access_sessions
  SET is_active = false
  WHERE is_active = true
  AND expires_at < NOW();
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_user_old_sessions(p_user_id uuid, p_current_session_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
