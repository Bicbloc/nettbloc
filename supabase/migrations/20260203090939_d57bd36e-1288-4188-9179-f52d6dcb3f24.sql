-- Add invitation_code column to sub_accounts if not exists
ALTER TABLE public.sub_accounts 
ADD COLUMN IF NOT EXISTS invitation_code TEXT;