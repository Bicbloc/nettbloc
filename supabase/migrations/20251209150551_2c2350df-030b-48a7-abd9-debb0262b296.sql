-- Corriger l'attribution du pattern Apaleo: de "Hotel B" vers "Hotel le B"
UPDATE public.report_training_patterns 
SET assigned_to_hotel_id = 'c37cb704-6224-4b73-bcf7-0fdb5e1790ae'
WHERE assigned_to_hotel_id = '617ff6c1-d219-4d7d-9cc7-d9c3eed4303c'
AND pms_type IN ('apaleo', 'booking');