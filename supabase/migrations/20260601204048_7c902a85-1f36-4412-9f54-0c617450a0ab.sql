ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_plan_check
CHECK (plan = ANY (ARRAY[
  'free'::text, 'freemium'::text, 'basic'::text, 'basic_plus'::text,
  'premium'::text, 'platinum'::text,
  'decouverte'::text, 'essentiel'::text, 'confort'::text,
  'business'::text, 'entreprise'::text
]));