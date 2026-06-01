-- The staff_timesheets table had NO grants, so the Data API rejected every request
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_timesheets TO authenticated;
GRANT ALL ON public.staff_timesheets TO service_role;

-- Unified SELECT policy so owners, sub-accounts and staff with hotel access can view timesheets
DROP POLICY IF EXISTS "Hotel access can view timesheets" ON public.staff_timesheets;
CREATE POLICY "Hotel access can view timesheets"
ON public.staff_timesheets FOR SELECT TO authenticated
USING (public.can_access_hotel(hotel_id));