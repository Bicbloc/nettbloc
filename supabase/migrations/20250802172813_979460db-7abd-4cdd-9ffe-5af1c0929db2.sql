-- Nettoyer les codes d'accès en double pour avoir un seul code par housekeeper
-- D'abord, désactiver tous les anciens codes sauf le plus récent pour chaque housekeeper

UPDATE housekeeper_access_codes 
SET is_active = false 
WHERE housekeeper_id = '81eb4f57-d272-479a-84fb-96f1d96fb072' 
  AND access_code != 'HTL002-4480';

-- Également s'assurer qu'il n'y a pas de code orphelin
UPDATE housekeeper_access_codes 
SET is_active = false 
WHERE housekeeper_id IS NULL;

-- Mettre à jour le code d'accès de Julien dans la table housekeepers pour correspondre
UPDATE housekeepers 
SET access_code = 'HTL002-4480' 
WHERE id = '81eb4f57-d272-479a-84fb-96f1d96fb072';