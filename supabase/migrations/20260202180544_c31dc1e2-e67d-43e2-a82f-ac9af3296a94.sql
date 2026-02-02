-- Drop the incorrect INSERT policy
DROP POLICY IF EXISTS "Technicians can insert their own profile" ON public.technician_profiles;

-- Create a correct INSERT policy that allows authenticated users to create a profile
-- The policy checks that the email matches the authenticated user's email
CREATE POLICY "Technicians can create their own profile"
ON public.technician_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Also fix the SELECT and UPDATE policies to use email instead of id
DROP POLICY IF EXISTS "Technicians can view their own profile" ON public.technician_profiles;
DROP POLICY IF EXISTS "Technicians can update their own profile" ON public.technician_profiles;

CREATE POLICY "Technicians can view their own profile"
ON public.technician_profiles
FOR SELECT
TO authenticated
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Technicians can update their own profile"
ON public.technician_profiles
FOR UPDATE
TO authenticated
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
WITH CHECK (email = (SELECT email FROM auth.users WHERE id = auth.uid()));