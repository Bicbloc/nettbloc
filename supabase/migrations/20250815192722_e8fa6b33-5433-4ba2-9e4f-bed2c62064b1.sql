-- Phase 1: New optimized database schema
-- Drop all old complex tables and create 4 core tables

-- Drop old tables that create conflicts and complexity
DROP TABLE IF EXISTS public.hotel_sessions CASCADE;
DROP TABLE IF EXISTS public.hotel_access_sessions CASCADE;
DROP TABLE IF EXISTS public.housekeeper_access_codes CASCADE;
DROP TABLE IF EXISTS public.housekeeper_tokens CASCADE;
DROP TABLE IF EXISTS public.housekeeper_access_requests CASCADE;
DROP TABLE IF EXISTS public.housekeeper_invitations CASCADE;
DROP TABLE IF EXISTS public.hotel_users CASCADE;
DROP TABLE IF EXISTS public.room_status_updates CASCADE;
DROP TABLE IF EXISTS public.daily_reports CASCADE;

-- Keep essential tables but clean them up
-- Hotels table - simplified
ALTER TABLE public.hotels DROP COLUMN IF EXISTS hotel_code;
ALTER TABLE public.hotels ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE public.hotels ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{"auto_assign": true, "notification_enabled": true}';

-- New core table: Rooms
CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  room_number text NOT NULL,
  floor integer,
  room_type text DEFAULT 'standard',
  status text NOT NULL DEFAULT 'available', -- available, occupied, cleaning, maintenance, out_of_order
  cleaning_priority integer DEFAULT 1, -- 1=low, 2=medium, 3=high, 4=urgent
  estimated_time integer DEFAULT 30, -- minutes
  notes text,
  last_cleaned_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(hotel_id, room_number)
);

-- New core table: Assignments
CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  housekeeper_name text NOT NULL,
  housekeeper_id text, -- Simple identifier, not FK
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  status text NOT NULL DEFAULT 'assigned', -- assigned, in_progress, completed, skipped
  estimated_duration integer DEFAULT 30,
  actual_duration integer,
  notes text,
  assigned_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- New core table: Activities (centralized logging)
CREATE TABLE IF NOT EXISTS public.activities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  activity_type text NOT NULL, -- room_assigned, cleaning_started, cleaning_completed, status_changed, etc.
  entity_type text NOT NULL, -- room, assignment, hotel
  entity_id uuid NOT NULL,
  actor_name text, -- Who performed the action
  actor_type text DEFAULT 'housekeeper', -- housekeeper, admin, system
  details jsonb DEFAULT '{}',
  metadata jsonb DEFAULT '{}', -- For extensibility
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rooms_hotel_status ON public.rooms(hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_assignments_hotel_status ON public.assignments(hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_assignments_housekeeper ON public.assignments(hotel_id, housekeeper_id);
CREATE INDEX IF NOT EXISTS idx_activities_hotel_type ON public.activities(hotel_id, activity_type);
CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON public.activities(timestamp DESC);

-- Enable RLS on new tables
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rooms
CREATE POLICY "Hotel owners can manage their rooms"
ON public.rooms FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h 
    WHERE h.id = rooms.hotel_id AND h.user_id = auth.uid()
  )
);

-- RLS Policies for assignments
CREATE POLICY "Hotel owners can manage their assignments"
ON public.assignments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h 
    WHERE h.id = assignments.hotel_id AND h.user_id = auth.uid()
  )
);

-- RLS Policies for activities
CREATE POLICY "Hotel owners can view their activities"
ON public.activities FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h 
    WHERE h.id = activities.hotel_id AND h.user_id = auth.uid()
  )
);

CREATE POLICY "Anyone can insert activities"
ON public.activities FOR INSERT
WITH CHECK (true);

-- Update triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to log activities
CREATE OR REPLACE FUNCTION log_activity(
  p_hotel_id uuid,
  p_activity_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_actor_name text DEFAULT NULL,
  p_actor_type text DEFAULT 'system',
  p_details jsonb DEFAULT '{}'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  activity_id uuid;
BEGIN
  INSERT INTO public.activities (
    hotel_id, activity_type, entity_type, entity_id, 
    actor_name, actor_type, details
  ) VALUES (
    p_hotel_id, p_activity_type, p_entity_type, p_entity_id,
    p_actor_name, p_actor_type, p_details
  ) RETURNING id INTO activity_id;
  
  RETURN activity_id;
END;
$$;