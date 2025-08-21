-- Ajouter des données d'exemple pour l'hôtel HTL015 (freeflex@bicbloc.eu)
-- Récupérer l'ID de l'hôtel HTL015
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
        -- Ajouter quelques chambres d'exemple
        INSERT INTO public.rooms (hotel_id, room_number, floor, room_type, status, cleaning_priority, estimated_time)
        VALUES 
            (hotel_uuid, '101', 1, 'standard', 'dirty', 1, 30),
            (hotel_uuid, '102', 1, 'standard', 'dirty', 1, 30),
            (hotel_uuid, '103', 1, 'suite', 'dirty', 2, 45),
            (hotel_uuid, '201', 2, 'standard', 'dirty', 1, 30),
            (hotel_uuid, '202', 2, 'standard', 'clean', 1, 30),
            (hotel_uuid, '203', 2, 'twin', 'dirty', 1, 25),
            (hotel_uuid, '301', 3, 'standard', 'dirty', 1, 30),
            (hotel_uuid, '302', 3, 'standard', 'dirty', 1, 30),
            (hotel_uuid, '303', 3, 'suite', 'dirty', 2, 45),
            (hotel_uuid, '304', 3, 'standard', 'dirty', 1, 30)
        ON CONFLICT (hotel_id, room_number) DO UPDATE SET
            floor = EXCLUDED.floor,
            room_type = EXCLUDED.room_type,
            status = EXCLUDED.status,
            cleaning_priority = EXCLUDED.cleaning_priority,
            estimated_time = EXCLUDED.estimated_time;

        -- Ajouter femmes de chambre d'exemple - vérifier d'abord si elles existent
        -- Marie Dupont
        IF NOT EXISTS (SELECT 1 FROM public.housekeepers WHERE hotel_id = hotel_uuid AND name = 'Marie Dupont') THEN
            INSERT INTO public.housekeepers (hotel_id, name, access_code, user_id, is_active)
            VALUES (hotel_uuid, 'Marie Dupont', 'HTL015-MAR-1234', user_uuid, true);
        END IF;
        
        -- Sophie Martin
        IF NOT EXISTS (SELECT 1 FROM public.housekeepers WHERE hotel_id = hotel_uuid AND name = 'Sophie Martin') THEN
            INSERT INTO public.housekeepers (hotel_id, name, access_code, user_id, is_active)
            VALUES (hotel_uuid, 'Sophie Martin', 'HTL015-SOP-5678', user_uuid, true);
        END IF;
        
        -- Julie Bernard
        IF NOT EXISTS (SELECT 1 FROM public.housekeepers WHERE hotel_id = hotel_uuid AND name = 'Julie Bernard') THEN
            INSERT INTO public.housekeepers (hotel_id, name, access_code, user_id, is_active)
            VALUES (hotel_uuid, 'Julie Bernard', 'HTL015-JUL-9012', user_uuid, true);
        END IF;

        -- Créer les codes d'accès correspondants
        INSERT INTO public.housekeeper_access_codes (hotel_id, housekeeper_id, access_code, is_active, created_by)
        SELECT 
            hotel_uuid,
            h.id,
            h.access_code,
            true,
            user_uuid
        FROM public.housekeepers h
        WHERE h.hotel_id = hotel_uuid
        ON CONFLICT (hotel_id, housekeeper_id) DO UPDATE SET
            access_code = EXCLUDED.access_code,
            is_active = EXCLUDED.is_active;

        RAISE NOTICE 'Données d''exemple créées pour l''hôtel HTL015';
    ELSE
        RAISE NOTICE 'Hôtel HTL015 non trouvé';
    END IF;
END $$;