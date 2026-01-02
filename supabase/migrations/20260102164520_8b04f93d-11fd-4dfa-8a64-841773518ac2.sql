-- Table pour les gouvernantes
CREATE TABLE IF NOT EXISTS public.governess_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table pour les inspections de chambres
CREATE TABLE IF NOT EXISTS public.room_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  governess_id UUID REFERENCES public.governess_profiles(id),
  governess_name TEXT NOT NULL,
  inspection_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'failed', 'needs_rework')),
  cleanliness_score INTEGER CHECK (cleanliness_score >= 1 AND cleanliness_score <= 5),
  notes TEXT,
  issues TEXT[],
  photos TEXT[],
  inspected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table pour les invitations par email
CREATE TABLE IF NOT EXISTS public.staff_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('housekeeper', 'technician', 'governess')),
  invitation_code TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'accepted', 'expired', 'cancelled')),
  invited_by UUID,
  sent_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Sessions gouvernante
CREATE TABLE IF NOT EXISTS public.governess_hotel_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  governess_profile_id UUID NOT NULL REFERENCES public.governess_profiles(id) ON DELETE CASCADE,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  hotel_name TEXT,
  is_active BOOLEAN DEFAULT true,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS
ALTER TABLE public.governess_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governess_hotel_sessions ENABLE ROW LEVEL SECURITY;

-- Policies pour governess_profiles
CREATE POLICY "Governess can view own profile" ON public.governess_profiles
  FOR SELECT USING (true);

CREATE POLICY "Governess can update own profile" ON public.governess_profiles
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can create governess profile" ON public.governess_profiles
  FOR INSERT WITH CHECK (true);

-- Policies pour room_inspections
CREATE POLICY "Authenticated can view inspections" ON public.room_inspections
  FOR SELECT USING (true);

CREATE POLICY "Authenticated can create inspections" ON public.room_inspections
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated can update inspections" ON public.room_inspections
  FOR UPDATE USING (true);

-- Policies pour staff_invitations
CREATE POLICY "Authenticated can view invitations" ON public.staff_invitations
  FOR SELECT USING (true);

CREATE POLICY "Authenticated can create invitations" ON public.staff_invitations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated can update invitations" ON public.staff_invitations
  FOR UPDATE USING (true);

-- Policies pour governess_hotel_sessions
CREATE POLICY "Governess can manage sessions" ON public.governess_hotel_sessions
  FOR ALL USING (true);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_room_inspections_hotel ON public.room_inspections(hotel_id);
CREATE INDEX IF NOT EXISTS idx_room_inspections_date ON public.room_inspections(inspection_date);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_email ON public.staff_invitations(email);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_code ON public.staff_invitations(invitation_code);

-- Ajouter la table room_inspections au realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_inspections;