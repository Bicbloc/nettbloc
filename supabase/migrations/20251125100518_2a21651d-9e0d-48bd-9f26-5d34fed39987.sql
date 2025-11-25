-- Create linen types table
CREATE TABLE IF NOT EXISTS public.linen_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  dimensions TEXT,
  color TEXT,
  icon TEXT DEFAULT '🧺',
  weight_per_unit DECIMAL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create linen training samples table
CREATE TABLE IF NOT EXISTS public.linen_training_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  linen_type_id UUID NOT NULL REFERENCES public.linen_types(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  actual_count INTEGER NOT NULL,
  ai_predicted_count INTEGER,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create linen inventory tasks table
CREATE TABLE IF NOT EXISTS public.linen_inventory_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL,
  assigned_by UUID NOT NULL,
  task_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create linen inventory entries table
CREATE TABLE IF NOT EXISTS public.linen_inventory_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.linen_inventory_tasks(id) ON DELETE CASCADE,
  linen_type_id UUID NOT NULL REFERENCES public.linen_types(id) ON DELETE CASCADE,
  quantity_clean INTEGER DEFAULT 0,
  quantity_dirty INTEGER DEFAULT 0,
  quantity_damaged INTEGER DEFAULT 0,
  count_method TEXT DEFAULT 'manual',
  photo_url TEXT,
  ai_confidence DECIMAL,
  notes TEXT,
  counted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.linen_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linen_training_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linen_inventory_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linen_inventory_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for linen_types
CREATE POLICY "Hotel owners can manage linen types"
  ON public.linen_types
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = linen_types.hotel_id AND h.user_id = auth.uid()
  ));

CREATE POLICY "Housekeepers can view linen types"
  ON public.linen_types
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.hotel_access_sessions has
    WHERE has.hotel_id = linen_types.hotel_id
      AND has.is_active = true
      AND has.expires_at > now()
  ));

-- RLS Policies for linen_training_samples
CREATE POLICY "Hotel owners can manage training samples"
  ON public.linen_training_samples
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = linen_training_samples.hotel_id AND h.user_id = auth.uid()
  ));

-- RLS Policies for linen_inventory_tasks
CREATE POLICY "Hotel owners can manage inventory tasks"
  ON public.linen_inventory_tasks
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = linen_inventory_tasks.hotel_id AND h.user_id = auth.uid()
  ));

CREATE POLICY "Housekeepers can view their assigned tasks"
  ON public.linen_inventory_tasks
  FOR SELECT
  USING (
    assigned_to::text = get_housekeeper_profile_id()::text
    OR EXISTS (
      SELECT 1 FROM public.hotel_access_sessions has
      WHERE has.hotel_id = linen_inventory_tasks.hotel_id
        AND has.housekeeper_profile_id = assigned_to
        AND has.is_active = true
        AND has.expires_at > now()
    )
  );

CREATE POLICY "Housekeepers can update their assigned tasks"
  ON public.linen_inventory_tasks
  FOR UPDATE
  USING (
    assigned_to::text = get_housekeeper_profile_id()::text
    OR EXISTS (
      SELECT 1 FROM public.hotel_access_sessions has
      WHERE has.hotel_id = linen_inventory_tasks.hotel_id
        AND has.housekeeper_profile_id = assigned_to
        AND has.is_active = true
        AND has.expires_at > now()
    )
  );

-- RLS Policies for linen_inventory_entries
CREATE POLICY "Hotel owners can view inventory entries"
  ON public.linen_inventory_entries
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.linen_inventory_tasks lit
    JOIN public.hotels h ON h.id = lit.hotel_id
    WHERE lit.id = linen_inventory_entries.task_id AND h.user_id = auth.uid()
  ));

CREATE POLICY "Housekeepers can manage entries for their tasks"
  ON public.linen_inventory_entries
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.linen_inventory_tasks lit
    WHERE lit.id = linen_inventory_entries.task_id
      AND (
        lit.assigned_to::text = get_housekeeper_profile_id()::text
        OR EXISTS (
          SELECT 1 FROM public.hotel_access_sessions has
          WHERE has.hotel_id = lit.hotel_id
            AND has.housekeeper_profile_id = lit.assigned_to
            AND has.is_active = true
            AND has.expires_at > now()
        )
      )
  ));

-- Create storage bucket for linen images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'linen-images',
  'linen-images',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for linen images
CREATE POLICY "Hotel owners can upload linen images"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'linen-images'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Hotel owners can view linen images"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'linen-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Hotel owners can delete linen images"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'linen-images' AND auth.uid() IS NOT NULL);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_linen_types_hotel_id ON public.linen_types(hotel_id);
CREATE INDEX IF NOT EXISTS idx_linen_training_samples_hotel_id ON public.linen_training_samples(hotel_id);
CREATE INDEX IF NOT EXISTS idx_linen_training_samples_linen_type_id ON public.linen_training_samples(linen_type_id);
CREATE INDEX IF NOT EXISTS idx_linen_inventory_tasks_hotel_id ON public.linen_inventory_tasks(hotel_id);
CREATE INDEX IF NOT EXISTS idx_linen_inventory_tasks_assigned_to ON public.linen_inventory_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_linen_inventory_entries_task_id ON public.linen_inventory_entries(task_id);