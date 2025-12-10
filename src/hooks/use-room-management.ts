import { useCallback } from 'react';
import { Room } from '@/services/pdfService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface UseRoomManagementProps {
  hotelId: string | null;
  rooms: Room[];
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  housekeepers: any[];
  refreshHousekeepers?: () => void;
}

export function useRoomManagement({ hotelId, rooms, setRooms, housekeepers, refreshHousekeepers }: UseRoomManagementProps) {

  const handleRoomUpdate = useCallback(async (updatedRoom: Room) => {
    // 1. Mise à jour locale immédiate (UX responsive)
    setRooms(prevRooms => 
      prevRooms.map(room => 
        room.number === updatedRoom.number ? updatedRoom : room
      )
    );
    
    // 2. Synchronisation temps réel vers Supabase
    if (hotelId) {
      const { RoomSyncService } = await import('@/services/roomSyncService');
      await RoomSyncService.syncRoom(hotelId, updatedRoom);
    }
  }, [hotelId]);

  const handleRoomUnassign = useCallback((roomToUnassign: Room) => {
    const updatedRoom = { ...roomToUnassign };
    delete updatedRoom.assignedTo;
    handleRoomUpdate(updatedRoom);
  }, [handleRoomUpdate]);

  const handleRoomReassign = useCallback((room: Room, newHousekeeper: string | null) => {
    const updatedRoom = { 
      ...room, 
      assignedTo: newHousekeeper || undefined 
    };
    handleRoomUpdate(updatedRoom);
    
    toast({
      description: newHousekeeper 
        ? `Chambre ${room.number} réassignée à ${newHousekeeper}`
        : `Chambre ${room.number} désassignée`
    });
  }, [handleRoomUpdate]);

  const handleAddRoom = useCallback(async (newRoom: Room) => {
    setRooms(prev => [...prev, newRoom]);
    
    console.log('✅ Chambre ajoutée:', newRoom.number);
    
    toast({
      title: "Chambre ajoutée",
      description: `La chambre ${newRoom.number} a été ajoutée avec succès`,
    });
  }, []);

  const handleDeleteRoom = useCallback(async (roomNumber: string) => {
    setRooms(prev => {
      const roomToDelete = prev.find(r => r.number === roomNumber);
      if (!roomToDelete) return prev;

      // Supprimer les liaisons bidirectionnelles
      return prev
        .filter(r => r.number !== roomNumber)
        .map(room => ({
          ...room,
          linkedRooms: room.linkedRooms?.filter(linkedRoom => linkedRoom !== roomNumber) || []
        }));
    });
    
    console.log('✅ Chambre supprimée:', roomNumber);
    
    toast({
      title: "Chambre supprimée",
      description: `La chambre ${roomNumber} a été supprimée avec succès`,
    });
  }, []);

  const handleLinkRooms = useCallback(async (roomNumber: string, linkedRoomNumbers: string[]) => {
    setRooms(prev => prev.map(room => {
      if (room.number === roomNumber) {
        return { ...room, linkedRooms: linkedRoomNumbers };
      }
      
      // Mettre à jour les liaisons bidirectionnelles
      const shouldBeLinked = linkedRoomNumbers.includes(room.number);
      const currentlyLinked = room.linkedRooms?.includes(roomNumber) || false;
      
      if (shouldBeLinked && !currentlyLinked) {
        return { ...room, linkedRooms: [...(room.linkedRooms || []), roomNumber] };
      } else if (!shouldBeLinked && currentlyLinked) {
        return { ...room, linkedRooms: room.linkedRooms?.filter(linked => linked !== roomNumber) || [] };
      }
      
      return room;
    }));
    
    console.log('✅ Liaisons de chambres sauvegardées:', roomNumber, linkedRoomNumbers);
  }, []);

  const handleGenerateAccessCode = useCallback(async (housekeeperName: string) => {
    if (!hotelId) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Aucun hôtel sélectionné pour générer le code d'accès."
      });
      return;
    }

    try {
      const { data: codeData, error } = await supabase
        .rpc('generate_and_insert_access_code', {
          p_hotel_id: hotelId,
          p_housekeeper_name: housekeeperName
        });

      if (error) throw error;

      refreshHousekeepers?.();

      try {
        await navigator.clipboard.writeText(codeData);
        toast({
          title: "Code généré et copié",
          description: `Code d'accès généré pour ${housekeeperName} et copié: ${codeData}`
        });
      } catch {
        toast({
          title: "Code généré",
          description: `Code d'accès généré pour ${housekeeperName}: ${codeData}`
        });
      }

      return codeData;
    } catch (error) {
      console.error('Erreur génération code:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de générer le code d'accès."
      });
    }
  }, [hotelId, refreshHousekeepers]);

  return {
    handleRoomUpdate,
    handleRoomUnassign,
    handleRoomReassign,
    handleAddRoom,
    handleDeleteRoom,
    handleLinkRooms,
    handleGenerateAccessCode
  };
}
