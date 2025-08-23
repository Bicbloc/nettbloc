-- Fix final function security issues

-- These might be the remaining functions causing issues
ALTER FUNCTION public.cleanup_all_housekeepers_for_hotel(uuid) SET search_path = 'public';
ALTER FUNCTION public.approve_housekeeper_access_request(uuid, uuid) SET search_path = 'public';
ALTER FUNCTION public.log_housekeeper_action(uuid, text, text, text, text, text, uuid) SET search_path = 'public';