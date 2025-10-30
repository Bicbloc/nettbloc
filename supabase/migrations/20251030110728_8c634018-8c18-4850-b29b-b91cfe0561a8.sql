-- Table pour stocker les patterns d'entraînement des rapports
CREATE TABLE IF NOT EXISTS public.report_training_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  report_name TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  extracted_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  validated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_report_training_hotel ON public.report_training_patterns(hotel_id);
CREATE INDEX IF NOT EXISTS idx_report_training_validated ON public.report_training_patterns(validated);

-- RLS policies
ALTER TABLE public.report_training_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view training patterns" 
ON public.report_training_patterns 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = report_training_patterns.hotel_id
    AND h.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can insert training patterns" 
ON public.report_training_patterns 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = report_training_patterns.hotel_id
    AND h.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can update training patterns" 
ON public.report_training_patterns 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = report_training_patterns.hotel_id
    AND h.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can delete training patterns" 
ON public.report_training_patterns 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = report_training_patterns.hotel_id
    AND h.user_id = auth.uid()
  )
);

-- Trigger pour updated_at
CREATE TRIGGER update_report_training_patterns_updated_at
BEFORE UPDATE ON public.report_training_patterns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();