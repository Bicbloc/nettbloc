-- Add new incident statuses for technicians: postponed and parts_ordered
-- These are used by technicians to track work progress

-- First, let's check if we need to update any constraints
-- No constraints exist on incident status, so we can just use the new values directly

-- Add a comment to document the available statuses
COMMENT ON COLUMN incidents.status IS 'Available statuses: new, in_progress, resolved, postponed, parts_ordered';