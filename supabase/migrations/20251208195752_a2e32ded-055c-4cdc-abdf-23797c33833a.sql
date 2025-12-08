-- Mettre à jour le pattern existant pour le marquer comme validé
UPDATE report_training_patterns 
SET validated = true 
WHERE id = '9f1bbd66-b93a-4061-808b-555d2c3f76e7';

-- Également s'assurer que tous les patterns avec une attribution sont marqués validés
UPDATE report_training_patterns 
SET validated = true 
WHERE assigned_to_hotel_id IS NOT NULL 
  AND validated = false;