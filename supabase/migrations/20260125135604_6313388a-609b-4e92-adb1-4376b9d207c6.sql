-- Table pour stocker les configurations d'apprentissage par hôtel
CREATE TABLE public.hotel_report_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  config_name TEXT NOT NULL DEFAULT 'default',
  
  -- Structure des colonnes définies par l'utilisateur
  column_mappings JSONB NOT NULL DEFAULT '[]',
  -- Format: [{ "columnIndex": 0, "columnName": "Chambre", "type": "room_number", "enabled": true, "order": 0 }]
  
  -- Mappings des statuts vers types de nettoyage
  status_mappings JSONB NOT NULL DEFAULT '{}',
  -- Format: { "DIR": "quick", "INS": "none", "SAL": "full", ... }
  
  -- Patterns d'exclusion (lignes à ignorer)
  exclusion_patterns TEXT[] DEFAULT '{}',
  -- Format: ["Étage", "Floor", "Total", ...]
  
  -- Corrections manuelles appliquées (pour apprentissage)
  manual_corrections JSONB DEFAULT '[]',
  -- Format: [{ "roomNumber": "101", "field": "guestName", "originalValue": "", "correctedValue": "Jean Dupont" }]
  
  -- Métadonnées
  detected_format TEXT, -- 'mews_space_status', 'apaleo_housekeeping', etc.
  last_used_at TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(hotel_id, config_name)
);

-- Index pour recherche rapide
CREATE INDEX idx_hotel_report_configs_hotel ON public.hotel_report_configs(hotel_id);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_hotel_report_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_hotel_report_configs_timestamp
  BEFORE UPDATE ON public.hotel_report_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_hotel_report_configs_updated_at();

-- RLS
ALTER TABLE public.hotel_report_configs ENABLE ROW LEVEL SECURITY;

-- Politique: les propriétaires d'hôtel peuvent gérer leurs configs
CREATE POLICY "Hotel owners can manage their report configs"
  ON public.hotel_report_configs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.hotels 
      WHERE id = hotel_report_configs.hotel_id 
      AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.hotels 
      WHERE id = hotel_report_configs.hotel_id 
      AND user_id = auth.uid()
    )
  );

-- Politique: les utilisateurs d'hôtel peuvent voir les configs
CREATE POLICY "Hotel users can view report configs"
  ON public.hotel_report_configs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.hotel_users 
      WHERE hotel_id = hotel_report_configs.hotel_id 
      AND user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.hotel_report_configs IS 'Stocke les configurations d''apprentissage des rapports par hôtel';