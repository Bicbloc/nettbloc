-- Fix remaining function security issues

-- Fix the remaining functions that need search_path
ALTER FUNCTION public.log_password_reset_request(text, inet, text) SET search_path = 'public';
ALTER FUNCTION public.can_manage_hotel_data(uuid) SET search_path = 'public';
ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = 'public';
ALTER FUNCTION public.get_housekeeper_profile_id() SET search_path = 'public';