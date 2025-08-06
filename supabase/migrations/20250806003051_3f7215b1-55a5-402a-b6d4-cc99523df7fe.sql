-- Add temporary flag to housekeepers table
ALTER TABLE public.housekeepers ADD COLUMN IF NOT EXISTS is_temporary boolean NOT NULL DEFAULT false;

-- Add invite functionality to housekeeper_access_codes
ALTER TABLE public.housekeeper_access_codes ADD COLUMN IF NOT EXISTS invited_email text;
ALTER TABLE public.housekeeper_access_codes ADD COLUMN IF NOT EXISTS invited_name text;
ALTER TABLE public.housekeeper_access_codes ADD COLUMN IF NOT EXISTS invitation_sent_at timestamp with time zone;

-- Create housekeeper invitations table for tracking
CREATE TABLE IF NOT EXISTS public.housekeeper_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id uuid NOT NULL,
  email text NOT NULL,
  name text NOT NULL,
  access_code text NOT NULL,
  invited_by uuid NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on housekeeper_invitations
ALTER TABLE public.housekeeper_invitations ENABLE ROW LEVEL SECURITY;

-- Create policies for housekeeper_invitations
CREATE POLICY "Hotel admins can manage their invitations"
ON public.housekeeper_invitations
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = housekeeper_invitations.hotel_id
    AND h.user_id = auth.uid()
  )
);

-- Add trigger for updated_at on housekeeper_invitations
CREATE TRIGGER update_housekeeper_invitations_updated_at
BEFORE UPDATE ON public.housekeeper_invitations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();