-- Scope pms_pending_rooms writes to hotel access
DROP POLICY IF EXISTS "Authenticated can update pending rooms" ON public.pms_pending_rooms;
DROP POLICY IF EXISTS "Authenticated can delete pending rooms" ON public.pms_pending_rooms;
DROP POLICY IF EXISTS "Authenticated can insert pending rooms" ON public.pms_pending_rooms;

CREATE POLICY "Hotel members can insert pending rooms"
ON public.pms_pending_rooms FOR INSERT TO authenticated
WITH CHECK (public.can_access_hotel(hotel_id));

CREATE POLICY "Hotel members can update pending rooms"
ON public.pms_pending_rooms FOR UPDATE TO authenticated
USING (public.can_access_hotel(hotel_id))
WITH CHECK (public.can_access_hotel(hotel_id));

CREATE POLICY "Hotel members can delete pending rooms"
ON public.pms_pending_rooms FOR DELETE TO authenticated
USING (public.can_access_hotel(hotel_id));

-- Fix mutable search_path on analyze_error_trends
CREATE OR REPLACE FUNCTION public.analyze_error_trends(p_hotel_id uuid, p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSONB;
  v_field_errors JSONB;
BEGIN
  SELECT jsonb_object_agg(
    field_name,
    jsonb_build_object(
      'total_failures', COUNT(*),
      'avg_precision', AVG((metrics->'fieldMetrics'->field_name->>'precision')::NUMERIC),
      'avg_recall', AVG((metrics->'fieldMetrics'->field_name->>'recall')::NUMERIC),
      'failure_rate', COUNT(*) FILTER (WHERE (metrics->'fieldMetrics'->field_name->>'f1Score')::NUMERIC < 0.5)::NUMERIC / COUNT(*)
    )
  ) INTO v_field_errors
  FROM public.pattern_validation_history,
       jsonb_object_keys(metrics->'fieldMetrics') AS field_name
  WHERE hotel_id = p_hotel_id
    AND validation_date >= NOW() - (p_days || ' days')::INTERVAL;

  v_result := jsonb_build_object(
    'hotel_id', p_hotel_id,
    'period_days', p_days,
    'field_errors', COALESCE(v_field_errors, '{}'::JSONB),
    'total_validations', (
      SELECT COUNT(*) 
      FROM public.pattern_validation_history
      WHERE hotel_id = p_hotel_id
        AND validation_date >= NOW() - (p_days || ' days')::INTERVAL
    ),
    'avg_overall_f1', (
      SELECT AVG((metrics->>'f1Score')::NUMERIC)
      FROM public.pattern_validation_history
      WHERE hotel_id = p_hotel_id
        AND validation_date >= NOW() - (p_days || ' days')::INTERVAL
    )
  );

  RETURN v_result;
END;
$function$;