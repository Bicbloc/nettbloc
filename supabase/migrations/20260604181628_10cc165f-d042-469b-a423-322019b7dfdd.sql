
-- Ensure full row data is broadcast on UPDATE/DELETE for all realtime tables
ALTER TABLE public.daily_reports REPLICA IDENTITY FULL;
ALTER TABLE public.manual_tasks REPLICA IDENTITY FULL;
ALTER TABLE public.housekeepers REPLICA IDENTITY FULL;
ALTER TABLE public.equipment_issues REPLICA IDENTITY FULL;
ALTER TABLE public.equipments REPLICA IDENTITY FULL;
ALTER TABLE public.room_inspections REPLICA IDENTITY FULL;
ALTER TABLE public.lost_and_found REPLICA IDENTITY FULL;
ALTER TABLE public.lost_and_found_history REPLICA IDENTITY FULL;

-- Add the missing tables to the realtime publication
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='daily_reports') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_reports;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='manual_tasks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.manual_tasks;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='housekeepers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.housekeepers;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='equipment_issues') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.equipment_issues;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='equipments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.equipments;
  END IF;
END $$;
