-- Policy: Governess can update assignments (assign/unassign rooms)
CREATE POLICY "Governess can update assignments"
ON public.assignments
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM governess_hotel_sessions ghs
    WHERE ghs.hotel_id = assignments.hotel_id
    AND ghs.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM governess_hotel_sessions ghs
    WHERE ghs.hotel_id = assignments.hotel_id
    AND ghs.is_active = true
  )
);

-- Policy: Governess can create assignments (assign rooms)
CREATE POLICY "Governess can create assignments"
ON public.assignments
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM governess_hotel_sessions ghs
    WHERE ghs.hotel_id = hotel_id
    AND ghs.is_active = true
  )
);

-- Policy: Governess can delete assignments (unassign rooms)
CREATE POLICY "Governess can delete assignments"
ON public.assignments
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1 FROM governess_hotel_sessions ghs
    WHERE ghs.hotel_id = assignments.hotel_id
    AND ghs.is_active = true
  )
);