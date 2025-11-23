-- Table pour définir les badges disponibles
CREATE TABLE public.achievement_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL, -- 'speed', 'quality', 'quantity', 'streak', 'special'
  criteria JSONB NOT NULL, -- Conditions pour débloquer le badge
  points INTEGER NOT NULL DEFAULT 0,
  rarity TEXT NOT NULL DEFAULT 'common', -- 'common', 'rare', 'epic', 'legendary'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table pour les badges débloqués par les femmes de chambre
CREATE TABLE public.housekeeper_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  housekeeper_id UUID NOT NULL,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  badge_code TEXT NOT NULL REFERENCES public.achievement_badges(code) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  progress JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(housekeeper_id, hotel_id, badge_code)
);

-- Table pour tracker l'expérience et le niveau
CREATE TABLE public.housekeeper_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  housekeeper_id UUID NOT NULL,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  current_level INTEGER NOT NULL DEFAULT 1,
  total_xp INTEGER NOT NULL DEFAULT 0,
  rooms_cleaned_count INTEGER NOT NULL DEFAULT 0,
  perfect_rooms_count INTEGER NOT NULL DEFAULT 0,
  speed_bonus_count INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(housekeeper_id, hotel_id)
);

-- Activer RLS
ALTER TABLE public.achievement_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.housekeeper_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.housekeeper_levels ENABLE ROW LEVEL SECURITY;

-- Policies pour achievement_badges (tous peuvent lire)
CREATE POLICY "Anyone can view badges"
  ON public.achievement_badges FOR SELECT
  USING (true);

-- Policies pour housekeeper_achievements
CREATE POLICY "Hotel owners can view achievements"
  ON public.housekeeper_achievements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.hotels h
      WHERE h.id = housekeeper_achievements.hotel_id
      AND h.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can insert achievements"
  ON public.housekeeper_achievements FOR INSERT
  WITH CHECK (true);

-- Policies pour housekeeper_levels
CREATE POLICY "Hotel owners can view levels"
  ON public.housekeeper_levels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.hotels h
      WHERE h.id = housekeeper_levels.hotel_id
      AND h.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can manage levels"
  ON public.housekeeper_levels FOR ALL
  USING (true);

-- Insérer les badges prédéfinis
INSERT INTO public.achievement_badges (code, name, description, icon, category, criteria, points, rarity) VALUES
  -- Badges de quantité
  ('first_room', 'Première Chambre', 'Nettoyez votre première chambre', '🎯', 'quantity', '{"rooms_cleaned": 1}', 10, 'common'),
  ('room_cleaner_10', 'Débutant', 'Nettoyez 10 chambres', '🧹', 'quantity', '{"rooms_cleaned": 10}', 50, 'common'),
  ('room_cleaner_50', 'Professionnel', 'Nettoyez 50 chambres', '⭐', 'quantity', '{"rooms_cleaned": 50}', 200, 'rare'),
  ('room_cleaner_100', 'Expert', 'Nettoyez 100 chambres', '🏆', 'quantity', '{"rooms_cleaned": 100}', 500, 'epic'),
  ('room_cleaner_500', 'Maître', 'Nettoyez 500 chambres', '👑', 'quantity', '{"rooms_cleaned": 500}', 2000, 'legendary'),
  
  -- Badges de vitesse
  ('speed_demon', 'Éclair', 'Nettoyez une chambre en moins de 15 minutes', '⚡', 'speed', '{"max_duration": 15}', 100, 'rare'),
  ('speed_master', 'Vitesse Pure', 'Nettoyez 10 chambres en moins de 20 minutes chacune', '🚀', 'speed', '{"speed_rooms": 10, "max_duration": 20}', 300, 'epic'),
  
  -- Badges de série (streak)
  ('streak_3', 'Régularité', 'Travaillez 3 jours consécutifs', '🔥', 'streak', '{"consecutive_days": 3}', 75, 'common'),
  ('streak_7', 'Engagement', 'Travaillez 7 jours consécutifs', '💪', 'streak', '{"consecutive_days": 7}', 200, 'rare'),
  ('streak_30', 'Dévouement', 'Travaillez 30 jours consécutifs', '🌟', 'streak', '{"consecutive_days": 30}', 1000, 'legendary'),
  
  -- Badges de qualité/perfection
  ('perfect_10', 'Perfectionniste', 'Complétez 10 chambres sans incident', '✨', 'quality', '{"perfect_rooms": 10}', 150, 'rare'),
  ('perfect_50', 'Sans Défaut', 'Complétez 50 chambres sans incident', '💎', 'quality', '{"perfect_rooms": 50}', 600, 'epic'),
  
  -- Badges spéciaux
  ('early_bird', 'Lève-Tôt', 'Commencez le travail avant 7h du matin', '🌅', 'special', '{"hour_before": 7}', 50, 'common'),
  ('night_owl', 'Couche-Tard', 'Terminez le travail après 22h', '🌙', 'special', '{"hour_after": 22}', 50, 'common'),
  ('daily_champion', 'Champion du Jour', 'Nettoyez plus de 15 chambres en une journée', '🥇', 'special', '{"rooms_in_day": 15}', 250, 'epic');

-- Fonction pour calculer le niveau basé sur l'XP
CREATE OR REPLACE FUNCTION calculate_level(total_xp INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Formule: niveau = floor(sqrt(xp / 100)) + 1
  -- Niveau 1: 0-99 XP
  -- Niveau 2: 100-399 XP
  -- Niveau 3: 400-899 XP
  -- Niveau 4: 900-1599 XP
  -- etc.
  RETURN FLOOR(SQRT(total_xp / 100.0)) + 1;
END;
$$;

-- Fonction pour ajouter de l'XP et vérifier les badges
CREATE OR REPLACE FUNCTION add_housekeeper_xp(
  p_housekeeper_id UUID,
  p_hotel_id UUID,
  p_xp_amount INTEGER,
  p_room_cleaned BOOLEAN DEFAULT false,
  p_is_perfect BOOLEAN DEFAULT false,
  p_is_fast BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_level_record RECORD;
  v_new_level INTEGER;
  v_level_up BOOLEAN := false;
  v_new_badges TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Upsert le niveau
  INSERT INTO public.housekeeper_levels (
    housekeeper_id,
    hotel_id,
    total_xp,
    rooms_cleaned_count,
    perfect_rooms_count,
    speed_bonus_count,
    last_activity_date,
    current_streak
  ) VALUES (
    p_housekeeper_id,
    p_hotel_id,
    p_xp_amount,
    CASE WHEN p_room_cleaned THEN 1 ELSE 0 END,
    CASE WHEN p_is_perfect THEN 1 ELSE 0 END,
    CASE WHEN p_is_fast THEN 1 ELSE 0 END,
    CURRENT_DATE,
    1
  )
  ON CONFLICT (housekeeper_id, hotel_id) DO UPDATE SET
    total_xp = housekeeper_levels.total_xp + p_xp_amount,
    rooms_cleaned_count = housekeeper_levels.rooms_cleaned_count + CASE WHEN p_room_cleaned THEN 1 ELSE 0 END,
    perfect_rooms_count = housekeeper_levels.perfect_rooms_count + CASE WHEN p_is_perfect THEN 1 ELSE 0 END,
    speed_bonus_count = housekeeper_levels.speed_bonus_count + CASE WHEN p_is_fast THEN 1 ELSE 0 END,
    current_streak = CASE 
      WHEN housekeeper_levels.last_activity_date = CURRENT_DATE - INTERVAL '1 day' 
      THEN housekeeper_levels.current_streak + 1
      WHEN housekeeper_levels.last_activity_date = CURRENT_DATE
      THEN housekeeper_levels.current_streak
      ELSE 1
    END,
    best_streak = GREATEST(
      housekeeper_levels.best_streak,
      CASE 
        WHEN housekeeper_levels.last_activity_date = CURRENT_DATE - INTERVAL '1 day' 
        THEN housekeeper_levels.current_streak + 1
        WHEN housekeeper_levels.last_activity_date = CURRENT_DATE
        THEN housekeeper_levels.current_streak
        ELSE 1
      END
    ),
    last_activity_date = CURRENT_DATE,
    updated_at = now()
  RETURNING * INTO v_level_record;

  -- Calculer le nouveau niveau
  v_new_level := calculate_level(v_level_record.total_xp);
  
  -- Vérifier si level up
  IF v_new_level > v_level_record.current_level THEN
    v_level_up := true;
    UPDATE public.housekeeper_levels
    SET current_level = v_new_level
    WHERE housekeeper_id = p_housekeeper_id AND hotel_id = p_hotel_id;
  END IF;

  -- Vérifier les badges à débloquer
  -- Badge première chambre
  IF v_level_record.rooms_cleaned_count >= 1 AND NOT EXISTS (
    SELECT 1 FROM public.housekeeper_achievements 
    WHERE housekeeper_id = p_housekeeper_id AND hotel_id = p_hotel_id AND badge_code = 'first_room'
  ) THEN
    INSERT INTO public.housekeeper_achievements (housekeeper_id, hotel_id, badge_code)
    VALUES (p_housekeeper_id, p_hotel_id, 'first_room')
    ON CONFLICT DO NOTHING;
    v_new_badges := array_append(v_new_badges, 'first_room');
  END IF;

  -- Badge 10 chambres
  IF v_level_record.rooms_cleaned_count >= 10 AND NOT EXISTS (
    SELECT 1 FROM public.housekeeper_achievements 
    WHERE housekeeper_id = p_housekeeper_id AND hotel_id = p_hotel_id AND badge_code = 'room_cleaner_10'
  ) THEN
    INSERT INTO public.housekeeper_achievements (housekeeper_id, hotel_id, badge_code)
    VALUES (p_housekeeper_id, p_hotel_id, 'room_cleaner_10')
    ON CONFLICT DO NOTHING;
    v_new_badges := array_append(v_new_badges, 'room_cleaner_10');
  END IF;

  -- Badge 50 chambres
  IF v_level_record.rooms_cleaned_count >= 50 AND NOT EXISTS (
    SELECT 1 FROM public.housekeeper_achievements 
    WHERE housekeeper_id = p_housekeeper_id AND hotel_id = p_hotel_id AND badge_code = 'room_cleaner_50'
  ) THEN
    INSERT INTO public.housekeeper_achievements (housekeeper_id, hotel_id, badge_code)
    VALUES (p_housekeeper_id, p_hotel_id, 'room_cleaner_50')
    ON CONFLICT DO NOTHING;
    v_new_badges := array_append(v_new_badges, 'room_cleaner_50');
  END IF;

  -- Badge streak 3 jours
  IF v_level_record.current_streak >= 3 AND NOT EXISTS (
    SELECT 1 FROM public.housekeeper_achievements 
    WHERE housekeeper_id = p_housekeeper_id AND hotel_id = p_hotel_id AND badge_code = 'streak_3'
  ) THEN
    INSERT INTO public.housekeeper_achievements (housekeeper_id, hotel_id, badge_code)
    VALUES (p_housekeeper_id, p_hotel_id, 'streak_3')
    ON CONFLICT DO NOTHING;
    v_new_badges := array_append(v_new_badges, 'streak_3');
  END IF;

  -- Retourner les résultats
  RETURN jsonb_build_object(
    'total_xp', v_level_record.total_xp,
    'current_level', v_new_level,
    'level_up', v_level_up,
    'new_badges', v_new_badges,
    'current_streak', v_level_record.current_streak
  );
END;
$$;