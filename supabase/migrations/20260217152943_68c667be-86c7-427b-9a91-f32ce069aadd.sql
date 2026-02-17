
-- Fix: restrict pms_sync_logs INSERT/UPDATE to service role only
DROP POLICY "Service role can insert sync logs" ON public.pms_sync_logs;
DROP POLICY "Service role can update sync logs" ON public.pms_sync_logs;

-- The service role bypasses RLS by default, so no permissive policies needed
-- Edge function uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS
