CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Per-hotel outbound webhooks
CREATE TABLE public.hotel_webhooks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Webhook',
  provider text NOT NULL DEFAULT 'slack',
  target_url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hotel_webhooks TO authenticated;
GRANT SELECT ON public.hotel_webhooks TO anon;
GRANT ALL ON public.hotel_webhooks TO service_role;

ALTER TABLE public.hotel_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hotel managers manage webhooks"
  ON public.hotel_webhooks FOR ALL
  USING (can_access_hotel(hotel_id))
  WITH CHECK (can_access_hotel(hotel_id));

-- Delivery log
CREATE TABLE public.webhook_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id uuid NOT NULL,
  webhook_id uuid,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  response_code integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hotel managers view deliveries"
  ON public.webhook_deliveries FOR SELECT
  USING (can_access_hotel(hotel_id));

-- Private technical config (function url + anon key) - no anon/authenticated grants
CREATE TABLE public.webhook_dispatch_config (
  id integer PRIMARY KEY DEFAULT 1,
  function_url text NOT NULL,
  anon_key text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
GRANT ALL ON public.webhook_dispatch_config TO service_role;
ALTER TABLE public.webhook_dispatch_config ENABLE ROW LEVEL SECURITY;

-- updated_at triggers
CREATE TRIGGER update_hotel_webhooks_updated_at
  BEFORE UPDATE ON public.hotel_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Dispatch trigger function: notifies the edge function via pg_net
CREATE OR REPLACE FUNCTION public.trigger_dispatch_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  cfg public.webhook_dispatch_config%ROWTYPE;
  evt text := TG_ARGV[0];
  payload jsonb;
BEGIN
  SELECT * INTO cfg FROM public.webhook_dispatch_config WHERE id = 1;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Only fire on UPDATE when status actually changes
  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) ->> 'status') IS NOT DISTINCT FROM (to_jsonb(OLD) ->> 'status') THEN
      RETURN NEW;
    END IF;
  END IF;

  payload := jsonb_build_object(
    'hotel_id', NEW.hotel_id,
    'event_type', evt,
    'record', to_jsonb(NEW)
  );

  PERFORM net.http_post(
    url := cfg.function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', cfg.anon_key,
      'Authorization', 'Bearer ' || cfg.anon_key
    ),
    body := payload
  );

  RETURN NEW;
END;
$$;

-- Attach triggers
CREATE TRIGGER dispatch_incident_created
  AFTER INSERT ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.trigger_dispatch_webhook('incident.created');

CREATE TRIGGER dispatch_incident_updated
  AFTER UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.trigger_dispatch_webhook('incident.updated');

CREATE TRIGGER dispatch_lost_found_created
  AFTER INSERT ON public.lost_and_found
  FOR EACH ROW EXECUTE FUNCTION public.trigger_dispatch_webhook('lost_found.created');

CREATE TRIGGER dispatch_task_created
  AFTER INSERT ON public.manual_tasks
  FOR EACH ROW EXECUTE FUNCTION public.trigger_dispatch_webhook('task.created');

CREATE TRIGGER dispatch_task_updated
  AFTER UPDATE ON public.manual_tasks
  FOR EACH ROW EXECUTE FUNCTION public.trigger_dispatch_webhook('task.updated');

CREATE TRIGGER dispatch_report_created
  AFTER INSERT ON public.daily_reports
  FOR EACH ROW EXECUTE FUNCTION public.trigger_dispatch_webhook('report.created');