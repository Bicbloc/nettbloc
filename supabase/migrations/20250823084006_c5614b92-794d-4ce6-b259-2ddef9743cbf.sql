-- Fix the last function and check for trigger function
ALTER FUNCTION public.handle_new_user() SET search_path = 'public';