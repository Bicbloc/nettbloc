-- Create missing tables and columns for the housekeeping system

-- Add missing columns to housekeeper_access_codes table
ALTER TABLE public.housekeeper_access_codes 
ADD COLUMN IF NOT EXISTS invited_name TEXT,
ADD COLUMN IF NOT EXISTS invited_email TEXT;

-- Create hotel_sessions table (if it doesn't exist, use existing user_sessions structure)
CREATE TABLE IF NOT EXISTS public.hotel_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
  user_id UUID,
  session_token TEXT,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create housekeeper_access_requests table
CREATE TABLE IF NOT EXISTS public.housekeeper_access_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  housekeeper_profile_id UUID REFERENCES public.housekeeper_profiles(id) ON DELETE CASCADE,
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
  hotel_code TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create housekeeper_invitations table
CREATE TABLE IF NOT EXISTS public.housekeeper_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
  invited_name TEXT NOT NULL,
  invited_email TEXT NOT NULL,
  access_code TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days'),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create room_status_updates table
CREATE TABLE IF NOT EXISTS public.room_status_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
  housekeeper_id TEXT,
  room_number TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.hotel_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.housekeeper_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.housekeeper_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_status_updates ENABLE ROW LEVEL SECURITY;

-- RLS policies for hotel_sessions
CREATE POLICY "Users can manage their hotel sessions" ON public.hotel_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.hotels 
      WHERE hotels.id = hotel_sessions.hotel_id 
      AND hotels.user_id = auth.uid()
    )
  );

-- RLS policies for housekeeper_access_requests
CREATE POLICY "Hotel owners can view access requests" ON public.housekeeper_access_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.hotels 
      WHERE hotels.id = housekeeper_access_requests.hotel_id 
      AND hotels.user_id = auth.uid()
    )
  );

CREATE POLICY "Hotel owners can update access requests" ON public.housekeeper_access_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.hotels 
      WHERE hotels.id = housekeeper_access_requests.hotel_id 
      AND hotels.user_id = auth.uid()
    )
  );

CREATE POLICY "Housekeepers can create access requests" ON public.housekeeper_access_requests
  FOR INSERT WITH CHECK (
    housekeeper_profile_id = get_housekeeper_profile_id()
  );

-- RLS policies for housekeeper_invitations
CREATE POLICY "Hotel owners can manage invitations" ON public.housekeeper_invitations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.hotels 
      WHERE hotels.id = housekeeper_invitations.hotel_id 
      AND hotels.user_id = auth.uid()
    )
  );

-- RLS policies for room_status_updates
CREATE POLICY "Hotel owners can view room status updates" ON public.room_status_updates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.hotels 
      WHERE hotels.id = room_status_updates.hotel_id 
      AND hotels.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can insert room status updates" ON public.room_status_updates
  FOR INSERT WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_hotel_sessions_hotel_id ON public.hotel_sessions(hotel_id);
CREATE INDEX IF NOT EXISTS idx_hotel_sessions_active ON public.hotel_sessions(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_access_requests_hotel_id ON public.housekeeper_access_requests(hotel_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON public.housekeeper_access_requests(status);

CREATE INDEX IF NOT EXISTS idx_invitations_hotel_id ON public.housekeeper_invitations(hotel_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.housekeeper_invitations(invited_email);

CREATE INDEX IF NOT EXISTS idx_room_updates_hotel_id ON public.room_status_updates(hotel_id);
CREATE INDEX IF NOT EXISTS idx_room_updates_room ON public.room_status_updates(room_number);

-- Add triggers for updated_at columns
CREATE TRIGGER update_hotel_sessions_updated_at
  BEFORE UPDATE ON public.hotel_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_access_requests_updated_at
  BEFORE UPDATE ON public.housekeeper_access_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invitations_updated_at
  BEFORE UPDATE ON public.housekeeper_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_room_updates_updated_at
  BEFORE UPDATE ON public.room_status_updates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();