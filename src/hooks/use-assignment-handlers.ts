import { useCallback } from 'react';
import { Room } from '@/services/pdfService';
import { supabase } from '@/integrations/supabase/client';
import { AssignmentService } from '@/services/assignmentService';
import { toast } from '@/hooks/use-toast';

interface Housekeeper {
  id: string;
  name: string;
  user_id: string;
  access_code?: string;
}

interface UseAssignmentHandlersProps {
  hotelId: string | null;
  rooms: Room[];
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  housekeepers: Housekeeper[];
  refreshHousekeepers?: () => void;
  setIsAssigning?: (value: boolean) => void;
}

export const useAssignmentHandlers = ({
  hotelId,
  rooms,
  setRooms,
  housekeepers,
  refreshHousekeepers,
  setIsAssigning
}: UseAssignmentHandlersProps) => {
  
  const handleManualAssign = useCallback(async (housekeeperName: string, selectedRooms: Room[]) => {
    console.log('🔄 Assignation manuelle:', { housekeeperName, roomCount: selectedRooms.length, hotelId });
    
    // Bloquer le rechargement automatique pendant l'assignation
    setIsAssigning?.(true);
    
    if (!hotelId) {
      console.error('❌ hotelId est null dans handleManualAssign!');
      toast({
        variant: "destructive",
        title: "Erreur de configuration",
        description: "Aucun hôtel sélectionné"
      });
      setIsAssigning?.(false);
      return;
    }
    
    let housekeeper = housekeepers.find(h => h.name.toLowerCase() === housekeeperName.toLowerCase());
    
    if (!housekeeper) {
      console.log('⚠️ Femme de chambre non trouvée, création automatique:', housekeeperName);
      try {
        const { data: accessCode, error: codeError } = await supabase
          .rpc('generate_and_insert_access_code', {
            p_hotel_id: hotelId,
            p_housekeeper_name: housekeeperName
          });
        
        if (!codeError && accessCode) {
          const { data: newHousekeeper } = await supabase
            .from('housekeepers')
            .select('id, name, access_code, user_id')
            .eq('hotel_id', hotelId)
            .eq('name', housekeeperName)
            .eq('is_active', true)
            .maybeSingle();
          
          if (newHousekeeper) {
            housekeeper = newHousekeeper;
            console.log('✅ Femme de chambre créée:', newHousekeeper);
            refreshHousekeepers?.();
          }
        }
      } catch (error) {
        console.error('❌ Erreur création femme de chambre:', error);
      }
    }
    
    if (housekeeper && hotelId) {
      for (const room of selectedRooms) {
        const { data: existingRoom } = await supabase
          .from('rooms')
          .select('id')
          .eq('hotel_id', hotelId)
          .eq('room_number', room.number)
          .single();
        
        let roomId = existingRoom?.id;
        
        if (!roomId) {
          const { data: newRoom } = await supabase
            .from('rooms')
            .insert({
              hotel_id: hotelId,
              room_number: room.number,
              floor: room.floor,
              status: room.status || 'dirty',
              room_type: null,
              cleaning_priority: room.priority === 'high' ? 2 : 1
            })
            .select('id')
            .single();
          
          roomId = newRoom?.id;
        }
        
        if (roomId) {
          console.log('✅ Création assignation manuelle:', { housekeeperId: housekeeper.user_id || housekeeper.id, housekeeperName, roomId, roomNumber: room.number });
          await AssignmentService.assignRoom(
            hotelId,
            roomId,
            housekeeper.user_id || housekeeper.id,
            housekeeperName
          );
        }
      }
    }
    
    const updatedRooms = rooms.map(room => {
      if (selectedRooms.some(selectedRoom => selectedRoom.number === room.number)) {
        return { ...room, assignedTo: housekeeperName };
      }
      return room;
    });
    
    setRooms(updatedRooms);
    
    // Débloquer après un délai pour s'assurer que la DB est synchronisée
    setTimeout(() => setIsAssigning?.(false), 2000);
    
    toast({
      title: "Assignation manuelle",
      description: `${selectedRooms.length} chambre(s) ont été assignées à ${housekeeperName}.`
    });
  }, [hotelId, rooms, setRooms, housekeepers, refreshHousekeepers, setIsAssigning]);

  const handleDirectRoomAssignment = useCallback(async (roomNumber: string, housekeeperName: string) => {
    console.log('🔄 Tentative assignation directe:', { roomNumber, housekeeperName, hotelId });
    
    // Bloquer le rechargement automatique pendant l'assignation
    setIsAssigning?.(true);
    
    if (!hotelId) {
      console.error('❌ hotelId est null!');
      toast({ variant: "destructive", title: "Erreur", description: "Hôtel non configuré" });
      setIsAssigning?.(false);
      return;
    }
    
    let housekeeper = housekeepers.find(h => h.name.toLowerCase() === housekeeperName.toLowerCase());
    
    if (!housekeeper) {
      console.log('⚠️ Femme de chambre non trouvée, création automatique:', housekeeperName);
      try {
        const { data: accessCode, error: codeError } = await supabase
          .rpc('generate_and_insert_access_code', {
            p_hotel_id: hotelId,
            p_housekeeper_name: housekeeperName
          });
        
        if (!codeError && accessCode) {
          const { data: newHousekeeper } = await supabase
            .from('housekeepers')
            .select('id, name, access_code, user_id')
            .eq('hotel_id', hotelId)
            .eq('name', housekeeperName)
            .eq('is_active', true)
            .maybeSingle();
          
          if (newHousekeeper) {
            housekeeper = newHousekeeper;
            console.log('✅ Femme de chambre créée:', newHousekeeper);
            refreshHousekeepers?.();
          }
        }
      } catch (error) {
        console.error('❌ Erreur création femme de chambre:', error);
      }
    }
    
    if (hotelId) {
      const { data: existingRoom } = await supabase
        .from('rooms')
        .select('id')
        .eq('hotel_id', hotelId)
        .eq('room_number', roomNumber)
        .single();
      
      let roomId = existingRoom?.id;
      
      if (!roomId) {
        const room = rooms.find(r => r.number === roomNumber);
        const { data: newRoom } = await supabase
          .from('rooms')
          .insert({
            hotel_id: hotelId,
            room_number: roomNumber,
            floor: room?.floor,
            status: room?.status || 'dirty',
            room_type: null,
            cleaning_priority: room?.priority === 'high' ? 2 : 1
          })
          .select('id')
          .single();
        
        roomId = newRoom?.id;
      }
      
      if (roomId && housekeeper) {
        console.log('✅ Création assignation directe:', { housekeeperId: housekeeper.user_id || housekeeper.id, housekeeperName, roomId });
        await AssignmentService.assignRoom(
          hotelId,
          roomId,
          housekeeper.user_id || housekeeper.id,
          housekeeperName
        );
      }
    }
    
    const updatedRooms = rooms.map(room => {
      if (room.number === roomNumber) {
        return { ...room, assignedTo: housekeeperName };
      }
      return room;
    });
    
    setRooms(updatedRooms);
    
    // Débloquer après un délai pour s'assurer que la DB est synchronisée
    setTimeout(() => setIsAssigning?.(false), 2000);
    
    toast({
      title: "Chambre assignée",
      description: `Chambre ${roomNumber} assignée à ${housekeeperName}.`
    });
  }, [hotelId, rooms, setRooms, housekeepers, refreshHousekeepers, setIsAssigning]);

  return {
    handleManualAssign,
    handleDirectRoomAssignment
  };
};
