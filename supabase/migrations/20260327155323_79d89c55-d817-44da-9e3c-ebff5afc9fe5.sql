-- Change hotel email to remove conflict with housekeeper profile
UPDATE hotels SET email = 'getgrass24+5_establishment@gmail.com' WHERE id = '6fdcbbd4-da0e-4d51-8830-f02d123b37c7';
-- Also update the associated profile email to match
UPDATE profiles SET email = 'getgrass24+5_establishment@gmail.com' WHERE id = 'ea0e31d7-0306-431b-8391-2128bf587e0a';