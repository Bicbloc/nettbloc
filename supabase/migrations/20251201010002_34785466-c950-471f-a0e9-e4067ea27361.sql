-- Phase 1: Ajouter la colonne cleaning_type à la table rooms
ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS cleaning_type text DEFAULT 'full';

-- Phase 2: Ajouter les politiques RLS pour les femmes de chambre

-- Permettre aux femmes de chambre de lire les catégories d'incidents
CREATE POLICY "Housekeepers can view incident categories"
  ON incident_categories FOR SELECT
  USING (true);

-- Permettre aux femmes de chambre de lire les items
CREATE POLICY "Housekeepers can view incident items"
  ON incident_items FOR SELECT
  USING (true);

-- Permettre aux femmes de chambre de lire les types
CREATE POLICY "Housekeepers can view incident types"
  ON incident_types FOR SELECT
  USING (true);

-- Permettre aux femmes de chambre de lire les rôles
CREATE POLICY "Housekeepers can view staff roles"
  ON staff_roles FOR SELECT
  USING (true);