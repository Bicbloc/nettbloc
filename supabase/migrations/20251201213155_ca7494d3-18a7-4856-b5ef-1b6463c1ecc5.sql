-- Supprimer les doublons d'assignations, garder seulement la plus récente par chambre/hôtel/housekeeper
DELETE FROM assignments 
WHERE id NOT IN (
  SELECT DISTINCT ON (room_id, hotel_id, housekeeper_name) id
  FROM assignments
  WHERE status IN ('assigned', 'in_progress')
  ORDER BY room_id, hotel_id, housekeeper_name, created_at DESC
)
AND status IN ('assigned', 'in_progress');

-- Ajouter un index unique partiel pour éviter les futurs doublons d'assignations actives
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_assignment 
ON assignments (room_id, hotel_id) 
WHERE status IN ('assigned', 'in_progress');