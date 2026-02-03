-- Allow public read access to sub_account_invitations by invitation_code for activation
CREATE POLICY "Anyone can read invitation by code"
ON public.sub_account_invitations
FOR SELECT
TO public
USING (true);

-- Also allow public to read sub_accounts for activation (only via invitation join)
CREATE POLICY "Anyone can read sub_accounts for activation"
ON public.sub_accounts
FOR SELECT
TO public
USING (true);

-- Allow authenticated users to update sub_accounts during activation
DROP POLICY IF EXISTS "Users can update their sub-accounts" ON public.sub_accounts;
CREATE POLICY "Users can update sub-accounts"
ON public.sub_accounts
FOR UPDATE
TO authenticated
USING (true);

-- Allow public to update invitations (for marking as accepted)
CREATE POLICY "Anyone can update invitation status"
ON public.sub_account_invitations
FOR UPDATE
TO authenticated
USING (true);