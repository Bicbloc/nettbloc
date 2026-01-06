-- Add GoCardless columns to subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS gocardless_customer_id TEXT,
ADD COLUMN IF NOT EXISTS gocardless_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS gocardless_mandate_id TEXT;

-- Create pending_subscriptions table for GoCardless billing request flow
CREATE TABLE IF NOT EXISTS public.pending_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  billing_request_id TEXT NOT NULL,
  plan_type TEXT NOT NULL DEFAULT 'premium',
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pending_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies for pending_subscriptions
CREATE POLICY "Users can view their own pending subscriptions"
  ON public.pending_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage pending subscriptions"
  ON public.pending_subscriptions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pending_subscriptions_user_id ON public.pending_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_subscriptions_billing_request_id ON public.pending_subscriptions(billing_request_id);