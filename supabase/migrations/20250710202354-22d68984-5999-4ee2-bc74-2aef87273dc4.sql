-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  subscription_type TEXT DEFAULT 'free',
  company_name TEXT,
  PRIMARY KEY (id)
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Add user_id to existing tables for data isolation
ALTER TABLE public.hotels ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.housekeepers ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.notifications ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.room_status_updates ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.hotel_sessions ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Update RLS policies for hotels
DROP POLICY IF EXISTS "Allow all operations on hotels" ON public.hotels;
CREATE POLICY "Users can manage their own hotels"
ON public.hotels
FOR ALL
USING (auth.uid() = user_id);

-- Update RLS policies for housekeepers
DROP POLICY IF EXISTS "Hotel admins can manage their housekeepers" ON public.housekeepers;
CREATE POLICY "Users can manage their own housekeepers"
ON public.housekeepers
FOR ALL
USING (auth.uid() = user_id);

-- Update RLS policies for notifications
DROP POLICY IF EXISTS "Hotel admins can view their hotel notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can create notifications for their hotel" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their hotel notifications" ON public.notifications;

CREATE POLICY "Users can manage their own notifications"
ON public.notifications
FOR ALL
USING (auth.uid() = user_id);

-- Update RLS policies for room_status_updates
DROP POLICY IF EXISTS "Hotel users can manage their room updates" ON public.room_status_updates;
CREATE POLICY "Users can manage their own room updates"
ON public.room_status_updates
FOR ALL
USING (auth.uid() = user_id);

-- Update RLS policies for hotel_sessions
DROP POLICY IF EXISTS "Allow all operations on hotel_sessions" ON public.hotel_sessions;
CREATE POLICY "Users can manage their own hotel sessions"
ON public.hotel_sessions
FOR ALL
USING (auth.uid() = user_id);

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

-- Trigger to create profile when user signs up
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create daily_reports table for historical data
CREATE TABLE public.daily_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hotel_id UUID NOT NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  room_data JSONB NOT NULL DEFAULT '[]',
  housekeeper_assignments JSONB NOT NULL DEFAULT '{}',
  housekeeper_names JSONB NOT NULL DEFAULT '[]',
  action_log JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, hotel_id, report_date)
);

-- Enable RLS on daily_reports
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own reports"
ON public.daily_reports
FOR ALL
USING (auth.uid() = user_id);

-- Create housekeeper_tokens table for direct login links
CREATE TABLE public.housekeeper_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  housekeeper_id UUID NOT NULL REFERENCES public.housekeepers(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '30 days'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on housekeeper_tokens
ALTER TABLE public.housekeeper_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own housekeeper tokens"
ON public.housekeeper_tokens
FOR ALL
USING (auth.uid() = user_id);