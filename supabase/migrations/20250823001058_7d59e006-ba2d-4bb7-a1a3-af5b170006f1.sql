-- Fix final function security issues

-- These are likely the remaining functions
ALTER FUNCTION public.log_admin_action(text, uuid, jsonb) SET search_path = 'public';
ALTER FUNCTION public.extend_trial_period(uuid, integer, text) SET search_path = 'public';
ALTER FUNCTION public.change_subscription_status(uuid, text, text) SET search_path = 'public';