-- Ajouter une colonne plan dans profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'premium'));

-- Ajouter table pour les abonnements Stripe
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  status TEXT DEFAULT 'active',
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Activer RLS sur subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Politique pour que les utilisateurs voient leur propre abonnement
CREATE POLICY "Users can view own subscription" ON public.subscriptions
FOR SELECT
USING (user_id = auth.uid());

-- Politique pour les edge functions pour mettre à jour les abonnements
CREATE POLICY "Service can update subscriptions" ON public.subscriptions
FOR ALL
USING (true);

-- Trigger pour updated_at sur subscriptions
CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();