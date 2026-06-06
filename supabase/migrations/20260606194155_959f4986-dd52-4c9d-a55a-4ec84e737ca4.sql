DROP POLICY IF EXISTS "Cafetiere can insert breakfast logs" ON public.breakfast_logs;
DROP POLICY IF EXISTS "Cafetiere can update breakfast logs" ON public.breakfast_logs;
DROP POLICY IF EXISTS "Cafetiere can view breakfast logs" ON public.breakfast_logs;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'breakfast_logs'
      AND policyname = 'Cafetiere can manage breakfast logs via hotel access'
  ) THEN
    CREATE POLICY "Cafetiere can manage breakfast logs via hotel access"
    ON public.breakfast_logs
    FOR ALL
    TO authenticated
    USING (public.can_access_hotel(hotel_id))
    WITH CHECK (public.can_access_hotel(hotel_id));
  END IF;
END $$;