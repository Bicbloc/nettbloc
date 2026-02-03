-- Allow sub-accounts to read the parent hotel they are linked to
-- This fixes HotelContext loading for invited team members.

ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'hotels'
      AND policyname = 'Sub-accounts can view linked hotel'
  ) THEN
    CREATE POLICY "Sub-accounts can view linked hotel"
    ON public.hotels
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.sub_accounts sa
        WHERE sa.user_id = auth.uid()
          AND sa.is_active = true
          AND sa.hotel_id = hotels.id
      )
    );
  END IF;
END $$;