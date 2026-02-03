-- Create a helper function to check if user can access hotel data (owner OR sub-account)
CREATE OR REPLACE FUNCTION public.can_access_hotel(p_hotel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- User is the hotel owner
    SELECT 1 FROM hotels WHERE id = p_hotel_id AND user_id = auth.uid()
  ) OR EXISTS (
    -- User is an active sub-account linked to this hotel
    SELECT 1 FROM sub_accounts 
    WHERE hotel_id = p_hotel_id 
    AND user_id = auth.uid() 
    AND is_active = true
  )
$$;

-- Update RLS policies for hotel_rooms_registry
DROP POLICY IF EXISTS "Hotel owners can view their room registry" ON hotel_rooms_registry;
DROP POLICY IF EXISTS "Hotel owners can manage their room registry" ON hotel_rooms_registry;

CREATE POLICY "Users can view room registry" ON hotel_rooms_registry
  FOR SELECT USING (can_access_hotel(hotel_id));

CREATE POLICY "Users can manage room registry" ON hotel_rooms_registry
  FOR ALL USING (can_access_hotel(hotel_id));

-- Update RLS policies for housekeepers
DROP POLICY IF EXISTS "Users can manage housekeepers for their hotels" ON housekeepers;

CREATE POLICY "Users can manage housekeepers for their hotels" ON housekeepers
  FOR ALL USING (can_access_hotel(hotel_id));

-- Update RLS policies for hotel_cleaning_rules
DROP POLICY IF EXISTS "Hotel owners can view their rules" ON hotel_cleaning_rules;
DROP POLICY IF EXISTS "Hotel owners can create rules" ON hotel_cleaning_rules;
DROP POLICY IF EXISTS "Hotel owners can update their rules" ON hotel_cleaning_rules;
DROP POLICY IF EXISTS "Hotel owners can delete their rules" ON hotel_cleaning_rules;

CREATE POLICY "Users can view cleaning rules" ON hotel_cleaning_rules
  FOR SELECT USING (can_access_hotel(hotel_id));

CREATE POLICY "Users can create cleaning rules" ON hotel_cleaning_rules
  FOR INSERT WITH CHECK (can_access_hotel(hotel_id));

CREATE POLICY "Users can update cleaning rules" ON hotel_cleaning_rules
  FOR UPDATE USING (can_access_hotel(hotel_id));

CREATE POLICY "Users can delete cleaning rules" ON hotel_cleaning_rules
  FOR DELETE USING (can_access_hotel(hotel_id));

-- Update RLS policies for hotel_report_configs
DROP POLICY IF EXISTS "Hotel owners can manage their report configs" ON hotel_report_configs;
DROP POLICY IF EXISTS "Hotel users can view report configs" ON hotel_report_configs;

CREATE POLICY "Users can manage report configs" ON hotel_report_configs
  FOR ALL USING (can_access_hotel(hotel_id));

-- Update RLS for rooms table
DROP POLICY IF EXISTS "Users can view rooms" ON rooms;
DROP POLICY IF EXISTS "Users can insert rooms" ON rooms;
DROP POLICY IF EXISTS "Users can update rooms" ON rooms;
DROP POLICY IF EXISTS "Users can delete rooms" ON rooms;

CREATE POLICY "Users can view rooms" ON rooms
  FOR SELECT USING (can_access_hotel(hotel_id));

CREATE POLICY "Users can insert rooms" ON rooms
  FOR INSERT WITH CHECK (can_access_hotel(hotel_id));

CREATE POLICY "Users can update rooms" ON rooms
  FOR UPDATE USING (can_access_hotel(hotel_id));

CREATE POLICY "Users can delete rooms" ON rooms
  FOR DELETE USING (can_access_hotel(hotel_id));

-- Update RLS for assignments table
DROP POLICY IF EXISTS "Users can view assignments for their hotels" ON assignments;
DROP POLICY IF EXISTS "Users can manage assignments for their hotels" ON assignments;

CREATE POLICY "Users can view assignments" ON assignments
  FOR SELECT USING (can_access_hotel(hotel_id));

CREATE POLICY "Users can manage assignments" ON assignments
  FOR ALL USING (can_access_hotel(hotel_id));

-- Update RLS for daily_action_logs
DROP POLICY IF EXISTS "Users can view action logs for their hotels" ON daily_action_logs;
DROP POLICY IF EXISTS "Users can insert action logs for their hotels" ON daily_action_logs;

CREATE POLICY "Users can view action logs" ON daily_action_logs
  FOR SELECT USING (can_access_hotel(hotel_id));

CREATE POLICY "Users can insert action logs" ON daily_action_logs
  FOR INSERT WITH CHECK (can_access_hotel(hotel_id));

-- Update RLS for incidents
DROP POLICY IF EXISTS "Users can view incidents for their hotels" ON incidents;
DROP POLICY IF EXISTS "Users can manage incidents for their hotels" ON incidents;

CREATE POLICY "Users can view incidents" ON incidents
  FOR SELECT USING (can_access_hotel(hotel_id));

CREATE POLICY "Users can manage incidents" ON incidents
  FOR ALL USING (can_access_hotel(hotel_id));

-- Update RLS for daily_instructions
DROP POLICY IF EXISTS "Users can view daily instructions" ON daily_instructions;
DROP POLICY IF EXISTS "Users can manage daily instructions" ON daily_instructions;

CREATE POLICY "Users can view daily instructions" ON daily_instructions
  FOR SELECT USING (can_access_hotel(hotel_id));

CREATE POLICY "Users can manage daily instructions" ON daily_instructions
  FOR ALL USING (can_access_hotel(hotel_id));