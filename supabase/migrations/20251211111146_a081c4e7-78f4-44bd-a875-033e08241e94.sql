-- =====================================================
-- PHASE 2: SECURITY FIXES - Add SET search_path to functions
-- =====================================================

-- 1. Fix calculate_level function
CREATE OR REPLACE FUNCTION public.calculate_level(total_xp integer)
RETURNS integer
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  RETURN FLOOR(SQRT(total_xp / 100.0)) + 1;
END;
$function$;

-- 2. Fix update_hotel_rooms_registry_updated_at function
CREATE OR REPLACE FUNCTION public.update_hotel_rooms_registry_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 3. Fix log_activity function
CREATE OR REPLACE FUNCTION public.log_activity(
  p_hotel_id uuid, 
  p_activity_type text, 
  p_entity_type text, 
  p_entity_id uuid, 
  p_actor_name text DEFAULT NULL::text, 
  p_actor_type text DEFAULT 'system'::text, 
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  activity_id uuid;
BEGIN
  INSERT INTO public.activities (
    hotel_id, activity_type, entity_type, entity_id, 
    actor_name, actor_type, details
  ) VALUES (
    p_hotel_id, p_activity_type, p_entity_type, p_entity_id,
    p_actor_name, p_actor_type, p_details
  ) RETURNING id INTO activity_id;
  
  RETURN activity_id;
END;
$function$;

-- 4. Fix sync_access_codes_with_housekeepers function
CREATE OR REPLACE FUNCTION public.sync_access_codes_with_housekeepers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  housekeeper_record RECORD;
  synced_count INTEGER := 0;
BEGIN
  FOR housekeeper_record IN 
    SELECT h.id, h.hotel_id, h.name, h.access_code
    FROM public.housekeepers h
    WHERE h.is_active = true 
      AND h.access_code IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.housekeeper_access_codes hac 
        WHERE hac.housekeeper_id = h.id AND hac.is_active = true
      )
  LOOP
    INSERT INTO public.housekeeper_access_codes (
      hotel_id, housekeeper_id, access_code, is_active, expires_at, created_by
    ) VALUES (
      housekeeper_record.hotel_id, housekeeper_record.id, housekeeper_record.access_code,
      true, NULL, (SELECT user_id FROM public.hotels WHERE id = housekeeper_record.hotel_id)
    )
    ON CONFLICT (access_code) DO NOTHING;
    
    synced_count := synced_count + 1;
  END LOOP;
  
  RETURN synced_count;
END;
$function$;

-- 5. Fix generate_missing_access_codes_for_hotel function
CREATE OR REPLACE FUNCTION public.generate_missing_access_codes_for_hotel(p_hotel_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  housekeeper_record RECORD;
  new_access_code TEXT;
  generated_count INTEGER := 0;
  hotel_code TEXT;
BEGIN
  SELECT h.hotel_code INTO hotel_code FROM public.hotels h WHERE h.id = p_hotel_id;
  
  IF hotel_code IS NULL THEN
    RAISE EXCEPTION 'Code hôtel manquant pour %', p_hotel_id;
  END IF;
  
  FOR housekeeper_record IN 
    SELECT h.id, h.hotel_id, h.name
    FROM public.housekeepers h
    WHERE h.hotel_id = p_hotel_id 
      AND h.is_active = true 
      AND (h.access_code IS NULL OR h.access_code = '')
  LOOP
    new_access_code := public.generate_housekeeper_access_code_simple(p_hotel_id, housekeeper_record.name);
    
    UPDATE public.housekeepers SET access_code = new_access_code WHERE id = housekeeper_record.id;
    
    INSERT INTO public.housekeeper_access_codes (
      hotel_id, housekeeper_id, access_code, is_active, expires_at, created_by
    ) VALUES (
      housekeeper_record.hotel_id, housekeeper_record.id, new_access_code, true, NULL,
      (SELECT user_id FROM public.hotels WHERE id = p_hotel_id)
    );
    
    generated_count := generated_count + 1;
  END LOOP;
  
  RETURN generated_count;
END;
$function$;

-- 6. Fix fix_access_code_inconsistencies function
CREATE OR REPLACE FUNCTION public.fix_access_code_inconsistencies()
RETURNS TABLE(hotel_name text, hotel_code text, fixed_housekeepers integer)
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
DECLARE
  hotel_record RECORD;
  fixed_count integer;
BEGIN
  FOR hotel_record IN 
    SELECT h.id, h.name, h.hotel_code FROM hotels h WHERE h.hotel_code IS NOT NULL
  LOOP
    UPDATE housekeepers 
    SET access_code = hotel_record.hotel_code || SUBSTRING(access_code FROM POSITION('-' IN access_code))
    WHERE hotel_id = hotel_record.id 
      AND access_code IS NOT NULL
      AND access_code NOT LIKE (hotel_record.hotel_code || '-%')
      AND POSITION('-' IN access_code) > 0;
    
    GET DIAGNOSTICS fixed_count = ROW_COUNT;
    
    IF fixed_count > 0 THEN
      RETURN QUERY SELECT hotel_record.name, hotel_record.hotel_code, fixed_count;
    END IF;
  END LOOP;
END;
$function$;

-- 7. Fix create_hotel_incident_defaults function
CREATE OR REPLACE FUNCTION public.create_hotel_incident_defaults(p_hotel_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_plomberie_id uuid;
  v_electricite_id uuid;
  v_mobilier_id uuid;
  v_menage_id uuid;
  v_climatisation_id uuid;
BEGIN
  INSERT INTO public.staff_roles (hotel_id, name, description, is_system, is_active)
  VALUES 
    (p_hotel_id, 'Femme de chambre', 'Personnel d''entretien des chambres', false, true),
    (p_hotel_id, 'Technicien', 'Personnel technique et maintenance', false, true),
    (p_hotel_id, 'Équipier', 'Membre d''équipe polyvalent', false, true)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.incident_categories (hotel_id, name, icon, display_order, is_system, is_active)
  VALUES 
    (p_hotel_id, 'Plomberie', '🚰', 1, false, true),
    (p_hotel_id, 'Électricité', '⚡', 2, false, true),
    (p_hotel_id, 'Mobilier', '🛏️', 3, false, true),
    (p_hotel_id, 'Ménage', '🧹', 4, false, true),
    (p_hotel_id, 'Climatisation', '❄️', 5, false, true)
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_plomberie_id FROM public.incident_categories WHERE hotel_id = p_hotel_id AND name = 'Plomberie' LIMIT 1;
  SELECT id INTO v_electricite_id FROM public.incident_categories WHERE hotel_id = p_hotel_id AND name = 'Électricité' LIMIT 1;
  SELECT id INTO v_mobilier_id FROM public.incident_categories WHERE hotel_id = p_hotel_id AND name = 'Mobilier' LIMIT 1;
  SELECT id INTO v_menage_id FROM public.incident_categories WHERE hotel_id = p_hotel_id AND name = 'Ménage' LIMIT 1;
  SELECT id INTO v_climatisation_id FROM public.incident_categories WHERE hotel_id = p_hotel_id AND name = 'Climatisation' LIMIT 1;

  IF v_plomberie_id IS NOT NULL THEN
    INSERT INTO public.incident_items (hotel_id, category_id, name, display_order, is_system, is_active)
    VALUES 
      (p_hotel_id, v_plomberie_id, 'WC', 1, false, true),
      (p_hotel_id, v_plomberie_id, 'Lavabo', 2, false, true),
      (p_hotel_id, v_plomberie_id, 'Douche', 3, false, true),
      (p_hotel_id, v_plomberie_id, 'Robinetterie', 4, false, true)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_electricite_id IS NOT NULL THEN
    INSERT INTO public.incident_items (hotel_id, category_id, name, display_order, is_system, is_active)
    VALUES 
      (p_hotel_id, v_electricite_id, 'Prise électrique', 1, false, true),
      (p_hotel_id, v_electricite_id, 'Interrupteur', 2, false, true),
      (p_hotel_id, v_electricite_id, 'Éclairage', 3, false, true),
      (p_hotel_id, v_electricite_id, 'Téléphone', 4, false, true)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_mobilier_id IS NOT NULL THEN
    INSERT INTO public.incident_items (hotel_id, category_id, name, display_order, is_system, is_active)
    VALUES 
      (p_hotel_id, v_mobilier_id, 'Lit', 1, false, true),
      (p_hotel_id, v_mobilier_id, 'Armoire', 2, false, true),
      (p_hotel_id, v_mobilier_id, 'Bureau', 3, false, true),
      (p_hotel_id, v_mobilier_id, 'Chaise', 4, false, true)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_menage_id IS NOT NULL THEN
    INSERT INTO public.incident_items (hotel_id, category_id, name, display_order, is_system, is_active)
    VALUES 
      (p_hotel_id, v_menage_id, 'Draps', 1, false, true),
      (p_hotel_id, v_menage_id, 'Serviettes', 2, false, true),
      (p_hotel_id, v_menage_id, 'Produits d''accueil', 3, false, true),
      (p_hotel_id, v_menage_id, 'Poubelle', 4, false, true)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_climatisation_id IS NOT NULL THEN
    INSERT INTO public.incident_items (hotel_id, category_id, name, display_order, is_system, is_active)
    VALUES 
      (p_hotel_id, v_climatisation_id, 'Climatisation', 1, false, true),
      (p_hotel_id, v_climatisation_id, 'Chauffage', 2, false, true),
      (p_hotel_id, v_climatisation_id, 'Ventilation', 3, false, true),
      (p_hotel_id, v_climatisation_id, 'Thermostat', 4, false, true)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.incident_types (hotel_id, name, color, severity, is_system, is_active)
  VALUES 
    (p_hotel_id, 'Cassé / En panne', '#ef4444', 'high', false, true),
    (p_hotel_id, 'Manquant', '#f97316', 'medium', false, true),
    (p_hotel_id, 'Sale / À nettoyer', '#eab308', 'low', false, true),
    (p_hotel_id, 'Usé / À remplacer', '#3b82f6', 'medium', false, true),
    (p_hotel_id, 'Autre', '#6b7280', 'low', false, true)
  ON CONFLICT DO NOTHING;
END;
$function$;

-- 8. Fix add_housekeeper_xp function
CREATE OR REPLACE FUNCTION public.add_housekeeper_xp(
  p_housekeeper_id uuid, 
  p_hotel_id uuid, 
  p_xp_amount integer, 
  p_room_cleaned boolean DEFAULT false, 
  p_is_perfect boolean DEFAULT false, 
  p_is_fast boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
DECLARE
  v_level_record RECORD;
  v_new_level INTEGER;
  v_level_up BOOLEAN := false;
  v_new_badges TEXT[] := ARRAY[]::TEXT[];
BEGIN
  INSERT INTO public.housekeeper_levels (
    housekeeper_id, hotel_id, total_xp, rooms_cleaned_count,
    perfect_rooms_count, speed_bonus_count, last_activity_date, current_streak
  ) VALUES (
    p_housekeeper_id, p_hotel_id, p_xp_amount,
    CASE WHEN p_room_cleaned THEN 1 ELSE 0 END,
    CASE WHEN p_is_perfect THEN 1 ELSE 0 END,
    CASE WHEN p_is_fast THEN 1 ELSE 0 END,
    CURRENT_DATE, 1
  )
  ON CONFLICT (housekeeper_id, hotel_id) DO UPDATE SET
    total_xp = housekeeper_levels.total_xp + p_xp_amount,
    rooms_cleaned_count = housekeeper_levels.rooms_cleaned_count + CASE WHEN p_room_cleaned THEN 1 ELSE 0 END,
    perfect_rooms_count = housekeeper_levels.perfect_rooms_count + CASE WHEN p_is_perfect THEN 1 ELSE 0 END,
    speed_bonus_count = housekeeper_levels.speed_bonus_count + CASE WHEN p_is_fast THEN 1 ELSE 0 END,
    current_streak = CASE 
      WHEN housekeeper_levels.last_activity_date = CURRENT_DATE - INTERVAL '1 day' THEN housekeeper_levels.current_streak + 1
      WHEN housekeeper_levels.last_activity_date = CURRENT_DATE THEN housekeeper_levels.current_streak
      ELSE 1
    END,
    best_streak = GREATEST(housekeeper_levels.best_streak,
      CASE 
        WHEN housekeeper_levels.last_activity_date = CURRENT_DATE - INTERVAL '1 day' THEN housekeeper_levels.current_streak + 1
        WHEN housekeeper_levels.last_activity_date = CURRENT_DATE THEN housekeeper_levels.current_streak
        ELSE 1
      END
    ),
    last_activity_date = CURRENT_DATE,
    updated_at = now()
  RETURNING * INTO v_level_record;

  v_new_level := calculate_level(v_level_record.total_xp);
  
  IF v_new_level > v_level_record.current_level THEN
    v_level_up := true;
    UPDATE public.housekeeper_levels SET current_level = v_new_level
    WHERE housekeeper_id = p_housekeeper_id AND hotel_id = p_hotel_id;
  END IF;

  IF v_level_record.rooms_cleaned_count >= 1 AND NOT EXISTS (
    SELECT 1 FROM public.housekeeper_achievements WHERE housekeeper_id = p_housekeeper_id AND hotel_id = p_hotel_id AND badge_code = 'first_room'
  ) THEN
    INSERT INTO public.housekeeper_achievements (housekeeper_id, hotel_id, badge_code) VALUES (p_housekeeper_id, p_hotel_id, 'first_room') ON CONFLICT DO NOTHING;
    v_new_badges := array_append(v_new_badges, 'first_room');
  END IF;

  IF v_level_record.rooms_cleaned_count >= 10 AND NOT EXISTS (
    SELECT 1 FROM public.housekeeper_achievements WHERE housekeeper_id = p_housekeeper_id AND hotel_id = p_hotel_id AND badge_code = 'room_cleaner_10'
  ) THEN
    INSERT INTO public.housekeeper_achievements (housekeeper_id, hotel_id, badge_code) VALUES (p_housekeeper_id, p_hotel_id, 'room_cleaner_10') ON CONFLICT DO NOTHING;
    v_new_badges := array_append(v_new_badges, 'room_cleaner_10');
  END IF;

  IF v_level_record.rooms_cleaned_count >= 50 AND NOT EXISTS (
    SELECT 1 FROM public.housekeeper_achievements WHERE housekeeper_id = p_housekeeper_id AND hotel_id = p_hotel_id AND badge_code = 'room_cleaner_50'
  ) THEN
    INSERT INTO public.housekeeper_achievements (housekeeper_id, hotel_id, badge_code) VALUES (p_housekeeper_id, p_hotel_id, 'room_cleaner_50') ON CONFLICT DO NOTHING;
    v_new_badges := array_append(v_new_badges, 'room_cleaner_50');
  END IF;

  IF v_level_record.current_streak >= 3 AND NOT EXISTS (
    SELECT 1 FROM public.housekeeper_achievements WHERE housekeeper_id = p_housekeeper_id AND hotel_id = p_hotel_id AND badge_code = 'streak_3'
  ) THEN
    INSERT INTO public.housekeeper_achievements (housekeeper_id, hotel_id, badge_code) VALUES (p_housekeeper_id, p_hotel_id, 'streak_3') ON CONFLICT DO NOTHING;
    v_new_badges := array_append(v_new_badges, 'streak_3');
  END IF;

  RETURN jsonb_build_object(
    'total_xp', v_level_record.total_xp,
    'current_level', v_new_level,
    'level_up', v_level_up,
    'new_badges', v_new_badges,
    'current_streak', v_level_record.current_streak
  );
END;
$function$;

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_rooms_hotel_status ON public.rooms(hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_assignments_hotel_date ON public.assignments(hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_housekeepers_hotel_active ON public.housekeepers(hotel_id, is_active);
CREATE INDEX IF NOT EXISTS idx_daily_action_logs_hotel_date ON public.daily_action_logs(hotel_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read, created_at DESC);