-- Phase 1: Fix RLS Security Issues

-- 1.1 Fix linen_types - restrict visibility to hotel owners and their housekeepers
DROP POLICY IF EXISTS "Hotel owners can manage linen types" ON linen_types;
DROP POLICY IF EXISTS "Users can view their hotel linen types" ON linen_types;

CREATE POLICY "Hotel owners can manage linen types" ON linen_types
  FOR ALL USING (
    hotel_id IN (SELECT id FROM hotels WHERE user_id = auth.uid())
  );

CREATE POLICY "Housekeepers can view their hotel linen types" ON linen_types
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM hotel_access_sessions has
      WHERE has.hotel_id = linen_types.hotel_id
        AND has.housekeeper_profile_id = get_housekeeper_profile_id()
        AND has.is_active = true
        AND has.expires_at > now()
    )
  );

-- 1.2 Fix room_status_updates if exists - add proper restrictions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_status_updates') THEN
    -- Drop existing permissive policy if exists
    DROP POLICY IF EXISTS "Anyone can insert room status updates" ON room_status_updates;
    
    -- Create restrictive INSERT policy
    EXECUTE 'CREATE POLICY "Authorized users can insert room status updates" ON room_status_updates
      FOR INSERT WITH CHECK (
        hotel_id IN (SELECT id FROM hotels WHERE user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM hotel_access_sessions has
          WHERE has.hotel_id = room_status_updates.hotel_id
            AND has.housekeeper_profile_id = get_housekeeper_profile_id()
            AND has.is_active = true
        )
      )';
  END IF;
END $$;

-- 1.3 Add cleaning type migration - normalize old values
UPDATE rooms SET cleaning_type = 'a_blanc' WHERE cleaning_type = 'full';
UPDATE rooms SET cleaning_type = 'recouche' WHERE cleaning_type = 'quick';