-- Supprimer l'ancienne contrainte CHECK si elle existe
ALTER TABLE public.hotel_cleaning_rules 
DROP CONSTRAINT IF EXISTS hotel_cleaning_rules_result_cleaning_type_check;

-- Ajouter une nouvelle contrainte qui accepte les deux formats
ALTER TABLE public.hotel_cleaning_rules 
ADD CONSTRAINT hotel_cleaning_rules_result_cleaning_type_check 
CHECK (result_cleaning_type IN ('full', 'quick', 'none', 'a_blanc', 'recouche'));

-- Ajouter les nouvelles colonnes
ALTER TABLE public.hotel_cleaning_rules 
ADD COLUMN IF NOT EXISTS condition_logic text DEFAULT 'AND',
ADD COLUMN IF NOT EXISTS display_name text;

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_hotel_cleaning_rules_hotel_priority 
ON public.hotel_cleaning_rules(hotel_id, priority DESC);