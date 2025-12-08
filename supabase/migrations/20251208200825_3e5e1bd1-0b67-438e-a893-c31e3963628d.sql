-- Corriger les données existantes: synchroniser cleaning_type depuis room_type si nécessaire
UPDATE rooms 
SET cleaning_type = room_type 
WHERE cleaning_type IS NULL AND room_type IS NOT NULL;

-- Mettre cleaning_type à 'none' pour les chambres propres
UPDATE rooms 
SET cleaning_type = 'none' 
WHERE status = 'clean' AND (cleaning_type IS NULL OR cleaning_type = '');

-- Normaliser les valeurs: s'assurer que cleaning_type est 'full', 'quick', ou 'none'
UPDATE rooms 
SET cleaning_type = 'full' 
WHERE cleaning_type IN ('a_blanc', 'checkout', 'arrival');

UPDATE rooms 
SET cleaning_type = 'quick' 
WHERE cleaning_type IN ('recouche', 'stayover');