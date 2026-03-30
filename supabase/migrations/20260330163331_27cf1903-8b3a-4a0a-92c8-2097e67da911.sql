
-- Fix Marie de la croix's housekeepers.user_id to match her housekeeper_profiles.id
-- Her profile id is 3aae8e04-24b9-4898-bc4a-0bf566a08237 but housekeepers.user_id is 6f0b2a40-afe8-4a61-96c5-63435877e6e6
UPDATE public.housekeepers 
SET user_id = '3aae8e04-24b9-4898-bc4a-0bf566a08237'
WHERE id = '908874bc-584c-4b8e-ad5d-69d082ad5d76'
  AND name = 'Marie de la croix';
