-- Create a trigger to automatically create technician profile on signup
-- This bypasses RLS issues during the signup flow

CREATE OR REPLACE FUNCTION public.handle_technician_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the user metadata indicates they're a technician
  IF NEW.raw_user_meta_data->>'role' = 'technician' THEN
    INSERT INTO public.technician_profiles (id, email, name, phone, is_active, specialties, certifications)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', 'Technicien'),
      NEW.raw_user_meta_data->>'phone',
      true,
      ARRAY[]::text[],
      '[]'::jsonb
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users for technician signups
DROP TRIGGER IF EXISTS on_technician_signup ON auth.users;
CREATE TRIGGER on_technician_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_technician_signup();