-- Table pour stocker les corrections d'apprentissage du scan linge
CREATE TABLE IF NOT EXISTS public.linen_training_samples (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  linen_type_id UUID NOT NULL REFERENCES public.linen_types(id) ON DELETE CASCADE,
  photo_url TEXT,
  ai_count INTEGER NOT NULL,
  actual_count INTEGER NOT NULL,
  confidence NUMERIC(3,2),
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour récupérer rapidement les corrections par type de linge
CREATE INDEX IF NOT EXISTS idx_linen_training_samples_type ON public.linen_training_samples(linen_type_id);
CREATE INDEX IF NOT EXISTS idx_linen_training_samples_hotel ON public.linen_training_samples(hotel_id);

-- Enable RLS
ALTER TABLE public.linen_training_samples ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view training samples for their hotels"
ON public.linen_training_samples
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = linen_training_samples.hotel_id
    AND h.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert training samples for their hotels"
ON public.linen_training_samples
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = linen_training_samples.hotel_id
    AND h.user_id = auth.uid()
  )
);

CREATE POLICY "Allow housekeepers to insert training samples"
ON public.linen_training_samples
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow housekeepers to view training samples"
ON public.linen_training_samples
FOR SELECT
USING (true);