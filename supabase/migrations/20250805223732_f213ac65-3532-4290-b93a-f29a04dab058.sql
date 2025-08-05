-- Phase 1: Create housekeeper personal profiles table
CREATE TABLE public.housekeeper_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  profile_picture_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  total_rooms_cleaned INTEGER NOT NULL DEFAULT 0,
  total_hotels_worked INTEGER NOT NULL DEFAULT 0,
  average_rating DECIMAL(3,2) DEFAULT NULL
);

-- Enable RLS
ALTER TABLE public.housekeeper_profiles ENABLE ROW LEVEL SECURITY;

-- Phase 2: Create housekeeper hotel history table
CREATE TABLE public.housekeeper_hotel_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  housekeeper_profile_id UUID NOT NULL REFERENCES public.housekeeper_profiles(id) ON DELETE CASCADE,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  rooms_cleaned INTEGER NOT NULL DEFAULT 0,
  total_work_hours DECIMAL(10,2) DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT NULL,
  notes TEXT,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.housekeeper_hotel_history ENABLE ROW LEVEL SECURITY;

-- Phase 3: Create hotel access sessions table (for temporary access codes)
CREATE TABLE public.hotel_access_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  housekeeper_profile_id UUID NOT NULL REFERENCES public.housekeeper_profiles(id) ON DELETE CASCADE,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  access_code TEXT NOT NULL UNIQUE,
  session_token TEXT NOT NULL UNIQUE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '48 hours'),
  ended_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rooms_cleaned_today INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hotel_access_sessions ENABLE ROW LEVEL SECURITY;