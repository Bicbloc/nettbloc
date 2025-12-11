import { useState, useEffect, useCallback, useMemo } from 'react';
import { Room, CleaningConfig } from '@/services/pdfService';
import { supabase } from '@/integrations/supabase/client';
import { isFullCleaning, isQuickCleaning } from '@/utils/cleaningTypeUtils';

interface UseDashboardRoomsProps {
  hotelId: string | null;
  cleaningConfig: CleaningConfig;
  isImporting?: boolean;
}

interface UseDashboardRoomsReturn {
  rooms: Room[];
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  filteredRooms: Room[] | null;
  setFilteredRooms: React.Dispatch<React.SetStateAction<Room[] | null>>;
  availableFloors: number[];
  // Computed values
  totalRooms: number;
  roomsToClean: number;
  fullCleaningRooms: number;
  quickCleaningRooms: number;
  priorityRooms: number;
  cleanRooms: number;
  twinRooms: number;
  recommendedHousekeepers: number;
  // Helper functions
  getHousekeeperRooms: (name: string) => Room[];
  getUnassignedRooms: () => Room[];
  getCleanRoomsList: () => Room[];
  calculateHousekeeperLoad: (assignedRooms: Room[]) => number;
  // Data loading
  loadRoomsFromDatabase: () => Promise<void>;
}

export function useDashboardRooms({
  hotelId,
  cleaningConfig,
  isImporting = false
}: UseDashboardRoomsProps): UseDashboardRoomsReturn {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<Room[] | null>(null);
  const [availableFloors, setAvailableFloors] = useState<number[]>([]);

  // Computed values using useMemo for performance
  const computedValues = useMemo(() => {
    const totalRooms = rooms.length;
    const roomsToClean = rooms.filter(r => r.status === 'needs-cleaning' || r.cleaningType !== 'none').length;
    const fullCleaningRooms = rooms.filter(r => isFullCleaning(r.cleaningType)).length;
    const quickCleaningRooms = rooms.filter(r => isQuickCleaning(r.cleaningType)).length;
    const priorityRooms = rooms.filter(r => r.priority === 'high').length;
    const cleanRooms = rooms.filter(r => r.status === 'clean').length;
    const twinRooms = rooms.filter(r => r.isTwin).length;

    // Calculate recommended housekeepers
    const roomsNeedingCleaning = rooms.filter(room => 
      room.cleaningType !== 'none' && room.status !== 'maintenance'
    );
    
    const totalTime = roomsNeedingCleaning.reduce((total, room) => {
      if (isFullCleaning(room.cleaningType)) {
        return total + cleaningConfig.fullCleaningTime;
      } else if (isQuickCleaning(room.cleaningType)) {
        return total + cleaningConfig.quickCleaningTime;
      }
      return total;
    }, 0);
    
    const averageTimePerHousekeeper = 360; // 6 hours = 360 minutes
    const recommendedHousekeepers = Math.ceil(totalTime / averageTimePerHousekeeper);

    return {
      totalRooms,
      roomsToClean,
      fullCleaningRooms,
      quickCleaningRooms,
      priorityRooms,
      cleanRooms,
      twinRooms,
      recommendedHousekeepers
    };
  }, [rooms, cleaningConfig]);

  // Helper functions
  const getHousekeeperRooms = useCallback((name: string) => {
    return rooms.filter(room => room.assignedTo === name);
  }, [rooms]);

  const getUnassignedRooms = useCallback(() => {
    return rooms.filter(room => 
      !room.assignedTo && 
      room.cleaningType !== 'none' && 
      room.status !== 'maintenance' &&
      room.status !== 'clean'
    );
  }, [rooms]);

  const getCleanRoomsList = useCallback(() => {
    return rooms.filter(room => 
      room.status === 'clean' &&
      room.cleaningType !== 'none'
    );
  }, [rooms]);

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

  // Load rooms from database
  const loadRoomsFromDatabase = useCallback(async () => {
    if (!hotelId || isImporting) return;
    
    console.log('🔄 Chargement des chambres depuis Supabase pour:', hotelId);
    
    try {
      // Get rooms
      const { data: dbRooms, error: roomsError } = await supabase
        .from('rooms')
        .select('*')
        .eq('hotel_id', hotelId)
        .order('room_number', { ascending: true });

      if (roomsError) {
        console.error('❌ Erreur chargement chambres:', roomsError);
        return;
      }

      // Get assignments
      const { data: dbAssignments, error: assignError } = await supabase
        .from('assignments')
        .select('*')
        .eq('hotel_id', hotelId)
        .in('status', ['assigned', 'in_progress']);

      if (assignError) {
        console.warn('⚠️ Erreur chargement assignations:', assignError);
      }

      // Get session data
      const { data: sessionData } = await supabase
        .from('hotel_sessions')
        .select('housekeeper_assignments, housekeeper_names')
        .eq('hotel_id', hotelId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const sessionAssignments: Record<string, string> = {};
      if (sessionData?.housekeeper_assignments && typeof sessionData.housekeeper_assignments === 'object') {
        Object.entries(sessionData.housekeeper_assignments as Record<string, string[]>).forEach(([hkName, roomNumbers]) => {
          if (Array.isArray(roomNumbers)) {
            roomNumbers.forEach(rn => { sessionAssignments[rn] = hkName; });
          }
        });
      }

      if (dbRooms && dbRooms.length > 0) {
        const mergedRooms: Room[] = dbRooms.map(r => {
          const assignment = dbAssignments?.find(a => a.room_id === r.id);
          const sessionAssigned = sessionAssignments[r.room_number];
          const assignedTo = assignment?.housekeeper_name || sessionAssigned || undefined;
          
          // Normalize cleaning type
          const rawCleaningType = r.cleaning_type;
          let cleaningType: 'a_blanc' | 'recouche' | 'none' = 'a_blanc';
          if (rawCleaningType === 'full' || rawCleaningType === 'a_blanc') {
            cleaningType = 'a_blanc';
          } else if (rawCleaningType === 'quick' || rawCleaningType === 'recouche') {
            cleaningType = 'recouche';
          } else if (rawCleaningType === 'none') {
            cleaningType = 'none';
          }

          return {
            number: r.room_number,
            status: r.status,
            cleaningType,
            assignedTo,
            floor: r.floor || undefined,
            notes: r.notes || undefined,
            isUrgent: r.cleaning_priority === 10,
            notUrgent: r.cleaning_priority === 1,
            isTwin: false,
            priority: r.cleaning_priority === 10 ? 'high' as const : undefined
          };
        });

        setRooms(mergedRooms);
        
        // Extract available floors
        const floors = new Set<number>();
        mergedRooms.forEach(room => {
          const floor = room.floor ?? (room.number.length > 0 ? parseInt(room.number[0]) : 0);
          floors.add(floor);
        });
        setAvailableFloors(Array.from(floors).sort((a, b) => a - b));

        console.log('✅ Chambres chargées:', mergedRooms.length);
      }
    } catch (error) {
      console.error('❌ Erreur chargement chambres:', error);
    }
  }, [hotelId, isImporting]);

  // Auto-load rooms on mount and hotel change
  useEffect(() => {
    loadRoomsFromDatabase();
    
    // Reload every 2 minutes
    const interval = setInterval(loadRoomsFromDatabase, 120000);
    return () => clearInterval(interval);
  }, [loadRoomsFromDatabase]);

  return {
    rooms,
    setRooms,
    filteredRooms,
    setFilteredRooms,
    availableFloors,
    ...computedValues,
    getHousekeeperRooms,
    getUnassignedRooms,
    getCleanRoomsList,
    calculateHousekeeperLoad,
    loadRoomsFromDatabase
  };
}
