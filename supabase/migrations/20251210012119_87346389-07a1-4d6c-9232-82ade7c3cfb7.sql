-- Table unifiée pour les règles PMS (remplace hotel_detection_rules et hotel_cleaning_rules partiellement)
CREATE TABLE IF NOT EXISTS public.pms_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
  pms_type TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  
  -- Configuration du PMS
  keywords TEXT[] DEFAULT '{}',
  room_number_regex TEXT,
  
  -- Mappings de statut (keyword -> {status, cleaning, priority})
  status_mappings JSONB DEFAULT '{}',
  
  -- Règles de combinaison
  combination_rules JSONB DEFAULT '[]',
  
  -- Formats de date supportés
  date_formats TEXT[] DEFAULT ARRAY['dd/MM/yyyy'],
  
  -- Métadonnées
  priority INT DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'manual', -- 'manual', 'learned', 'imported'
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  
  -- Contrainte d'unicité
  UNIQUE(hotel_id, pms_type, rule_name)
);

-- Index pour la recherche rapide
CREATE INDEX IF NOT EXISTS idx_pms_rules_hotel_pms ON public.pms_rules(hotel_id, pms_type);
CREATE INDEX IF NOT EXISTS idx_pms_rules_active ON public.pms_rules(is_active) WHERE is_active = true;

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_pms_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_pms_rules_updated_at ON public.pms_rules;
CREATE TRIGGER trigger_pms_rules_updated_at
  BEFORE UPDATE ON public.pms_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_pms_rules_updated_at();

-- RLS
ALTER TABLE public.pms_rules ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Hotel owners can manage their PMS rules"
  ON public.pms_rules
  FOR ALL
  USING (
    hotel_id IS NULL -- Règles par défaut accessibles à tous
    OR EXISTS (
      SELECT 1 FROM public.hotels h 
      WHERE h.id = pms_rules.hotel_id AND h.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view default PMS rules"
  ON public.pms_rules
  FOR SELECT
  USING (is_default = true OR hotel_id IS NULL);

-- Insérer les règles par défaut pour chaque PMS
INSERT INTO public.pms_rules (pms_type, rule_name, keywords, room_number_regex, status_mappings, combination_rules, date_formats, is_default, source)
VALUES 
  ('apaleo', 'Apaleo Default', 
   ARRAY['APALEO', 'Recouche', 'Parti', 'En arrivée', 'Arrivé', 'A contrôler', 'Propre'],
   '\b(0?[1-9]\d{0,4}|[1-9]\d{1,4})\b',
   '{"RECOUCHE": {"status": "stayover", "cleaning": "quick", "priority": 10}, "PARTI": {"status": "checkout", "cleaning": "full", "priority": 20}, "EN ARRIVEE": {"status": "arrival", "cleaning": "full", "priority": 15}, "A CONTROLER": {"status": "clean", "cleaning": "none", "priority": 8}}'::jsonb,
   '[{"conditions": ["checkout", "arrival"], "result": {"status": "checkout_arrival", "cleaning": "full"}}]'::jsonb,
   ARRAY['dd/MM/yyyy', 'dd/MM/yy'],
   true, 'system'),
   
  ('mews', 'Mews Default',
   ARRAY['MEWS', 'COMMANDER', 'DIR', 'INS', 'SAL', 'Night'],
   '\b([1-9]\d{2,4})\b',
   '{"DIR": {"status": "checkout", "cleaning": "full", "priority": 20}, "INS": {"status": "inspected", "cleaning": "none", "priority": 7}, "SAL": {"status": "stayover", "cleaning": "quick", "priority": 10}, "DEP": {"status": "checkout", "cleaning": "full", "priority": 20}}'::jsonb,
   '[{"conditions": ["DIR", "ARR"], "result": {"status": "checkout_arrival", "cleaning": "full"}}]'::jsonb,
   ARRAY['dd/MM/yyyy', 'yyyy-MM-dd'],
   true, 'system'),
   
  ('opera', 'Opera Default',
   ARRAY['OPERA', 'ORACLE HOSPITALITY', 'DUE OUT', 'PICKUP', 'VACANT'],
   '\b([1-9]\d{2,4})\b',
   '{"DIRTY": {"status": "dirty", "cleaning": "full", "priority": 20}, "CLEAN": {"status": "clean", "cleaning": "none", "priority": 8}, "DUE OUT": {"status": "checkout", "cleaning": "full", "priority": 20}, "PICKUP": {"status": "stayover", "cleaning": "quick", "priority": 10}}'::jsonb,
   '[{"conditions": ["DUE OUT", "DUE IN"], "result": {"status": "checkout_arrival", "cleaning": "full"}}]'::jsonb,
   ARRAY['dd-MMM-yyyy', 'dd/MM/yyyy'],
   true, 'system')
ON CONFLICT DO NOTHING;