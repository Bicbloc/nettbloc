-- Create a secure function to log housekeeper/admin-facing actions into notifications
-- This bypasses RLS to allow housekeepers to notify hotel admins
CREATE OR REPLACE FUNCTION public.log_housekeeper_action(
  p_hotel_id uuid,
  p_type text,
  p_title text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_housekeeper_name text DEFAULT NULL,
  p_room_number text DEFAULT NULL,
  p_target_user_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_recipients uuid[] := ARRAY[]::uuid[];
  v_owner uuid;
  v_cnt integer := 0;
  v_title text;
  v_desc text;
BEGIN
  -- Resolve recipients: explicit target or all admins for the hotel
  IF p_target_user_id IS NOT NULL THEN
    v_recipients := ARRAY[p_target_user_id];
  ELSE
    -- Owner
    SELECT user_id INTO v_owner FROM public.hotels WHERE id = p_hotel_id;
    IF v_owner IS NOT NULL THEN
      v_recipients := array_append(v_recipients, v_owner);
    END IF;
    -- Additional admins via hotel_users
    v_recipients := v_recipients || ARRAY(
      SELECT DISTINCT hu.user_id
      FROM public.hotel_users hu
      WHERE hu.hotel_id = p_hotel_id
    );
  END IF;

  -- Defaults based on type
  v_title := COALESCE(p_title,
    CASE p_type
      WHEN 'housekeeper_connected' THEN 'Connexion femme de chambre'
      WHEN 'room_assigned' THEN 'Assignation de chambre'
      WHEN 'cleaning-start' THEN 'Début nettoyage'
      WHEN 'cleaning-end' THEN 'Fin nettoyage'
      WHEN 'housekeeper_access_request' THEN 'Demande d\'accès'
      WHEN 'access_approved' THEN 'Accès approuvé'
      ELSE initcap(replace(p_type, '_', ' '))
    END
  );

  v_desc := COALESCE(p_description,
    CASE p_type
      WHEN 'housekeeper_connected' THEN coalesce(p_housekeeper_name, 'Une femme de chambre') || ' s\'est connectée'
      WHEN 'room_assigned' THEN 'Chambre ' || coalesce(p_room_number, '?') || ' assignée à ' || coalesce(p_housekeeper_name, '?')
      WHEN 'cleaning-start' THEN 'Nettoyage démarré pour la chambre ' || coalesce(p_room_number, '?') || ' par ' || coalesce(p_housekeeper_name, '?')
      WHEN 'cleaning-end' THEN 'Nettoyage terminé pour la chambre ' || coalesce(p_room_number, '?') || ' par ' || coalesce(p_housekeeper_name, '?')
      WHEN 'housekeeper_access_request' THEN coalesce(p_housekeeper_name, 'Une femme de chambre') || ' demande l\'accès'
      WHEN 'access_approved' THEN 'Accès approuvé pour ' || coalesce(p_housekeeper_name, 'la femme de chambre')
      ELSE v_title
    END
  );

  IF v_recipients IS NULL OR array_length(v_recipients, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- Insert one notification per recipient
  INSERT INTO public.notifications (user_id, hotel_id, title, description, type, housekeeper_name, room_number, user_type, is_read)
  SELECT uid, p_hotel_id, v_title, v_desc, p_type, p_housekeeper_name, p_room_number, 'admin', false
  FROM unnest(v_recipients) AS t(uid);

  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  RETURN COALESCE(v_cnt, 0);
END;
$$;
