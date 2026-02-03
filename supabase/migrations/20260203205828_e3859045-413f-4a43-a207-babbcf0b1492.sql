-- Update freemium plan to 15 rooms max
UPDATE pricing_config 
SET max_rooms = 15, updated_at = now()
WHERE plan_name = 'freemium';