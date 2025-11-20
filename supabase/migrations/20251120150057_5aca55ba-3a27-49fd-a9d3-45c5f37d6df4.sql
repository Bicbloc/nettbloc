-- Table pour stocker les règles personnalisées de chambres connectées
CREATE TABLE IF NOT EXISTS public.connected_room_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL, -- 'family', 'suite', 'twin', 'connecting', 'custom'
  pattern_regex TEXT NOT NULL, -- Expression régulière pour détecter le pattern
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 1, -- Plus le nombre est élevé, plus la priorité est haute
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour améliorer les performances
CREATE INDEX idx_connected_room_rules_hotel ON public.connected_room_rules(hotel_id);
CREATE INDEX idx_connected_room_rules_active ON public.connected_room_rules(hotel_id, is_active);

-- RLS Policies
ALTER TABLE public.connected_room_rules ENABLE ROW LEVEL SECURITY;

-- Les propriétaires d'hôtel peuvent gérer leurs règles
CREATE POLICY "Hotel owners can manage their connected room rules"
ON public.connected_room_rules
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = connected_room_rules.hotel_id
    AND h.user_id = auth.uid()
  )
);

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER update_connected_room_rules_updated_at
BEFORE UPDATE ON public.connected_room_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Ajouter quelques règles par défaut communes
COMMENT ON TABLE public.connected_room_rules IS 'Règles personnalisées pour détecter et lier les chambres connectées (suites, familiales, etc.)';
COMMENT ON COLUMN public.connected_room_rules.rule_type IS 'Type de règle: family (familiale), suite, twin (jumelle), connecting (communicante), custom (personnalisée)';
COMMENT ON COLUMN public.connected_room_rules.pattern_regex IS 'Expression régulière pour détecter le pattern de chambres connectées';
COMMENT ON COLUMN public.connected_room_rules.priority IS 'Priorité de la règle (plus élevée = appliquée en premier)';