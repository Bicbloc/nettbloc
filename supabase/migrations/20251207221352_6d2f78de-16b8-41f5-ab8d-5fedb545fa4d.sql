-- Create hotel_detection_rules table for per-client/hotel custom detection rules
CREATE TABLE public.hotel_detection_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL, -- 'reservation_block', 'night_info', 'status_keyword', 'time_pattern', 'date_pattern'
  condition JSONB NOT NULL, -- { "pattern": "Nuit (\\d+)/(\\d+)", "field": "nightInfo", "operator": "greater_than", "value": 1 }
  result JSONB NOT NULL, -- { "cleaning_type": "recouche", "status": "stayover" }
  priority INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hotel_detection_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Hotel owners can manage their detection rules"
ON public.hotel_detection_rules
FOR ALL
USING (EXISTS (
  SELECT 1 FROM hotels h
  WHERE h.id = hotel_detection_rules.hotel_id
  AND h.user_id = auth.uid()
));

-- Create index for faster lookups
CREATE INDEX idx_hotel_detection_rules_hotel_id ON public.hotel_detection_rules(hotel_id);
CREATE INDEX idx_hotel_detection_rules_active ON public.hotel_detection_rules(hotel_id, is_active) WHERE is_active = true;

-- Add trigger for updated_at
CREATE TRIGGER update_hotel_detection_rules_updated_at
BEFORE UPDATE ON public.hotel_detection_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();