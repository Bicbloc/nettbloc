-- Fix security warnings: Add missing search_path to functions for security

-- Fix function search_path issues for better security
ALTER FUNCTION public.update_last_activity() SET search_path = 'public';
ALTER FUNCTION public.cleanup_inactive_sessions() SET search_path = 'public';
ALTER FUNCTION public.cleanup_expired_hotel_sessions() SET search_path = 'public';
ALTER FUNCTION public.auto_generate_hotel_code() SET search_path = 'public';
ALTER FUNCTION public.generate_hotel_access_code(uuid) SET search_path = 'public';
ALTER FUNCTION public.validate_access_code_for_hotel(text, uuid) SET search_path = 'public';
ALTER FUNCTION public.validate_hotel_id() SET search_path = 'public';
ALTER FUNCTION public.generate_short_hotel_id() SET search_path = 'public';
ALTER FUNCTION public.generate_temporary_hotel_access_code(uuid, uuid, integer) SET search_path = 'public';
ALTER FUNCTION public.validate_housekeeper_access_code(text, uuid) SET search_path = 'public';
ALTER FUNCTION public.request_password_reset(text) SET search_path = 'public';
ALTER FUNCTION public.generate_housekeeper_access_code(uuid, uuid) SET search_path = 'public';
ALTER FUNCTION public.ensure_hotel_code() SET search_path = 'public';
ALTER FUNCTION public.generate_housekeeper_access_code_with_name(uuid, uuid, text) SET search_path = 'public';
ALTER FUNCTION public.generate_housekeeper_access_code_simple(uuid, text) SET search_path = 'public';
ALTER FUNCTION public.fix_access_code_inconsistencies() SET search_path = 'public';
ALTER FUNCTION public.update_updated_at_column() SET search_path = 'public';