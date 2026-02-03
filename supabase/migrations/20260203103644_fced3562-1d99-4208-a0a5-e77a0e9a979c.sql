-- Fix RLS policy for sub_account_permissions INSERT
-- The existing policy uses USING which doesn't work for INSERT, need WITH CHECK

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can manage permissions of their sub-accounts" ON public.sub_account_permissions;

-- Create separate policies for each operation
CREATE POLICY "Users can insert permissions for their sub-accounts"
  ON public.sub_account_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sub_accounts 
      WHERE sub_accounts.id = sub_account_id 
      AND sub_accounts.parent_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update permissions of their sub-accounts"
  ON public.sub_account_permissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sub_accounts 
      WHERE sub_accounts.id = sub_account_id 
      AND sub_accounts.parent_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete permissions of their sub-accounts"
  ON public.sub_account_permissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sub_accounts 
      WHERE sub_accounts.id = sub_account_id 
      AND sub_accounts.parent_user_id = auth.uid()
    )
  );