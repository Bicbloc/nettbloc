-- Ajouter hotel_code à hotels s'il n'existe pas
ALTER TABLE public.hotels ADD COLUMN IF NOT EXISTS hotel_code TEXT UNIQUE;

-- Créer les tables manquantes pour les codes d'accès
CREATE TABLE IF NOT EXISTS public.housekeeper_access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
  housekeeper_id UUID REFERENCES public.housekeepers(id) ON DELETE SET NULL,
  access_code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  used_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hotel_access_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  housekeeper_profile_id UUID REFERENCES public.housekeeper_profiles(id) ON DELETE CASCADE,
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
  access_code TEXT NOT NULL,
  session_token TEXT,
  access_request_id UUID,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS sur les nouvelles tables
ALTER TABLE public.housekeeper_access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_access_sessions ENABLE ROW LEVEL SECURITY;

-- Politiques pour housekeeper_access_codes
CREATE POLICY "Users can manage their hotel access codes" ON public.housekeeper_access_codes
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.hotels WHERE id = hotel_id AND user_id = auth.uid())
);

-- Politiques pour hotel_access_sessions  
CREATE POLICY "Users can manage their hotel sessions" ON public.hotel_access_sessions
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.hotels WHERE id = hotel_id AND user_id = auth.uid())
);