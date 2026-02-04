-- Fix technician_profiles RLS policies to use auth.email() instead of subquery on auth.users
-- This prevents "permission denied for table users" errors

-- Drop existing policies
DROP POLICY IF EXISTS "Technicians can view their own profile" ON technician_profiles;
DROP POLICY IF EXISTS "Technicians can update their own profile" ON technician_profiles;
DROP POLICY IF EXISTS "Technicians can create their own profile" ON technician_profiles;

-- Recreate policies using auth.email() which is accessible
CREATE POLICY "Technicians can view their own profile"
ON technician_profiles FOR SELECT
TO authenticated
USING (LOWER(email) = LOWER(auth.email()));

CREATE POLICY "Technicians can update their own profile"
ON technician_profiles FOR UPDATE
TO authenticated
USING (LOWER(email) = LOWER(auth.email()))
WITH CHECK (LOWER(email) = LOWER(auth.email()));

CREATE POLICY "Technicians can create their own profile"
ON technician_profiles FOR INSERT
TO authenticated
WITH CHECK (LOWER(email) = LOWER(auth.email()));