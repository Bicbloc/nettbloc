-- Phase 1: Nettoyer les sessions expirées
UPDATE hotel_access_sessions 
SET is_active = false 
WHERE expires_at < now() AND is_active = true;

-- Phase 2: Ajouter des politiques RLS plus permissives pour l'inventaire de linge
-- Permettre à tous de voir les types de linge
CREATE POLICY "Anyone can view linen types" ON linen_types
FOR SELECT USING (true);

-- Permettre à tous d'insérer des entrées d'inventaire
CREATE POLICY "Anyone can insert inventory entries" ON linen_inventory_entries
FOR INSERT WITH CHECK (true);

-- Permettre à tous de mettre à jour les tâches d'inventaire
CREATE POLICY "Anyone can update inventory tasks" ON linen_inventory_tasks
FOR UPDATE USING (true);

-- Phase 3: Rendre la colonne reported_by nullable pour les incidents
ALTER TABLE incidents ALTER COLUMN reported_by DROP NOT NULL;

-- Phase 4: Ajouter une politique RLS pour permettre la création d'incidents sans auth
CREATE POLICY "Anyone can create incidents" ON incidents
FOR INSERT WITH CHECK (true);