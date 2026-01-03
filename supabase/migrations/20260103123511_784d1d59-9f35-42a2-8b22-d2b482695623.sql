-- Table pour les règles de combinaison de nettoyage
CREATE TABLE public.hotel_combination_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  description TEXT,
  priority INT NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Conditions de combinaison (valeurs: 'present', 'absent', 'any')
  status_keywords TEXT[] DEFAULT '{}', -- ['SAL', 'DIR', 'OCC', 'DEP', 'PARTI']
  arrival_date VARCHAR(10) NOT NULL DEFAULT 'any',
  departure_date VARCHAR(10) NOT NULL DEFAULT 'any',
  arrival_time VARCHAR(10) NOT NULL DEFAULT 'any',
  departure_time VARCHAR(10) NOT NULL DEFAULT 'any',
  night_info VARCHAR(10) NOT NULL DEFAULT 'any',
  
  -- Résultat
  result_cleaning_type TEXT NOT NULL CHECK (result_cleaning_type IN ('a_blanc', 'recouche', 'none')),
  result_status TEXT DEFAULT 'stayover' CHECK (result_status IN ('checkout', 'stayover', 'arrival', 'vacant', 'occupied')),
  
  -- Métadonnées
  pms_template TEXT, -- 'mews', 'apaleo', 'medialog', null pour custom
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Contraintes
  CONSTRAINT valid_arrival_date CHECK (arrival_date IN ('present', 'absent', 'any')),
  CONSTRAINT valid_departure_date CHECK (departure_date IN ('present', 'absent', 'any')),
  CONSTRAINT valid_arrival_time CHECK (arrival_time IN ('present', 'absent', 'any')),
  CONSTRAINT valid_departure_time CHECK (departure_time IN ('present', 'absent', 'any')),
  CONSTRAINT valid_night_info CHECK (night_info IN ('present', 'absent', 'any'))
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_hotel_combination_rules_hotel_id ON public.hotel_combination_rules(hotel_id);
CREATE INDEX idx_hotel_combination_rules_active ON public.hotel_combination_rules(hotel_id, is_active) WHERE is_active = true;

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION public.update_hotel_combination_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_hotel_combination_rules_timestamp
  BEFORE UPDATE ON public.hotel_combination_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_hotel_combination_rules_updated_at();

-- RLS
ALTER TABLE public.hotel_combination_rules ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view combination rules for their hotels"
  ON public.hotel_combination_rules
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.hotels h
      WHERE h.id = hotel_id AND h.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create combination rules for their hotels"
  ON public.hotel_combination_rules
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.hotels h
      WHERE h.id = hotel_id AND h.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update combination rules for their hotels"
  ON public.hotel_combination_rules
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.hotels h
      WHERE h.id = hotel_id AND h.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete combination rules for their hotels"
  ON public.hotel_combination_rules
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.hotels h
      WHERE h.id = hotel_id AND h.user_id = auth.uid()
    )
  );