DROP POLICY IF EXISTS "Cafetiere can insert breakfast logs" ON public.breakfast_logs;
DROP POLICY IF EXISTS "Cafetiere can update breakfast logs" ON public.breakfast_logs;
DROP POLICY IF EXISTS "Cafetiere can view breakfast logs" ON public.breakfast_logs;

CREATE POLICY "Cafetiere can insert breakfast logs"
ON public.breakfast_logs FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM cafetiere_access_requests car
  JOIN cafetiere_profiles cp ON cp.id = car.cafetiere_profile_id
  JOIN auth.users u ON u.email = cp.email
  WHERE car.hotel_id = breakfast_logs.hotel_id
    AND car.status = 'approved'
    AND u.id = auth.uid()
));

CREATE POLICY "Cafetiere can update breakfast logs"
ON public.breakfast_logs FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM cafetiere_access_requests car
  JOIN cafetiere_profiles cp ON cp.id = car.cafetiere_profile_id
  JOIN auth.users u ON u.email = cp.email
  WHERE car.hotel_id = breakfast_logs.hotel_id
    AND car.status = 'approved'
    AND u.id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM cafetiere_access_requests car
  JOIN cafetiere_profiles cp ON cp.id = car.cafetiere_profile_id
  JOIN auth.users u ON u.email = cp.email
  WHERE car.hotel_id = breakfast_logs.hotel_id
    AND car.status = 'approved'
    AND u.id = auth.uid()
));

CREATE POLICY "Cafetiere can view breakfast logs"
ON public.breakfast_logs FOR SELECT
USING (EXISTS (
  SELECT 1 FROM cafetiere_access_requests car
  JOIN cafetiere_profiles cp ON cp.id = car.cafetiere_profile_id
  JOIN auth.users u ON u.email = cp.email
  WHERE car.hotel_id = breakfast_logs.hotel_id
    AND car.status = 'approved'
    AND u.id = auth.uid()
));