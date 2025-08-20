-- Fix subscription data inconsistency: sync plan with subscription_type
UPDATE profiles 
SET plan = subscription_type 
WHERE subscription_type = 'premium' AND plan != 'premium';

-- Update freeflex@bicbloc.eu specifically to premium
UPDATE profiles 
SET plan = 'premium', subscription_type = 'premium' 
WHERE email = 'freeflex@bicbloc.eu';