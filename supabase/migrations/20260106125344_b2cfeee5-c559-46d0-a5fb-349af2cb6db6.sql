-- Add RLS policies for governess access to rooms and assignments

-- Policy: Governess can view rooms through their active sessions
CREATE POLICY "Governess can view rooms through sessions"
ON public.rooms
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM governess_hotel_sessions ghs
    WHERE ghs.hotel_id = rooms.hotel_id
    AND ghs.is_active = true
  )
);

-- Policy: Governess can update rooms (for inspection)
CREATE POLICY "Governess can update rooms for inspection"
ON public.rooms
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM governess_hotel_sessions ghs
    WHERE ghs.hotel_id = rooms.hotel_id
    AND ghs.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM governess_hotel_sessions ghs
    WHERE ghs.hotel_id = rooms.hotel_id
    AND ghs.is_active = true
  )
);

-- Policy: Governess can view assignments
CREATE POLICY "Governess can view assignments through sessions"
ON public.assignments
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM governess_hotel_sessions ghs
    WHERE ghs.hotel_id = assignments.hotel_id
    AND ghs.is_active = true
  )
);

-- Policy: Governess can view incidents
CREATE POLICY "Governess can view incidents through sessions"
ON public.incidents
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM governess_hotel_sessions ghs
    WHERE ghs.hotel_id = incidents.hotel_id
    AND ghs.is_active = true
  )
);

-- Policy: Governess can create incidents
CREATE POLICY "Governess can create incidents"
ON public.incidents
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM governess_hotel_sessions ghs
    WHERE ghs.hotel_id = hotel_id
    AND ghs.is_active = true
  )
);

-- Policy: Governess can update incidents
CREATE POLICY "Governess can update incidents"
ON public.incidents
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM governess_hotel_sessions ghs
    WHERE ghs.hotel_id = incidents.hotel_id
    AND ghs.is_active = true
  )
);