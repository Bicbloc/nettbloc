
-- Helper: get current user's governess_profile_id (SECURITY DEFINER avoids recursion)
CREATE OR REPLACE FUNCTION public.get_current_governess_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.governess_profiles WHERE email = auth.email() LIMIT 1;
$$;

-- Helper: does the current user own a hotel that has an access request from this governess?
CREATE OR REPLACE FUNCTION public.hotel_owner_can_see_governess(_governess_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.governess_access_requests gar
    JOIN public.hotels h ON h.id = gar.hotel_id
    WHERE gar.governess_profile_id = _governess_profile_id
      AND h.user_id = auth.uid()
  );
$$;

-- Rebuild governess_profiles SELECT policies without recursive references
DROP POLICY IF EXISTS "Governess can view own profile" ON public.governess_profiles;
DROP POLICY IF EXISTS "Hotel owners can view governesses linked to their hotels" ON public.governess_profiles;

CREATE POLICY "Governess can view own profile"
  ON public.governess_profiles FOR SELECT
  USING (email = auth.email());

CREATE POLICY "Hotel owners can view governesses linked to their hotels"
  ON public.governess_profiles FOR SELECT
  USING (public.hotel_owner_can_see_governess(id));

-- Rebuild governess_hotel_sessions policies to use the helper (avoid sub-select recursion)
DROP POLICY IF EXISTS "Governess can view own sessions" ON public.governess_hotel_sessions;
DROP POLICY IF EXISTS "Governess can insert own sessions" ON public.governess_hotel_sessions;
DROP POLICY IF EXISTS "Governess can update own sessions" ON public.governess_hotel_sessions;
DROP POLICY IF EXISTS "Governess can delete own sessions" ON public.governess_hotel_sessions;

CREATE POLICY "Governess can view own sessions"
  ON public.governess_hotel_sessions FOR SELECT
  USING (governess_profile_id = public.get_current_governess_profile_id());

CREATE POLICY "Governess can insert own sessions"
  ON public.governess_hotel_sessions FOR INSERT
  WITH CHECK (governess_profile_id = public.get_current_governess_profile_id());

CREATE POLICY "Governess can update own sessions"
  ON public.governess_hotel_sessions FOR UPDATE
  USING (governess_profile_id = public.get_current_governess_profile_id());

CREATE POLICY "Governess can delete own sessions"
  ON public.governess_hotel_sessions FOR DELETE
  USING (governess_profile_id = public.get_current_governess_profile_id());

-- Rebuild governess_access_requests policy
DROP POLICY IF EXISTS "Governesses can view own requests" ON public.governess_access_requests;
DROP POLICY IF EXISTS "Governesses can insert own requests" ON public.governess_access_requests;

CREATE POLICY "Governesses can view own requests"
  ON public.governess_access_requests FOR SELECT
  USING (governess_profile_id = public.get_current_governess_profile_id());

CREATE POLICY "Governesses can insert own requests"
  ON public.governess_access_requests FOR INSERT
  TO authenticated
  WITH CHECK (governess_profile_id = public.get_current_governess_profile_id());

-- Rebuild assignments + incidents + room_inspections governess clauses to use helper
DROP POLICY IF EXISTS "Governess can create assignments" ON public.assignments;
CREATE POLICY "Governess can create assignments"
  ON public.assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.governess_hotel_sessions ghs
      WHERE ghs.hotel_id = assignments.hotel_id
        AND ghs.is_active = true
        AND ghs.governess_profile_id = public.get_current_governess_profile_id()
    )
  );

DROP POLICY IF EXISTS "Governess with active session can create incidents" ON public.incidents;
CREATE POLICY "Governess with active session can create incidents"
  ON public.incidents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.governess_hotel_sessions ghs
      WHERE ghs.hotel_id = incidents.hotel_id
        AND ghs.is_active = true
        AND ghs.governess_profile_id = public.get_current_governess_profile_id()
    )
  );

DROP POLICY IF EXISTS "Hotel-scoped users can view inspections" ON public.room_inspections;
DROP POLICY IF EXISTS "Hotel-scoped users can create inspections" ON public.room_inspections;

CREATE POLICY "Hotel-scoped users can view inspections"
  ON public.room_inspections FOR SELECT
  USING (
    governess_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = room_inspections.hotel_id AND h.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.governess_hotel_sessions ghs
      WHERE ghs.hotel_id = room_inspections.hotel_id
        AND ghs.is_active = true
        AND ghs.governess_profile_id = public.get_current_governess_profile_id()
    )
    OR public.can_access_hotel(room_inspections.hotel_id)
  );

CREATE POLICY "Hotel-scoped users can create inspections"
  ON public.room_inspections FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = room_inspections.hotel_id AND h.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.governess_hotel_sessions ghs
      WHERE ghs.hotel_id = room_inspections.hotel_id
        AND ghs.is_active = true
        AND ghs.governess_profile_id = public.get_current_governess_profile_id()
    )
    OR public.can_access_hotel(room_inspections.hotel_id)
  );

-- activities insert policy: same fix
DROP POLICY IF EXISTS "Hotel-scoped users can insert activities" ON public.activities;
CREATE POLICY "Hotel-scoped users can insert activities"
  ON public.activities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = activities.hotel_id AND h.user_id = auth.uid())
    OR public.can_access_hotel(activities.hotel_id)
    OR EXISTS (
      SELECT 1 FROM public.governess_hotel_sessions ghs
      WHERE ghs.hotel_id = activities.hotel_id
        AND ghs.is_active = true
        AND ghs.governess_profile_id = public.get_current_governess_profile_id()
    )
  );
