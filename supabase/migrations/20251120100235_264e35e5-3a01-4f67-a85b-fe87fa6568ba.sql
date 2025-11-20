-- Table pour stocker l'historique des validations et erreurs
CREATE TABLE IF NOT EXISTS public.pattern_validation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  report_name TEXT NOT NULL,
  pms_type TEXT,
  validation_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metrics JSONB NOT NULL DEFAULT '{}',
  error_analysis JSONB DEFAULT '{}',
  annotations_count INTEGER DEFAULT 0,
  extracted_count INTEGER DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index pour améliorer les performances des requêtes
CREATE INDEX idx_validation_history_hotel ON public.pattern_validation_history(hotel_id);
CREATE INDEX idx_validation_history_date ON public.pattern_validation_history(validation_date DESC);
CREATE INDEX idx_validation_history_pms ON public.pattern_validation_history(pms_type);

-- RLS policies
ALTER TABLE public.pattern_validation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hotel admins can view their validation history"
  ON public.pattern_validation_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.hotels h
      WHERE h.id = pattern_validation_history.hotel_id
      AND h.user_id = auth.uid()
    )
  );

CREATE POLICY "Hotel admins can insert validation history"
  ON public.pattern_validation_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.hotels h
      WHERE h.id = pattern_validation_history.hotel_id
      AND h.user_id = auth.uid()
    )
  );

-- Fonction pour analyser les tendances d'erreurs
CREATE OR REPLACE FUNCTION public.analyze_error_trends(p_hotel_id UUID, p_days INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_field_errors JSONB;
  v_common_patterns JSONB;
BEGIN
  -- Analyser les erreurs par champ
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

  -- Construire le résultat
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
$$;

COMMENT ON TABLE public.pattern_validation_history IS 'Historique des validations de patterns pour analyse des erreurs récurrentes';
COMMENT ON FUNCTION public.analyze_error_trends IS 'Analyse les tendances d''erreurs sur une période donnée pour identifier les zones d''amélioration prioritaires';
