
CREATE TABLE public.phone_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  daily_housekeepers INTEGER NOT NULL DEFAULT 1,
  phone_count INTEGER NOT NULL DEFAULT 2,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 200.00,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 400.00,
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'confirmed', 'preparing', 'shipped', 'delivered')),
  tracking_number TEXT,
  shipping_address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.phone_orders ENABLE ROW LEVEL SECURITY;

-- Hotel owners can view their own orders
CREATE POLICY "Users can view their hotel phone orders"
ON public.phone_orders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hotels
    WHERE hotels.id = phone_orders.hotel_id
    AND hotels.user_id = auth.uid()
  )
);

-- Hotel owners can create orders
CREATE POLICY "Users can create phone orders for their hotel"
ON public.phone_orders
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.hotels
    WHERE hotels.id = phone_orders.hotel_id
    AND hotels.user_id = auth.uid()
  )
);

-- Admins can do everything (using service role or admin check)
CREATE POLICY "Service role full access to phone_orders"
ON public.phone_orders
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Trigger for updated_at
CREATE TRIGGER update_phone_orders_updated_at
BEFORE UPDATE ON public.phone_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
