CREATE POLICY "Hotel owners can view requesting cafetieres"
ON public.cafetiere_profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.cafetiere_access_requests car
    JOIN public.hotels h ON h.id = car.hotel_id
    WHERE car.cafetiere_profile_id = cafetiere_profiles.id
      AND h.user_id = auth.uid()
  )
);