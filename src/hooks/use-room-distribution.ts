import { useCallback } from 'react';
import { Room, CleaningConfig } from '@/services/pdfService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { redistributeRooms, getDistributionStats } from '@/utils/redistributionUtils';
import { AssignmentService } from '@/services/assignmentService';
import { isFullCleaning, isQuickCleaning } from '@/utils/cleaningTypeUtils';

export type RedistributionMethod = 'random' | 'floor' | 'cleaning-type';

interface Housekeeper {
  id: string;
  name: string;
  user_id?: string;
}

interface UseRoomDistributionProps {
  hotelId: string | null;
  rooms: Room[];
  housekeeperNames: string[];
  housekeepers: Housekeeper[];
  cleaningConfig: CleaningConfig;
  housekeeperFloorPreferences: Record<string, number[]>;
  housekeeperMaxRoomsOverrides: Record<string, number>;
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  setIsDistributed: (value: boolean) => void;
  refreshHousekeepers?: () => Promise<void>;
}

interface UseRoomDistributionReturn {
  distributeRooms: (
    roomsList: Room[],
    housekeepersParam: string[],
    floorPreferences?: Record<string, number[]>,
    maxRoomsOverrides?: Record<string, number>
  ) => Promise<void>;
  handleRedistribute: (method: RedistributionMethod) => Promise<void>;
  generateAccessCodesForDistribution: () => Promise<void>;
}

export function useRoomDistribution({
  hotelId,
  rooms,
  housekeeperNames,
  housekeepers,
  cleaningConfig,
  housekeeperFloorPreferences,
  housekeeperMaxRoomsOverrides,
  setRooms,
  setIsDistributed,
  refreshHousekeepers
}: UseRoomDistributionProps): UseRoomDistributionReturn {

  const calculateHousekeeperLoad = useCallback((assignedRooms: Room[]) => {
    return assignedRooms.reduce((total, room) => {
      if (isFullCleaning(room.cleaningType)) {
        return total + cleaningConfig.fullCleaningTime;
      } else if (isQuickCleaning(room.cleaningType)) {
        return total + cleaningConfig.quickCleaningTime;
      }
      return total;
    }, 0);
  }, [cleaningConfig]);

  const distributeRooms = useCallback(async (
    roomsList: Room[], 
    housekeepersParam: string[], 
    floorPreferences: Record<string, number[]> = housekeeperFloorPreferences,
    maxRoomsOverrides: Record<string, number> = housekeeperMaxRoomsOverrides
  ) => {
    if (housekeepersParam.length === 0) return;
    
    const sortedRooms = [...roomsList].sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (b.priority === 'high' && a.priority !== 'high') return 1;
      if (isFullCleaning(a.cleaningType) && !isFullCleaning(b.cleaningType)) return -1;
      if (isFullCleaning(b.cleaningType) && !isFullCleaning(a.cleaningType)) return 1;
      const floorA = a.floor !== undefined ? a.floor : (a.number ? parseInt(a.number[0]) : 0);
      const floorB = b.floor !== undefined ? b.floor : (b.number ? parseInt(b.number[0]) : 0);
      if (floorA !== floorB) return floorA - floorB;
      return a.number.localeCompare(b.number, undefined, { numeric: true });
    });
    
    const roomsToClean = sortedRooms.filter(room => 
      room.cleaningType !== 'none' && room.status !== 'maintenance'
    );
    
    const roomsByFloor: Record<number, Room[]> = {};
    for (const room of roomsToClean) {
      const floor = room.floor !== undefined ? room.floor : parseInt(room.number[0]) || 0;
      if (!roomsByFloor[floor]) roomsByFloor[floor] = [];
      roomsByFloor[floor].push(room);
    }
    
    const assignments: Record<string, Room[]> = {};
    housekeepersParam.forEach(name => {
      assignments[name] = [];
    });
    
    const findMinLoadHousekeeper = (preferredFloor?: number) => {
      let candidates = housekeepersParam;
      if (preferredFloor !== undefined) {
        const housekeepersForFloor = housekeepersParam.filter(name => {
          const preferences = floorPreferences[name] || [];
          return preferences.length === 0 || preferences.includes(preferredFloor);
        });
        
        if (housekeepersForFloor.length > 0) {
          candidates = housekeepersForFloor;
        }
      }
      
      const availableCandidates = candidates.filter(name => {
        const maxRooms = maxRoomsOverrides[name] || cleaningConfig.maxRoomsPerHousekeeper;
        return assignments[name].length < maxRooms;
      });
      
      if (availableCandidates.length === 0) return null;
      
      let minLoadHousekeeper = availableCandidates[0];
      let minLoad = calculateHousekeeperLoad(assignments[minLoadHousekeeper]);
      
      for (let i = 1; i < availableCandidates.length; i++) {
        const currentLoad = calculateHousekeeperLoad(assignments[availableCandidates[i]]);
        if (currentLoad < minLoad) {
          minLoad = currentLoad;
          minLoadHousekeeper = availableCandidates[i];
        }
      }
      
      return minLoadHousekeeper;
    };
    
    const assignedRoomNumbers = new Set<string>();
    
    // First assign high priority rooms
    for (const room of roomsToClean.filter(r => r.priority === 'high')) {
      const floor = room.floor !== undefined ? room.floor : parseInt(room.number[0]) || 0;
      const housekeeper = findMinLoadHousekeeper(floor);
      
      if (!housekeeper) continue;
      
      const preferences = floorPreferences[housekeeper] || [];
      if (preferences.length === 0 || preferences.includes(floor)) {
        assignments[housekeeper].push({ ...room, assignedTo: housekeeper });
        assignedRoomNumbers.add(room.number);
      }
    }
    
    // Then assign remaining rooms by floor
    Object.entries(roomsByFloor).forEach(([floor, floorRooms]) => {
      const floorNum = parseInt(floor);
      for (const room of floorRooms) {
        if (assignedRoomNumbers.has(room.number)) continue;
        
        const housekeeper = findMinLoadHousekeeper(floorNum);
        if (!housekeeper) continue;
        
        const preferences = floorPreferences[housekeeper] || [];
        if (preferences.length === 0 || preferences.includes(floorNum)) {
          assignments[housekeeper].push({ ...room, assignedTo: housekeeper });
          assignedRoomNumbers.add(room.number);
        }
      }
    });
    
    // Update all rooms
    const updatedRooms = [...sortedRooms];
    for (const housekeeperName of housekeepersParam) {
      for (const room of assignments[housekeeperName]) {
        const index = updatedRooms.findIndex(r => r.number === room.number);
        if (index !== -1) {
          updatedRooms[index] = { ...updatedRooms[index], assignedTo: housekeeperName };
        }
      }
    }
    
    setRooms(updatedRooms);
    
    // Persist assignments in Supabase
    if (hotelId) {
      for (const room of updatedRooms) {
        if (room.assignedTo) {
          const hk = housekeepers.find(h => h.name === room.assignedTo);
          const { data: roomData } = await supabase
            .from('rooms')
            .select('id')
            .eq('hotel_id', hotelId)
            .eq('room_number', room.number)
            .single();
          
          const housekeeperId = hk?.user_id && hk.user_id !== 'null' ? hk.user_id : 
                                hk?.id && hk.id !== 'null' ? hk.id : null;
          
          if (roomData?.id && housekeeperId) {
            await AssignmentService.assignRoom(
              hotelId,
              roomData.id,
              housekeeperId,
              room.assignedTo
            );
          }
        }
      }
    }
    
    // Notify about unassigned rooms
    const unassignedRooms = updatedRooms.filter(room => 
      !room.assignedTo && 
      room.cleaningType !== 'none' && 
      room.status !== 'maintenance' &&
      room.status !== 'clean'
    );
    
    if (unassignedRooms.length > 0) {
      toast({
        title: "Distribution terminée",
        description: `${unassignedRooms.length} chambre(s) non assignée(s) - les femmes de chambre ont atteint leur capacité max.`,
        variant: "default"
      });
    }
    
    setIsDistributed(true);
  }, [hotelId, housekeepers, cleaningConfig, housekeeperFloorPreferences, housekeeperMaxRoomsOverrides, setRooms, setIsDistributed, calculateHousekeeperLoad]);

  const handleRedistribute = useCallback(async (method: RedistributionMethod) => {
    
    if (housekeeperNames.length === 0) {
      toast({
        variant: "destructive",
        title: "Erreur de redistribution",
        description: "Aucune femme de chambre disponible pour la redistribution."
      });
      return;
    }

    const availableRooms = rooms.filter(room => 
      room.cleaningType !== 'none' && room.status !== 'maintenance'
    );

    if (availableRooms.length === 0) {
      toast({
        variant: "destructive",
        title: "Erreur de redistribution",
        description: "Aucune chambre disponible pour la redistribution."
      });
      return;
    }

    // Clean old assignments
    if (hotelId) {
      await supabase
        .from('assignments')
        .delete()
        .eq('hotel_id', hotelId)
        .in('status', ['assigned', 'in_progress']);
    }

    try {
      const redistributedRooms = redistributeRooms(rooms, housekeeperNames, method);
      setRooms(redistributedRooms);
      setIsDistributed(true);

      const methodName = method === 'random' ? 'aléatoire' : 
                        method === 'floor' ? 'par étage' : 'par type de nettoyage';
      
      const assignedCount = redistributedRooms.filter(r => 
        r.assignedTo && r.cleaningType !== 'none' && r.status !== 'maintenance'
      ).length;

      // Persist assignments
      if (hotelId) {
        for (const room of redistributedRooms) {
          if (room.assignedTo && room.cleaningType !== 'none' && room.status !== 'maintenance') {
            const hk = housekeepers.find(h => h.name === room.assignedTo);
            
            const { data: roomData } = await supabase
              .from('rooms')
              .select('id')
              .eq('hotel_id', hotelId)
              .eq('room_number', room.number)
              .single();
            
            if (roomData?.id && hk) {
              await AssignmentService.assignRoom(
                hotelId,
                roomData.id,
                hk.user_id || hk.id,
                room.assignedTo
              );
            }
          }
        }
      }

      toast({
        title: "Redistribution terminée",
        description: `${assignedCount} chambres redistribuées avec la méthode ${methodName}.`
      });

    } catch (error) {
      console.error('Erreur lors de la redistribution:', error);
      toast({
        variant: "destructive",
        title: "Erreur de redistribution", 
        description: "Une erreur s'est produite lors de la redistribution des chambres."
      });
    }
  }, [hotelId, rooms, housekeeperNames, housekeepers, setRooms, setIsDistributed]);

  const generateAccessCodesForDistribution = useCallback(async () => {
    if (!hotelId) return;
    
    try {
      
      for (const housekeeperName of housekeeperNames) {
        const { data: existingHousekeeper } = await supabase
          .from('housekeepers')
          .select('id, access_code')
          .eq('hotel_id', hotelId)
          .eq('name', housekeeperName)
          .eq('is_active', true)
          .maybeSingle();
        
        if (!existingHousekeeper?.access_code) {
          const { data: newCodeData, error: codeError } = await supabase
            .rpc('generate_housekeeper_access_code_with_name', {
              p_hotel_id: hotelId,
              p_housekeeper_id: existingHousekeeper?.id || null,
              p_housekeeper_name: housekeeperName
            });
          
          if (codeError) {
            console.error('❌ Erreur génération code pour', housekeeperName, ':', codeError);
            continue;
          }
          
          
          if (existingHousekeeper) {
            await supabase
              .from('housekeepers')
              .update({ access_code: newCodeData })
              .eq('id', existingHousekeeper.id);
          }
        }
      }
      
      if (refreshHousekeepers) {
        await refreshHousekeepers();
      }
      
    } catch (error) {
      console.error('❌ Erreur génération automatique codes:', error);
    }
  }, [hotelId, housekeeperNames, refreshHousekeepers]);

  return {
    distributeRooms,
    handleRedistribute,
    generateAccessCodesForDistribution
  };
}
