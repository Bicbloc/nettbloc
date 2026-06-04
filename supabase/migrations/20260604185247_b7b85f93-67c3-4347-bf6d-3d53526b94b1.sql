DROP POLICY IF EXISTS "Hotel staff can upload incident images" ON public.incident_images;
DROP POLICY IF EXISTS "Hotel staff can manage incident images" ON public.incident_images;

CREATE POLICY "Hotel staff can upload incident images"
ON public.incident_images
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.incidents i
    WHERE i.id = incident_images.incident_id
      AND (can_access_hotel(i.hotel_id) OR i.reported_by = auth.uid())
  )
);

CREATE POLICY "Hotel staff can manage incident images"
ON public.incident_images
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.incidents i
    WHERE i.id = incident_images.incident_id
      AND (can_access_hotel(i.hotel_id) OR i.reported_by = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.incidents i
    WHERE i.id = incident_images.incident_id
      AND (can_access_hotel(i.hotel_id) OR i.reported_by = auth.uid())
  )
);