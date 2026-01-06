-- Table pour les demandes d'accès des gouvernantes
CREATE TABLE IF NOT EXISTS public.governess_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  governess_profile_id UUID NOT NULL REFERENCES public.governess_profiles(id) ON DELETE CASCADE,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  hotel_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(governess_profile_id, hotel_id)
);

-- Enable RLS
ALTER TABLE public.governess_access_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Les gouvernantes peuvent voir leurs propres demandes
CREATE POLICY "Governesses can view own requests"
ON public.governess_access_requests
FOR SELECT
TO authenticated
USING (true);

-- Policy: Insertion via edge function (service role)
CREATE POLICY "Allow insert for authenticated"
ON public.governess_access_requests
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: L'hôtel peut mettre à jour les demandes
CREATE POLICY "Hotel owners can update requests"
ON public.governess_access_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.hotels 
    WHERE hotels.id = governess_access_requests.hotel_id 
    AND hotels.user_id = auth.uid()
  )
);

-- Trigger pour updated_at
CREATE TRIGGER update_governess_access_requests_updated_at
BEFORE UPDATE ON public.governess_access_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();