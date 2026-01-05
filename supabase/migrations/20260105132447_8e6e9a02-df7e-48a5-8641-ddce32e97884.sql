-- Table pour les templates de rapport (instructions et tâches réutilisables)
CREATE TABLE public.report_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('todo', 'toknow', 'instructions')),
  content JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable Row Level Security
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their hotel templates" 
ON public.report_templates 
FOR SELECT 
USING (
  hotel_id IN (
    SELECT id FROM public.hotels WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create templates for their hotels" 
ON public.report_templates 
FOR INSERT 
WITH CHECK (
  hotel_id IN (
    SELECT id FROM public.hotels WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their hotel templates" 
ON public.report_templates 
FOR UPDATE 
USING (
  hotel_id IN (
    SELECT id FROM public.hotels WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their hotel templates" 
ON public.report_templates 
FOR DELETE 
USING (
  hotel_id IN (
    SELECT id FROM public.hotels WHERE user_id = auth.uid()
  )
);

-- Create index for performance
CREATE INDEX idx_report_templates_hotel_id ON public.report_templates(hotel_id);
CREATE INDEX idx_report_templates_type ON public.report_templates(template_type);

-- Trigger for updated_at
CREATE TRIGGER update_report_templates_updated_at
BEFORE UPDATE ON public.report_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();