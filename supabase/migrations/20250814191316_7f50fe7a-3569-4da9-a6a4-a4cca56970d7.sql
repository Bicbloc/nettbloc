-- Add super_admin role to aminekhellas2@gmail.com
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::app_role
FROM auth.users
WHERE email = 'aminekhellas2@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;