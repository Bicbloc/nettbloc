
-- Rename plan names in pricing_config
UPDATE public.pricing_config SET plan_name = 'decouverte' WHERE plan_name = 'freemium';
UPDATE public.pricing_config SET plan_name = 'essentiel' WHERE plan_name = 'basic';
UPDATE public.pricing_config SET plan_name = 'confort' WHERE plan_name = 'premium';
UPDATE public.pricing_config SET plan_name = 'business' WHERE plan_name = 'basic_plus';
UPDATE public.pricing_config SET plan_name = 'entreprise' WHERE plan_name = 'platinum';

-- Rename subscription_type in profiles
UPDATE public.profiles SET subscription_type = 'decouverte' WHERE subscription_type = 'freemium';
UPDATE public.profiles SET subscription_type = 'essentiel' WHERE subscription_type = 'basic';
UPDATE public.profiles SET subscription_type = 'confort' WHERE subscription_type = 'premium';
UPDATE public.profiles SET subscription_type = 'business' WHERE subscription_type = 'basic_plus';
UPDATE public.profiles SET subscription_type = 'entreprise' WHERE subscription_type = 'platinum';
