-- Add PMS type and detection rules to report_training_patterns
ALTER TABLE public.report_training_patterns 
ADD COLUMN IF NOT EXISTS pms_type TEXT DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS detection_rules JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS accuracy_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS validation_notes TEXT;

-- Create index for faster PMS type queries
CREATE INDEX IF NOT EXISTS idx_report_training_patterns_pms_type 
ON public.report_training_patterns(pms_type);

-- Create index for JSONB detection rules
CREATE INDEX IF NOT EXISTS idx_report_training_patterns_detection_rules 
ON public.report_training_patterns USING GIN(detection_rules);

COMMENT ON COLUMN public.report_training_patterns.pms_type IS 'Type of PMS system (apaleo, medialog, space, etc.)';
COMMENT ON COLUMN public.report_training_patterns.detection_rules IS 'JSON structure containing extraction patterns and rules for this PMS type';
COMMENT ON COLUMN public.report_training_patterns.accuracy_score IS 'Accuracy score of extraction (0-1)';
COMMENT ON COLUMN public.report_training_patterns.validation_notes IS 'Notes from manual validation';