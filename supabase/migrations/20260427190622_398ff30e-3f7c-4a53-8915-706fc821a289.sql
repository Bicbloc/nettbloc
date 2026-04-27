-- Backfill technician_profiles for existing auth users with role=technician metadata
INSERT INTO public.technician_profiles (id, email, name, phone, is_active, specialties, certifications)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1), 'Technicien'),
  u.raw_user_meta_data->>'phone',
  true,
  ARRAY[]::text[],
  '[]'::jsonb
FROM auth.users u
LEFT JOIN public.technician_profiles tp ON tp.id = u.id OR lower(tp.email) = lower(u.email)
WHERE (u.raw_user_meta_data->>'role' = 'technician'
       OR u.raw_user_meta_data->>'user_type' = 'technician')
  AND tp.id IS NULL
  AND u.email IS NOT NULL
ON CONFLICT (id) DO NOTHING;