
-- =====================================================
-- HARDEN RLS POLICIES (security findings remediation)
-- =====================================================

-- ---------- profiles ----------
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ---------- housekeeper_profiles ----------
DROP POLICY IF EXISTS "Housekeepers can insert their own profile" ON public.housekeeper_profiles;
CREATE POLICY "Housekeepers can insert their own profile"
  ON public.housekeeper_profiles FOR INSERT
  WITH CHECK (id = public.get_housekeeper_profile_id());

-- ---------- governess_profiles ----------
DROP POLICY IF EXISTS "Governess can view own profile" ON public.governess_profiles;
DROP POLICY IF EXISTS "Anyone can create governess profile" ON public.governess_profiles;

CREATE POLICY "Governess can view own profile"
  ON public.governess_profiles FOR SELECT
  USING (email = auth.email());

CREATE POLICY "Hotel owners can view governesses linked to their hotels"
  ON public.governess_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.governess_access_requests gar
      JOIN public.hotels h ON h.id = gar.hotel_id
      WHERE gar.governess_profile_id = governess_profiles.id
        AND h.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can self-create governess profile"
  ON public.governess_profiles FOR INSERT
  TO authenticated
  WITH CHECK (email = auth.email());

-- ---------- governess_hotel_sessions ----------
DROP POLICY IF EXISTS "Governess can manage sessions" ON public.governess_hotel_sessions;

CREATE POLICY "Governess can view own sessions"
  ON public.governess_hotel_sessions FOR SELECT
  USING (
    governess_profile_id IN (
      SELECT id FROM public.governess_profiles WHERE email = auth.email()
    )
  );

CREATE POLICY "Governess can insert own sessions"
  ON public.governess_hotel_sessions FOR INSERT
  WITH CHECK (
    governess_profile_id IN (
      SELECT id FROM public.governess_profiles WHERE email = auth.email()
    )
  );

CREATE POLICY "Governess can update own sessions"
  ON public.governess_hotel_sessions FOR UPDATE
  USING (
    governess_profile_id IN (
      SELECT id FROM public.governess_profiles WHERE email = auth.email()
    )
  );

CREATE POLICY "Governess can delete own sessions"
  ON public.governess_hotel_sessions FOR DELETE
  USING (
    governess_profile_id IN (
      SELECT id FROM public.governess_profiles WHERE email = auth.email()
    )
  );

CREATE POLICY "Hotel owners can view sessions for their hotels"
  ON public.governess_hotel_sessions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = governess_hotel_sessions.hotel_id AND h.user_id = auth.uid())
  );

CREATE POLICY "Hotel owners can manage sessions for their hotels"
  ON public.governess_hotel_sessions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = governess_hotel_sessions.hotel_id AND h.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = governess_hotel_sessions.hotel_id AND h.user_id = auth.uid())
  );

-- ---------- governess_access_requests ----------
DROP POLICY IF EXISTS "Governesses can view own requests" ON public.governess_access_requests;
DROP POLICY IF EXISTS "Allow insert for authenticated" ON public.governess_access_requests;

CREATE POLICY "Governesses can view own requests"
  ON public.governess_access_requests FOR SELECT
  USING (
    governess_profile_id IN (
      SELECT id FROM public.governess_profiles WHERE email = auth.email()
    )
  );

CREATE POLICY "Hotel owners can view requests for their hotels"
  ON public.governess_access_requests FOR SELECT
  USING (public.is_hotel_owner(hotel_id));

CREATE POLICY "Governesses can insert own requests"
  ON public.governess_access_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    governess_profile_id IN (
      SELECT id FROM public.governess_profiles WHERE email = auth.email()
    )
  );

-- ---------- housekeeper_levels ----------
DROP POLICY IF EXISTS "Anyone can manage levels" ON public.housekeeper_levels;

CREATE POLICY "Hotel owners can manage levels"
  ON public.housekeeper_levels FOR ALL
  USING (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = housekeeper_levels.hotel_id AND h.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = housekeeper_levels.hotel_id AND h.user_id = auth.uid()));

CREATE POLICY "Housekeepers can view their own levels"
  ON public.housekeeper_levels FOR SELECT
  USING (housekeeper_id = public.get_housekeeper_profile_id());

CREATE POLICY "Housekeepers can update their own levels"
  ON public.housekeeper_levels FOR UPDATE
  USING (housekeeper_id = public.get_housekeeper_profile_id())
  WITH CHECK (housekeeper_id = public.get_housekeeper_profile_id());

CREATE POLICY "Housekeepers can insert their own levels"
  ON public.housekeeper_levels FOR INSERT
  WITH CHECK (housekeeper_id = public.get_housekeeper_profile_id());

-- ---------- housekeeper_achievements ----------
DROP POLICY IF EXISTS "Anyone can insert achievements" ON public.housekeeper_achievements;

CREATE POLICY "Hotel owners can manage achievements"
  ON public.housekeeper_achievements FOR ALL
  USING (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = housekeeper_achievements.hotel_id AND h.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = housekeeper_achievements.hotel_id AND h.user_id = auth.uid()));

CREATE POLICY "Housekeepers can view their own achievements"
  ON public.housekeeper_achievements FOR SELECT
  USING (housekeeper_id = public.get_housekeeper_profile_id());

-- ---------- notifications ----------
DROP POLICY IF EXISTS "Allow all inserts to notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can create notifications" ON public.notifications;

CREATE POLICY "Hotel owners can create notifications for their hotels"
  ON public.notifications FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = notifications.hotel_id AND h.user_id = auth.uid())
  );

CREATE POLICY "Authenticated staff with hotel access can create notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_access_hotel(hotel_id)
  );

-- ---------- incident_images ----------
DROP POLICY IF EXISTS "Anyone can upload incident images" ON public.incident_images;

CREATE POLICY "Hotel staff can upload incident images"
  ON public.incident_images FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.incidents i
      JOIN public.hotels h ON h.id = i.hotel_id
      WHERE i.id = incident_images.incident_id
        AND (h.user_id = auth.uid() OR public.can_access_hotel(i.hotel_id))
    )
  );

-- ---------- incidents (rewrite broken INSERT) ----------
DROP POLICY IF EXISTS "Allow incident creation for hotel access" ON public.incidents;

CREATE POLICY "Hotel owners can create incidents"
  ON public.incidents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = incidents.hotel_id AND h.user_id = auth.uid())
  );

CREATE POLICY "Governess with active session can create incidents"
  ON public.incidents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.governess_hotel_sessions ghs
      JOIN public.governess_profiles gp ON gp.id = ghs.governess_profile_id
      WHERE ghs.hotel_id = incidents.hotel_id
        AND ghs.is_active = true
        AND gp.email = auth.email()
    )
  );

CREATE POLICY "Housekeepers with hotel access can create incidents"
  ON public.incidents FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_access_hotel(incidents.hotel_id)
  );

-- ---------- assignments (governess insert fix) ----------
DROP POLICY IF EXISTS "Governess can create assignments" ON public.assignments;

CREATE POLICY "Governess can create assignments"
  ON public.assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.governess_hotel_sessions ghs
      JOIN public.governess_profiles gp ON gp.id = ghs.governess_profile_id
      WHERE ghs.hotel_id = assignments.hotel_id
        AND ghs.is_active = true
        AND gp.email = auth.email()
    )
  );

-- ---------- room_inspections ----------
DROP POLICY IF EXISTS "Authenticated can view inspections" ON public.room_inspections;
DROP POLICY IF EXISTS "Authenticated can create inspections" ON public.room_inspections;

CREATE POLICY "Hotel-scoped users can view inspections"
  ON public.room_inspections FOR SELECT
  USING (
    governess_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = room_inspections.hotel_id AND h.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.governess_hotel_sessions ghs
      JOIN public.governess_profiles gp ON gp.id = ghs.governess_profile_id
      WHERE ghs.hotel_id = room_inspections.hotel_id
        AND ghs.is_active = true
        AND gp.email = auth.email()
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
      JOIN public.governess_profiles gp ON gp.id = ghs.governess_profile_id
      WHERE ghs.hotel_id = room_inspections.hotel_id
        AND ghs.is_active = true
        AND gp.email = auth.email()
    )
    OR public.can_access_hotel(room_inspections.hotel_id)
  );

-- ---------- staff_invitations ----------
DROP POLICY IF EXISTS "Authenticated can view invitations" ON public.staff_invitations;
DROP POLICY IF EXISTS "Authenticated can create invitations" ON public.staff_invitations;

CREATE POLICY "Hotel owners or invitees can view invitations"
  ON public.staff_invitations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = staff_invitations.hotel_id AND h.user_id = auth.uid())
    OR email = auth.email()
  );

CREATE POLICY "Hotel owners can create invitations"
  ON public.staff_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = staff_invitations.hotel_id AND h.user_id = auth.uid())
  );

-- ---------- staff_timesheets ----------
DROP POLICY IF EXISTS "All authenticated can read timesheets" ON public.staff_timesheets;

-- ---------- linen_inventory_entries ----------
DROP POLICY IF EXISTS "Anyone can insert inventory entries" ON public.linen_inventory_entries;
DROP POLICY IF EXISTS "Anyone can delete inventory entries" ON public.linen_inventory_entries;

-- ---------- hotel_access_sessions ----------
DROP POLICY IF EXISTS "Anyone can update active sessions" ON public.hotel_access_sessions;

CREATE POLICY "Hotel owners can update sessions"
  ON public.hotel_access_sessions FOR UPDATE
  USING (public.is_hotel_owner(hotel_id))
  WITH CHECK (public.is_hotel_owner(hotel_id));

CREATE POLICY "Housekeepers can update their own sessions"
  ON public.hotel_access_sessions FOR UPDATE
  USING (housekeeper_profile_id = public.get_housekeeper_profile_id())
  WITH CHECK (housekeeper_profile_id = public.get_housekeeper_profile_id());

-- ---------- subscriptions ----------
DROP POLICY IF EXISTS "Service can update subscriptions" ON public.subscriptions;
-- Service role bypasses RLS automatically; no policy needed for service role writes.
-- Existing "Users can view own subscription" remains.

-- ---------- pending_subscriptions ----------
DROP POLICY IF EXISTS "Service role can manage pending subscriptions" ON public.pending_subscriptions;
-- Service role bypasses RLS; existing "Users can view their own pending subscriptions" remains.

-- ---------- sub_accounts ----------
DROP POLICY IF EXISTS "Anyone can read sub_accounts for activation" ON public.sub_accounts;

-- ---------- sub_account_invitations ----------
DROP POLICY IF EXISTS "Anyone can read invitation by code" ON public.sub_account_invitations;

-- ---------- activities ----------
DROP POLICY IF EXISTS "Anyone can insert activities" ON public.activities;

CREATE POLICY "Hotel-scoped users can insert activities"
  ON public.activities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = activities.hotel_id AND h.user_id = auth.uid())
    OR public.can_access_hotel(activities.hotel_id)
    OR EXISTS (
      SELECT 1 FROM public.governess_hotel_sessions ghs
      JOIN public.governess_profiles gp ON gp.id = ghs.governess_profile_id
      WHERE ghs.hotel_id = activities.hotel_id AND ghs.is_active = true AND gp.email = auth.email()
    )
  );

-- =====================================================
-- SAFE LOOKUP RPCs to replace removed public SELECT policies
-- =====================================================

-- Get a single sub-account invitation by code (used by ActivateAccount page).
-- Returns only the matching row (the code is an unguessable secret).
CREATE OR REPLACE FUNCTION public.get_invitation_by_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_invitation public.sub_account_invitations%ROWTYPE;
  v_sub        public.sub_accounts%ROWTYPE;
  v_hotel      public.hotels%ROWTYPE;
BEGIN
  IF p_code IS NULL OR length(p_code) < 4 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_invitation
  FROM public.sub_account_invitations
  WHERE invitation_code = p_code
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_sub
  FROM public.sub_accounts
  WHERE id = v_invitation.sub_account_id
  LIMIT 1;

  IF FOUND THEN
    SELECT * INTO v_hotel
    FROM public.hotels
    WHERE id = v_sub.hotel_id
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'invitation', to_jsonb(v_invitation),
    'sub_account', CASE WHEN v_sub.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_sub.id,
      'first_name', v_sub.first_name,
      'last_name', v_sub.last_name,
      'email', v_sub.email,
      'role', v_sub.role,
      'hotel_id', v_sub.hotel_id,
      'parent_user_id', v_sub.parent_user_id,
      'is_active', v_sub.is_active
    ) END,
    'hotel', CASE WHEN v_hotel.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_hotel.id,
      'name', v_hotel.name,
      'hotel_code', v_hotel.hotel_code
    ) END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_invitation_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_code(text) TO anon, authenticated;
