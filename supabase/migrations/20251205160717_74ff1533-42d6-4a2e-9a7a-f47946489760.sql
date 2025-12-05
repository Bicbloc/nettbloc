-- Fix linen_inventory_tasks INSERT policy - remove auth.users reference
DROP POLICY IF EXISTS "Housekeepers can create inventory tasks" ON public.linen_inventory_tasks;

-- Create simpler INSERT policy for hotel owners only
CREATE POLICY "Hotel owners can create inventory tasks"
ON public.linen_inventory_tasks
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = hotel_id AND h.user_id = auth.uid()
  )
);

-- Fix rooms UPDATE policy for housekeepers with assignments
DROP POLICY IF EXISTS "Housekeepers can update assigned rooms" ON public.rooms;

CREATE POLICY "Housekeepers can update assigned rooms"
ON public.rooms
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.room_id = rooms.id
    AND a.status IN ('assigned', 'in_progress')
    AND (
      -- By housekeeper_id matching authenticated housekeeper
      a.housekeeper_id::text = get_housekeeper_profile_id()::text
      OR
      -- By housekeeper in housekeepers table
      a.housekeeper_id IN (
        SELECT id::text FROM public.housekeepers WHERE user_id = auth.uid()
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.room_id = rooms.id
    AND a.status IN ('assigned', 'in_progress')
  )
);

-- Also ensure housekeepers with access sessions can update rooms
DROP POLICY IF EXISTS "Housekeepers can update room status through access sessions" ON public.rooms;

CREATE POLICY "Housekeepers can update room status through access sessions"
ON public.rooms
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.hotel_access_sessions has
    WHERE has.hotel_id = rooms.hotel_id
    AND has.is_active = true
    AND has.expires_at > now()
  )
);