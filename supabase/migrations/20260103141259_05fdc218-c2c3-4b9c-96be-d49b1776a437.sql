-- Create dedicated technician_profiles table
CREATE TABLE public.technician_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  total_hotels_worked INTEGER NOT NULL DEFAULT 0,
  specialties TEXT[] DEFAULT '{}',
  certifications JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.technician_profiles ENABLE ROW LEVEL SECURITY;

-- Technicians can view their own profile
CREATE POLICY "Technicians can view their own profile"
ON public.technician_profiles
FOR SELECT
USING (id = auth.uid());

-- Technicians can insert their own profile
CREATE POLICY "Technicians can insert their own profile"
ON public.technician_profiles
FOR INSERT
WITH CHECK (id = auth.uid());

-- Technicians can update their own profile
CREATE POLICY "Technicians can update their own profile"
ON public.technician_profiles
FOR UPDATE
USING (id = auth.uid());

-- Hotel admins can view technicians who work for them
CREATE POLICY "Hotel admins can view their technicians"
ON public.technician_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM hotel_access_sessions has
    JOIN hotels h ON h.id = has.hotel_id
    WHERE has.housekeeper_profile_id = technician_profiles.id
    AND h.user_id = auth.uid()
  )
);

-- Create technician_access_requests table
CREATE TABLE public.technician_access_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  technician_profile_id UUID NOT NULL REFERENCES public.technician_profiles(id) ON DELETE CASCADE,
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
  hotel_code TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.technician_access_requests ENABLE ROW LEVEL SECURITY;

-- Technicians can create access requests
CREATE POLICY "Technicians can create access requests"
ON public.technician_access_requests
FOR INSERT
WITH CHECK (technician_profile_id = auth.uid());

-- Technicians can view their own requests
CREATE POLICY "Technicians can view their own requests"
ON public.technician_access_requests
FOR SELECT
USING (technician_profile_id = auth.uid());

-- Hotel owners can view and update requests for their hotels
CREATE POLICY "Hotel owners can manage technician requests"
ON public.technician_access_requests
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM hotels h
    WHERE h.id = technician_access_requests.hotel_id
    AND h.user_id = auth.uid()
  )
);

-- Create index for performance
CREATE INDEX idx_technician_profiles_email ON public.technician_profiles(email);
CREATE INDEX idx_technician_access_requests_hotel ON public.technician_access_requests(hotel_id);
CREATE INDEX idx_technician_access_requests_technician ON public.technician_access_requests(technician_profile_id);