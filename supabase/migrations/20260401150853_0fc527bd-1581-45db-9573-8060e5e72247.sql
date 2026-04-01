-- Fix: Allow hotel owners AND sub-accounts to manage manual_tasks
-- The current policy only checks hotels.user_id = auth.uid() which fails for sub-accounts

-- Drop existing owner policy
DROP POLICY IF EXISTS "Hotel owners can manage manual tasks" ON public.manual_tasks;

-- Create new inclusive policy that also covers sub-accounts
CREATE POLICY "Hotel owners and sub-accounts can manage manual tasks" ON public.manual_tasks
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM hotels h WHERE h.id = manual_tasks.hotel_id AND h.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM sub_accounts sa 
    WHERE sa.hotel_id = manual_tasks.hotel_id 
    AND sa.user_id = auth.uid() 
    AND sa.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM hotels h WHERE h.id = manual_tasks.hotel_id AND h.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM sub_accounts sa 
    WHERE sa.hotel_id = manual_tasks.hotel_id 
    AND sa.user_id = auth.uid() 
    AND sa.is_active = true
  )
);