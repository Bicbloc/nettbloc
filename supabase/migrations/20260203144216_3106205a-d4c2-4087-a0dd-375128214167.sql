-- =====================================================
-- CORRECTION DES POLITIQUES RLS TROP PERMISSIVES
-- =====================================================

-- 1. Corriger la politique UPDATE sur rooms (critique)
DROP POLICY IF EXISTS "Anonymous users can update rooms with valid hotel" ON public.rooms;

CREATE POLICY "Users can update rooms for their hotels"
ON public.rooms
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM hotels h 
    WHERE h.id = rooms.hotel_id 
    AND (h.user_id = auth.uid() OR public.can_manage_hotel_data(rooms.hotel_id))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM hotels h 
    WHERE h.id = rooms.hotel_id 
    AND (h.user_id = auth.uid() OR public.can_manage_hotel_data(rooms.hotel_id))
  )
);

-- Politique spéciale pour les femmes de chambre (via session active)
CREATE POLICY "Housekeepers can update assigned rooms via session"
ON public.rooms
FOR UPDATE
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM hotel_access_sessions has
    WHERE has.hotel_id = rooms.hotel_id
    AND has.is_active = true
    AND has.expires_at > now()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM hotel_access_sessions has
    WHERE has.hotel_id = rooms.hotel_id
    AND has.is_active = true
    AND has.expires_at > now()
  )
);

-- 2. Corriger la politique DELETE sur assignments
DROP POLICY IF EXISTS "Anyone can delete assignments with hotel access" ON public.assignments;

CREATE POLICY "Hotel owners can delete assignments"
ON public.assignments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM hotels h 
    WHERE h.id = assignments.hotel_id 
    AND (h.user_id = auth.uid() OR public.can_manage_hotel_data(assignments.hotel_id))
  )
);

-- 3. Corriger la politique UPDATE sur sub_accounts
DROP POLICY IF EXISTS "Users can update sub-accounts" ON public.sub_accounts;

CREATE POLICY "Parent users can update their sub-accounts"
ON public.sub_accounts
FOR UPDATE
TO authenticated
USING (parent_user_id = auth.uid() OR user_id = auth.uid())
WITH CHECK (parent_user_id = auth.uid() OR user_id = auth.uid());

-- 4. Corriger la politique UPDATE sur governess_profiles
DROP POLICY IF EXISTS "Governess can update own profile" ON public.governess_profiles;

CREATE POLICY "Governess can update own profile"
ON public.governess_profiles
FOR UPDATE
TO authenticated
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
WITH CHECK (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- 5. Corriger la politique UPDATE sur staff_timesheets
DROP POLICY IF EXISTS "Housekeepers can update own timesheets" ON public.staff_timesheets;

CREATE POLICY "Staff can update own timesheets"
ON public.staff_timesheets
FOR UPDATE
TO authenticated
USING (
  staff_id = auth.uid()
  OR housekeeper_profile_id IN (
    SELECT id FROM housekeeper_profiles WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM hotels h WHERE h.id = staff_timesheets.hotel_id AND h.user_id = auth.uid()
  )
)
WITH CHECK (
  staff_id = auth.uid()
  OR housekeeper_profile_id IN (
    SELECT id FROM housekeeper_profiles WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM hotels h WHERE h.id = staff_timesheets.hotel_id AND h.user_id = auth.uid()
  )
);

-- 6. Corriger la politique UPDATE sur staff_invitations
DROP POLICY IF EXISTS "Authenticated can update invitations" ON public.staff_invitations;

CREATE POLICY "Hotel owners can update staff invitations"
ON public.staff_invitations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM hotels h 
    WHERE h.id = staff_invitations.hotel_id 
    AND h.user_id = auth.uid()
  )
  OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM hotels h 
    WHERE h.id = staff_invitations.hotel_id 
    AND h.user_id = auth.uid()
  )
  OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- 7. Corriger la politique UPDATE sur room_inspections
DROP POLICY IF EXISTS "Authenticated can update inspections" ON public.room_inspections;

CREATE POLICY "Governess and hotel owners can update inspections"
ON public.room_inspections
FOR UPDATE
TO authenticated
USING (
  governess_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM hotels h WHERE h.id = room_inspections.hotel_id AND h.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM governess_hotel_sessions ghs 
    WHERE ghs.hotel_id = room_inspections.hotel_id 
    AND ghs.is_active = true
    AND ghs.governess_profile_id IN (
      SELECT id FROM governess_profiles WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
)
WITH CHECK (
  governess_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM hotels h WHERE h.id = room_inspections.hotel_id AND h.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM governess_hotel_sessions ghs 
    WHERE ghs.hotel_id = room_inspections.hotel_id 
    AND ghs.is_active = true
    AND ghs.governess_profile_id IN (
      SELECT id FROM governess_profiles WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
);

-- 8. Corriger la politique UPDATE sur sub_account_invitations
DROP POLICY IF EXISTS "Anyone can update invitation status" ON public.sub_account_invitations;

CREATE POLICY "Invited users can update their invitations"
ON public.sub_account_invitations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sub_accounts sa 
    WHERE sa.id = sub_account_invitations.sub_account_id 
    AND (sa.parent_user_id = auth.uid() OR sa.email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sub_accounts sa 
    WHERE sa.id = sub_account_invitations.sub_account_id 
    AND (sa.parent_user_id = auth.uid() OR sa.email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  )
);

-- 9. Corriger la politique UPDATE sur linen_inventory_tasks
DROP POLICY IF EXISTS "Anyone can update inventory tasks" ON public.linen_inventory_tasks;

CREATE POLICY "Assigned users can update inventory tasks"
ON public.linen_inventory_tasks
FOR UPDATE
TO authenticated
USING (
  assigned_to = auth.uid()
  OR assigned_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM hotels h WHERE h.id = linen_inventory_tasks.hotel_id AND h.user_id = auth.uid()
  )
)
WITH CHECK (
  assigned_to = auth.uid()
  OR assigned_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM hotels h WHERE h.id = linen_inventory_tasks.hotel_id AND h.user_id = auth.uid()
  )
);