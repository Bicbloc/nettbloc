UPDATE public.hotel_pms_configs
SET is_active = true, property_id = COALESCE(property_id, (credentials->>'propertyId'))
WHERE hotel_id = '493c9818-28cb-4cae-a3e5-b5bb5ff24ee2' AND pms_type = 'mister_booking';

UPDATE public.pms_sync_queue
SET state = 'pending', attempts = 0, last_error = NULL
WHERE hotel_id = '493c9818-28cb-4cae-a3e5-b5bb5ff24ee2' AND state IN ('pending','error');