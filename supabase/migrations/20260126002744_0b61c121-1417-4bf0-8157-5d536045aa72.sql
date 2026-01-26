-- =============================================
-- NETTO COUNT - Standalone Linen Counting App
-- =============================================

-- User profiles for Netto Count app
CREATE TABLE public.netto_count_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT,
  email_confirmed BOOLEAN DEFAULT false,
  confirmation_token TEXT,
  confirmation_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.netto_count_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own profile" 
ON public.netto_count_profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.netto_count_profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.netto_count_profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Item types to count (user-configurable checklist)
CREATE TABLE public.netto_count_item_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📦',
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.netto_count_item_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies for item types
CREATE POLICY "Users can view their own item types" 
ON public.netto_count_item_types FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own item types" 
ON public.netto_count_item_types FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own item types" 
ON public.netto_count_item_types FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own item types" 
ON public.netto_count_item_types FOR DELETE 
USING (auth.uid() = user_id);

-- Scan sessions (each time user uploads images/videos)
CREATE TABLE public.netto_count_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  scan_name TEXT,
  scan_type TEXT DEFAULT 'image', -- 'image', 'video', 'camera'
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  selected_item_types UUID[] DEFAULT '{}',
  total_items_counted INT DEFAULT 0,
  processing_time_ms INT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.netto_count_scans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scans
CREATE POLICY "Users can view their own scans" 
ON public.netto_count_scans FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scans" 
ON public.netto_count_scans FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scans" 
ON public.netto_count_scans FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scans" 
ON public.netto_count_scans FOR DELETE 
USING (auth.uid() = user_id);

-- Individual scan results
CREATE TABLE public.netto_count_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES public.netto_count_scans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  item_type_id UUID REFERENCES public.netto_count_item_types(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  count INT DEFAULT 0,
  confidence FLOAT DEFAULT 0,
  source_file TEXT,
  frame_number INT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.netto_count_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for results
CREATE POLICY "Users can view their own results" 
ON public.netto_count_results FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own results" 
ON public.netto_count_results FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own results" 
ON public.netto_count_results FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own results" 
ON public.netto_count_results FOR DELETE 
USING (auth.uid() = user_id);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.netto_count_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_netto_count_profiles_timestamp
  BEFORE UPDATE ON public.netto_count_profiles
  FOR EACH ROW EXECUTE FUNCTION public.netto_count_update_timestamp();

CREATE TRIGGER update_netto_count_item_types_timestamp
  BEFORE UPDATE ON public.netto_count_item_types
  FOR EACH ROW EXECUTE FUNCTION public.netto_count_update_timestamp();

-- Create storage bucket for scan uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('netto-count-uploads', 'netto-count-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for netto-count-uploads bucket
CREATE POLICY "Users can upload their own files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'netto-count-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT
USING (bucket_id = 'netto-count-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (bucket_id = 'netto-count-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);