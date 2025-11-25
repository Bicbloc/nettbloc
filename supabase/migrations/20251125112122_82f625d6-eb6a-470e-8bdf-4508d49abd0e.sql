-- Nettoyer les doublons existants (garder l'entrée la plus récente avec is_active = true)
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY hotel_id, LOWER(name) 
      ORDER BY 
        CASE WHEN is_active THEN 0 ELSE 1 END,
        created_at DESC
    ) as rn
  FROM housekeepers
)
DELETE FROM housekeepers
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Créer un index unique pour empêcher les doublons actifs
-- Utilise LOWER(name) pour rendre la comparaison insensible à la casse
CREATE UNIQUE INDEX idx_housekeepers_unique_active_name 
ON housekeepers (hotel_id, LOWER(name)) 
WHERE is_active = true;

-- Ajouter un commentaire pour documenter la contrainte
COMMENT ON INDEX idx_housekeepers_unique_active_name IS 
'Empêche les doublons de femmes de chambre/techniciens actifs par hôtel (insensible à la casse)';