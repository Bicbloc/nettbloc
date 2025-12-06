-- Ajouter une contrainte unique sur hotel_id + room_number pour permettre l'upsert
ALTER TABLE hotel_rooms_registry 
ADD CONSTRAINT hotel_rooms_registry_hotel_room_unique 
UNIQUE (hotel_id, room_number);