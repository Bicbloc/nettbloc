-- Add attribution columns to report_training_patterns
ALTER TABLE report_training_patterns 
  ADD COLUMN IF NOT EXISTS assigned_to_hotel_id UUID REFERENCES hotels(id),
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pattern_name TEXT,
  ADD COLUMN IF NOT EXISTS attribution_reason TEXT;

-- Create index for faster pattern lookups
CREATE INDEX IF NOT EXISTS idx_report_training_patterns_hotel_assignment 
  ON report_training_patterns(assigned_to_hotel_id) WHERE assigned_to_hotel_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_report_training_patterns_default 
  ON report_training_patterns(is_default) WHERE is_default = true;