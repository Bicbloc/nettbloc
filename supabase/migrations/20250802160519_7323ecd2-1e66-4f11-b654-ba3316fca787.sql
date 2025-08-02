-- Fix housekeeper data: assign correct user_id and clean duplicates
-- First, get the user_id for aminekhellas2@gmail.com
DO $$
DECLARE
    target_user_id uuid;
    hotel_user_id uuid;
BEGIN
    -- Get the user_id for aminekhellas2@gmail.com
    SELECT id INTO target_user_id 
    FROM auth.users 
    WHERE email = 'aminekhellas2@gmail.com';
    
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User aminekhellas2@gmail.com not found';
    END IF;
    
    -- Get the hotel owned by this user
    SELECT user_id INTO hotel_user_id
    FROM public.hotels 
    WHERE user_id = target_user_id
    LIMIT 1;
    
    IF hotel_user_id IS NULL THEN
        RAISE EXCEPTION 'No hotel found for user aminekhellas2@gmail.com';
    END IF;
    
    -- Update all housekeepers with NULL user_id to have the correct user_id
    UPDATE public.housekeepers 
    SET user_id = target_user_id
    WHERE user_id IS NULL 
      AND hotel_id IN (
          SELECT id FROM public.hotels WHERE user_id = target_user_id
      );
    
    -- Clean duplicates: keep only the most recent housekeeper for each name
    DELETE FROM public.housekeepers h1
    WHERE EXISTS (
        SELECT 1 FROM public.housekeepers h2
        WHERE h2.name = h1.name
          AND h2.hotel_id = h1.hotel_id
          AND h2.created_at > h1.created_at
    );
    
    -- Update hotel_sessions to have correct hotel_id and user_id
    UPDATE public.hotel_sessions
    SET 
        hotel_id = (SELECT id FROM public.hotels WHERE user_id = target_user_id LIMIT 1),
        user_id = target_user_id
    WHERE hotel_id IS NULL OR user_id IS NULL;
    
END $$;