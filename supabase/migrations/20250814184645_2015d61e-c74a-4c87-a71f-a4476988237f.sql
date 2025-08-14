-- Nettoyer les hôtels en doublon en gardant le plus récent pour chaque user_id
WITH duplicates AS (
  SELECT 
    user_id,
    email,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn,
    id
  FROM hotels 
  WHERE user_id IS NOT NULL
),
hotels_to_delete AS (
  SELECT id FROM duplicates WHERE rn > 1
)
DELETE FROM hotels WHERE id IN (SELECT id FROM hotels_to_delete);

-- Supprimer les hôtels orphelins sans user_id qui ont un email correspondant à un utilisateur avec un hôtel
DELETE FROM hotels 
WHERE user_id IS NULL 
AND email IN (
  SELECT DISTINCT email 
  FROM hotels 
  WHERE user_id IS NOT NULL
);