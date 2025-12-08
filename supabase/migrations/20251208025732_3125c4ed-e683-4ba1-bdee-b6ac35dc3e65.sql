-- Create table for hotel-specific cleaning rules
CREATE TABLE public.hotel_cleaning_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  description TEXT,
  priority INTEGER NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  conditions JSONB NOT NULL DEFAULT '{}',
  result_cleaning_type TEXT NOT NULL CHECK (result_cleaning_type IN ('full', 'quick', 'none')),
  result_status TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hotel_cleaning_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Hotel owners can view their rules"
  ON public.hotel_cleaning_rules FOR SELECT
  USING (hotel_id IN (SELECT id FROM public.hotels WHERE user_id = auth.uid()));

CREATE POLICY "Hotel owners can create rules"
  ON public.hotel_cleaning_rules FOR INSERT
  WITH CHECK (hotel_id IN (SELECT id FROM public.hotels WHERE user_id = auth.uid()));

CREATE POLICY "Hotel owners can update their rules"
  ON public.hotel_cleaning_rules FOR UPDATE
  USING (hotel_id IN (SELECT id FROM public.hotels WHERE user_id = auth.uid()));

CREATE POLICY "Hotel owners can delete their rules"
  ON public.hotel_cleaning_rules FOR DELETE
  USING (hotel_id IN (SELECT id FROM public.hotels WHERE user_id = auth.uid()));

-- Index for performance
CREATE INDEX idx_hotel_cleaning_rules_hotel_id ON public.hotel_cleaning_rules(hotel_id);
CREATE INDEX idx_hotel_cleaning_rules_active ON public.hotel_cleaning_rules(hotel_id, is_active) WHERE is_active = true;

-- Trigger for updated_at
CREATE TRIGGER update_hotel_cleaning_rules_updated_at
  BEFORE UPDATE ON public.hotel_cleaning_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_hotel_rooms_registry_updated_at();