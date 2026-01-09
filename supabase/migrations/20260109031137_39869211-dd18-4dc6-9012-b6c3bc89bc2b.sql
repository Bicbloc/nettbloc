-- Add billing info fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS billing_siret VARCHAR(14),
ADD COLUMN IF NOT EXISTS billing_address TEXT,
ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255);

-- Create invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Amounts in cents
  amount_ht INTEGER NOT NULL,
  tva_rate NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  tva_amount INTEGER NOT NULL,
  amount_ttc INTEGER NOT NULL,
  
  -- Plan info
  plan_type VARCHAR(50) NOT NULL,
  plan_name VARCHAR(100) NOT NULL,
  period_start DATE,
  period_end DATE,
  
  -- Customer billing info (snapshot at invoice time)
  customer_email VARCHAR(255) NOT NULL,
  customer_company_name VARCHAR(255),
  customer_siret VARCHAR(14),
  customer_address TEXT,
  customer_billing_email VARCHAR(255),
  
  -- Seller info (BicBloc)
  seller_name VARCHAR(255) NOT NULL DEFAULT 'BicBloc',
  seller_siret VARCHAR(14) NOT NULL DEFAULT '97864605700015',
  seller_address TEXT NOT NULL DEFAULT '60 RUE FRANCOIS IER 75008 PARIS',
  seller_email VARCHAR(255) NOT NULL DEFAULT 'support@bicbloc.eu',
  
  -- Payment reference
  payment_reference VARCHAR(255),
  payment_method VARCHAR(50) DEFAULT 'prelevement_sepa',
  
  status VARCHAR(20) NOT NULL DEFAULT 'paid',
  pdf_url TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sequence for invoice numbers (starting at 1)
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoices
CREATE POLICY "Users can view their own invoices" 
ON public.invoices 
FOR SELECT 
USING (auth.uid() = user_id);

-- Only system can insert/update invoices (via service role)
CREATE POLICY "Service role can manage invoices" 
ON public.invoices 
FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role');

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON public.invoices(invoice_date);

-- Trigger for updated_at
CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();