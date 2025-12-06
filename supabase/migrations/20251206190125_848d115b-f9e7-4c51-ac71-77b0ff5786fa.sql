-- Ajouter une contrainte unique sur rooms pour hotel_id + room_number
ALTER TABLE rooms 
ADD CONSTRAINT rooms_hotel_room_unique 
UNIQUE (hotel_id, room_number);