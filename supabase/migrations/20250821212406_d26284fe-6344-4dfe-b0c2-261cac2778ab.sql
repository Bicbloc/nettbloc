-- Ajouter des données d'exemple pour l'hôtel HTL015 (freeflex@bicbloc.eu)
DO $$
DECLARE
    hotel_uuid uuid;
    user_uuid uuid;
BEGIN
    -- Récupérer l'ID de l'hôtel HTL015
    SELECT id, user_id INTO hotel_uuid, user_uuid
    FROM public.hotels 
    WHERE hotel_code = 'HTL015';
    
    IF hotel_uuid IS NOT NULL THEN
        -- Ajouter quelques chambres d'exemple si elles n'existent pas
        INSERT INTO public.rooms (hotel_id, room_number, floor, room_type, status, cleaning_priority, estimated_time)
        SELECT hotel_uuid, '101', 1, 'standard', 'dirty', 1, 30
        WHERE NOT EXISTS (SELECT 1 FROM public.rooms WHERE hotel_id = hotel_uuid AND room_number = '101');
        
        INSERT INTO public.rooms (hotel_id, room_number, floor, room_type, status, cleaning_priority, estimated_time)
        SELECT hotel_uuid, '102', 1, 'standard', 'dirty', 1, 30
        WHERE NOT EXISTS (SELECT 1 FROM public.rooms WHERE hotel_id = hotel_uuid AND room_number = '102');
        
        INSERT INTO public.rooms (hotel_id, room_number, floor, room_type, status, cleaning_priority, estimated_time)
        SELECT hotel_uuid, '103', 1, 'suite', 'dirty', 2, 45
        WHERE NOT EXISTS (SELECT 1 FROM public.rooms WHERE hotel_id = hotel_uuid AND room_number = '103');
        
        INSERT INTO public.rooms (hotel_id, room_number, floor, room_type, status, cleaning_priority, estimated_time)
        SELECT hotel_uuid, '201', 2, 'standard', 'dirty', 1, 30
        WHERE NOT EXISTS (SELECT 1 FROM public.rooms WHERE hotel_id = hotel_uuid AND room_number = '201');
        
        INSERT INTO public.rooms (hotel_id, room_number, floor, room_type, status, cleaning_priority, estimated_time)
        SELECT hotel_uuid, '202', 2, 'standard', 'clean', 1, 30
        WHERE NOT EXISTS (SELECT 1 FROM public.rooms WHERE hotel_id = hotel_uuid AND room_number = '202');
        
        INSERT INTO public.rooms (hotel_id, room_number, floor, room_type, status, cleaning_priority, estimated_time)
        SELECT hotel_uuid, '203', 2, 'twin', 'dirty', 1, 25
        WHERE NOT EXISTS (SELECT 1 FROM public.rooms WHERE hotel_id = hotel_uuid AND room_number = '203');
        
        INSERT INTO public.rooms (hotel_id, room_number, floor, room_type, status, cleaning_priority, estimated_time)
        SELECT hotel_uuid, '301', 3, 'standard', 'dirty', 1, 30
        WHERE NOT EXISTS (SELECT 1 FROM public.rooms WHERE hotel_id = hotel_uuid AND room_number = '301');
        
        INSERT INTO public.rooms (hotel_id, room_number, floor, room_type, status, cleaning_priority, estimated_time)
        SELECT hotel_uuid, '302', 3, 'standard', 'dirty', 1, 30
        WHERE NOT EXISTS (SELECT 1 FROM public.rooms WHERE hotel_id = hotel_uuid AND room_number = '302');
        
        INSERT INTO public.rooms (hotel_id, room_number, floor, room_type, status, cleaning_priority, estimated_time)
        SELECT hotel_uuid, '303', 3, 'suite', 'dirty', 2, 45
        WHERE NOT EXISTS (SELECT 1 FROM public.rooms WHERE hotel_id = hotel_uuid AND room_number = '303');
        
        INSERT INTO public.rooms (hotel_id, room_number, floor, room_type, status, cleaning_priority, estimated_time)
        SELECT hotel_uuid, '304', 3, 'standard', 'dirty', 1, 30
        WHERE NOT EXISTS (SELECT 1 FROM public.rooms WHERE hotel_id = hotel_uuid AND room_number = '304');

        -- Ajouter femmes de chambre d'exemple si elles n'existent pas
        INSERT INTO public.housekeepers (hotel_id, name, access_code, user_id, is_active)
        SELECT hotel_uuid, 'Marie Dupont', 'HTL015-MAR-1234', user_uuid, true
        WHERE NOT EXISTS (SELECT 1 FROM public.housekeepers WHERE hotel_id = hotel_uuid AND name = 'Marie Dupont');
        
        INSERT INTO public.housekeepers (hotel_id, name, access_code, user_id, is_active)
        SELECT hotel_uuid, 'Sophie Martin', 'HTL015-SOP-5678', user_uuid, true
        WHERE NOT EXISTS (SELECT 1 FROM public.housekeepers WHERE hotel_id = hotel_uuid AND name = 'Sophie Martin');
        
        INSERT INTO public.housekeepers (hotel_id, name, access_code, user_id, is_active)
        SELECT hotel_uuid, 'Julie Bernard', 'HTL015-JUL-9012', user_uuid, true
        WHERE NOT EXISTS (SELECT 1 FROM public.housekeepers WHERE hotel_id = hotel_uuid AND name = 'Julie Bernard');

        RAISE NOTICE 'Données d''exemple créées pour l''hôtel HTL015';
    ELSE
        RAISE NOTICE 'Hôtel HTL015 non trouvé';
    END IF;
END $$;