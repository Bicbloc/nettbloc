-- Correction automatique: créer les hôtels manquants pour les profils existants
DO $$
DECLARE
    profile_record RECORD;
    new_hotel_id UUID;
    hotel_code TEXT;
BEGIN
    -- Parcourir tous les profils qui n'ont pas d'hôtel associé
    FOR profile_record IN 
        SELECT p.id, p.email, p.company_name 
        FROM profiles p 
        LEFT JOIN hotels h ON h.user_id = p.id 
        WHERE h.id IS NULL
    LOOP
        RAISE NOTICE 'Création hôtel pour profil: % (%)', profile_record.email, profile_record.company_name;
        
        -- Créer l'hôtel manquant
        INSERT INTO hotels (
            name,
            email, 
            user_id,
            address,
            hotel_code
        ) VALUES (
            COALESCE(profile_record.company_name, 'Mon Établissement'),
            profile_record.email,
            profile_record.id,
            null,
            null -- Le trigger auto_generate_hotel_code() va générer automatiquement
        ) RETURNING id INTO new_hotel_id;
        
        -- Vérifier que le hotel_code a été généré
        SELECT h.hotel_code INTO hotel_code FROM hotels h WHERE h.id = new_hotel_id;
        
        -- Si pas de hotel_code, en générer un manuellement
        IF hotel_code IS NULL OR hotel_code = '' THEN
            hotel_code := generate_short_hotel_id();
            UPDATE hotels SET hotel_code = hotel_code WHERE id = new_hotel_id;
        END IF;
        
        RAISE NOTICE 'Hôtel créé avec succès: ID=%, Code=%', new_hotel_id, hotel_code;
    END LOOP;
    
    RAISE NOTICE 'Correction terminée - Tous les profils ont maintenant un hôtel associé';
END $$;