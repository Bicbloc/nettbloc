-- Phase 3.1: Ajouter l'épaisseur configurable par type de linge
ALTER TABLE public.linen_types 
ADD COLUMN IF NOT EXISTS average_thickness_cm DECIMAL(3,1) DEFAULT 2.0;

-- Phase 3.2: Ajouter les métadonnées contextuelles pour l'apprentissage
ALTER TABLE public.linen_training_samples 
ADD COLUMN IF NOT EXISTS scan_method TEXT DEFAULT 'pile' CHECK (scan_method IN ('pile', 'spread', 'ruler', 'vrac')),
ADD COLUMN IF NOT EXISTS lighting_conditions TEXT DEFAULT 'good' CHECK (lighting_conditions IN ('good', 'dim', 'bright', 'mixed')),
ADD COLUMN IF NOT EXISTS ruler_detected BOOLEAN DEFAULT false;

-- Mettre à jour les épaisseurs par défaut pour les types de linge courants
-- (Ces valeurs seront appliquées lors de la prochaine mise à jour des types)
COMMENT ON COLUMN public.linen_types.average_thickness_cm IS 'Épaisseur moyenne en cm quand plié: draps ~1.5cm, serviettes ~3cm, taies ~1cm';
COMMENT ON COLUMN public.linen_training_samples.scan_method IS 'Méthode de scan: pile (empilé), spread (étalé), ruler (avec règle), vrac';
COMMENT ON COLUMN public.linen_training_samples.lighting_conditions IS 'Conditions d''éclairage lors du scan';
COMMENT ON COLUMN public.linen_training_samples.ruler_detected IS 'True si la règle étalon a été détectée dans l''image';