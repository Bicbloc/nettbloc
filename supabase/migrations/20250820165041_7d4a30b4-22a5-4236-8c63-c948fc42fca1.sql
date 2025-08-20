-- Create additional missing tables

-- Create hotel_users table for user roles
CREATE TABLE IF NOT EXISTS public.hotel_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'manager', 'staff')),
  permissions JSONB DEFAULT '{}',
  invited_by UUID,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(hotel_id, user_id)
);

-- Create daily_reports table
CREATE TABLE IF NOT EXISTS public.daily_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  housekeeper_id UUID,
  room_data JSONB DEFAULT '{}',
  summary JSONB DEFAULT '{}',
  total_rooms_cleaned INTEGER DEFAULT 0,
  total_hours_worked DECIMAL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(hotel_id, report_date, housekeeper_id)
);

-- Add missing columns to hotel_access_sessions
ALTER TABLE public.hotel_access_sessions 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS rooms_cleaned_today INTEGER DEFAULT 0;

-- Add missing columns to housekeeper_access_codes  
ALTER TABLE public.housekeeper_access_codes
ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS on new tables
ALTER TABLE public.hotel_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

-- RLS policies for hotel_users
CREATE POLICY "Hotel owners can manage hotel users" ON public.hotel_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.hotels 
      WHERE hotels.id = hotel_users.hotel_id 
      AND hotels.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own hotel roles" ON public.hotel_users
  FOR SELECT USING (user_id = auth.uid());

-- RLS policies for daily_reports
CREATE POLICY "Hotel owners can manage daily reports" ON public.daily_reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.hotels 
      WHERE hotels.id = daily_reports.hotel_id 
      AND hotels.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_hotel_users_hotel_id ON public.hotel_users(hotel_id);
CREATE INDEX IF NOT EXISTS idx_hotel_users_user_id ON public.hotel_users(user_id);
CREATE INDEX IF NOT EXISTS idx_hotel_users_role ON public.hotel_users(role);

CREATE INDEX IF NOT EXISTS idx_daily_reports_hotel_id ON public.daily_reports(hotel_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON public.daily_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_daily_reports_housekeeper ON public.daily_reports(housekeeper_id);

-- Add triggers for updated_at columns
CREATE TRIGGER update_hotel_users_updated_at
  BEFORE UPDATE ON public.hotel_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_daily_reports_updated_at
  BEFORE UPDATE ON public.daily_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();