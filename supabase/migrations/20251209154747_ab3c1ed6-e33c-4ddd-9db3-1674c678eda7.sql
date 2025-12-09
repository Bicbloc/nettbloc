-- Create table for pattern improvement requests (when client detects a different PMS format)
CREATE TABLE IF NOT EXISTS public.pattern_improvement_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE NOT NULL,
  submitted_by UUID NOT NULL,
  report_sample TEXT NOT NULL,
  detected_keywords TEXT[] DEFAULT '{}',
  expected_pms_type TEXT,
  detected_pms_type TEXT,
  mismatch_score NUMERIC(5,2),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processing')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pattern_improvement_requests ENABLE ROW LEVEL SECURITY;

-- Policies: Hotel owners can insert requests for their hotel
CREATE POLICY "Hotel owners can insert pattern requests"
ON public.pattern_improvement_requests
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = hotel_id AND h.user_id = auth.uid()
  )
);

-- Policies: Hotel owners can view their own requests
CREATE POLICY "Hotel owners can view own requests"
ON public.pattern_improvement_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = hotel_id AND h.user_id = auth.uid()
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
  )
);

-- Super admins can update requests
CREATE POLICY "Super admins can update requests"
ON public.pattern_improvement_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
  )
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pattern_requests_hotel_id ON public.pattern_improvement_requests(hotel_id);
CREATE INDEX IF NOT EXISTS idx_pattern_requests_status ON public.pattern_improvement_requests(status);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_pattern_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_pattern_requests_updated_at
BEFORE UPDATE ON public.pattern_improvement_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_pattern_requests_updated_at();