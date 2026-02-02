-- Table des livraisons de linge
CREATE TABLE public.linen_deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_name TEXT,
  delivery_reference TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'reconciled')),
  created_by UUID,
  validated_by UUID,
  validated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Détail des articles livrés par type de linge
CREATE TABLE public.linen_delivery_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id UUID NOT NULL REFERENCES public.linen_deliveries(id) ON DELETE CASCADE,
  linen_type_id UUID NOT NULL REFERENCES public.linen_types(id) ON DELETE CASCADE,
  quantity_delivered INTEGER NOT NULL DEFAULT 0,
  quantity_counted INTEGER,
  difference INTEGER GENERATED ALWAYS AS (COALESCE(quantity_counted, 0) - quantity_delivered) STORED,
  notes TEXT,
  counted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index pour performance
CREATE INDEX idx_linen_deliveries_hotel_date ON public.linen_deliveries(hotel_id, delivery_date DESC);
CREATE INDEX idx_linen_delivery_items_delivery ON public.linen_delivery_items(delivery_id);

-- Trigger pour updated_at
CREATE TRIGGER update_linen_deliveries_updated_at
  BEFORE UPDATE ON public.linen_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.linen_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linen_delivery_items ENABLE ROW LEVEL SECURITY;

-- Policies pour linen_deliveries
CREATE POLICY "Users can view their hotel deliveries"
  ON public.linen_deliveries FOR SELECT
  USING (hotel_id IN (SELECT id FROM public.hotels WHERE user_id = auth.uid()));

CREATE POLICY "Users can create deliveries for their hotel"
  ON public.linen_deliveries FOR INSERT
  WITH CHECK (hotel_id IN (SELECT id FROM public.hotels WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their hotel deliveries"
  ON public.linen_deliveries FOR UPDATE
  USING (hotel_id IN (SELECT id FROM public.hotels WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their hotel deliveries"
  ON public.linen_deliveries FOR DELETE
  USING (hotel_id IN (SELECT id FROM public.hotels WHERE user_id = auth.uid()));

-- Policies pour linen_delivery_items
CREATE POLICY "Users can view delivery items"
  ON public.linen_delivery_items FOR SELECT
  USING (delivery_id IN (
    SELECT id FROM public.linen_deliveries 
    WHERE hotel_id IN (SELECT id FROM public.hotels WHERE user_id = auth.uid())
  ));

CREATE POLICY "Users can create delivery items"
  ON public.linen_delivery_items FOR INSERT
  WITH CHECK (delivery_id IN (
    SELECT id FROM public.linen_deliveries 
    WHERE hotel_id IN (SELECT id FROM public.hotels WHERE user_id = auth.uid())
  ));

CREATE POLICY "Users can update delivery items"
  ON public.linen_delivery_items FOR UPDATE
  USING (delivery_id IN (
    SELECT id FROM public.linen_deliveries 
    WHERE hotel_id IN (SELECT id FROM public.hotels WHERE user_id = auth.uid())
  ));

CREATE POLICY "Users can delete delivery items"
  ON public.linen_delivery_items FOR DELETE
  USING (delivery_id IN (
    SELECT id FROM public.linen_deliveries 
    WHERE hotel_id IN (SELECT id FROM public.hotels WHERE user_id = auth.uid())
  ));