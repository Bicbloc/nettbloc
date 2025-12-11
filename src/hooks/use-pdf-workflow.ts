import { useState, useCallback } from 'react';
import { Room, CleaningConfig } from '@/services/pdfService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { AssignmentService } from '@/services/assignmentService';

interface Housekeeper {
  id: string;
  name: string;
  user_id?: string;
}

interface UsePdfWorkflowProps {
  hotelId: string | null;
  cleaningConfig: CleaningConfig;
  housekeepers: Housekeeper[];
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  setHousekeeperNames: (names: string[]) => void;
  setIsDistributed: (value: boolean) => void;
  setAvailableFloors: (floors: number[]) => void;
  refreshHousekeepers?: () => Promise<void>;
}

interface UsePdfWorkflowReturn {
  isImporting: boolean;
  handlePdfProcessed: (
    data: Room[],
    housekeeperNames?: string[],
    distributionMethod?: 'random' | 'floor' | 'cleaning-type'
  ) => Promise<void>;
}

export function usePdfWorkflow({
  hotelId,
  cleaningConfig,
  housekeepers,
  setRooms,
  setHousekeeperNames,
  setIsDistributed,
  setAvailableFloors,
  refreshHousekeepers
}: UsePdfWorkflowProps): UsePdfWorkflowReturn {
  const [isImporting, setIsImporting] = useState(false);

  const handlePdfProcessed = useCallback(async (
    data: Room[],
    housekeeperNames?: string[],
    distributionMethod?: 'random' | 'floor' | 'cleaning-type'
  ) => {
    console.log("📋 Traitement PDF avec méthode:", distributionMethod || 'aucune', "et femmes de chambre:", housekeeperNames || []);
    
    // Activate flag to block auto-reload
    setIsImporting(true);
    
    // Pause RealtimeManager to avoid conflicts
    const { realtimeManager } = await import('@/services/RealtimeManager');
    realtimeManager.pause();
    
    try {
      // Extract floors
      const floors = new Set<number>();
      data.forEach(room => {
        const floor = room.number.length > 0 ? parseInt(room.number[0]) : 0;
        floors.add(floor);
        room.floor = floor;
        room.isTwin = false; 
      });
      const floorArray = Array.from(floors).sort((a, b) => a - b);
      setAvailableFloors(floorArray);
      
      // Sort rooms
      const sortedData = [...data].sort((a, b) => 
        a.number.localeCompare(b.number, undefined, { numeric: true })
      );

      // Update housekeeper names if provided
      if (housekeeperNames && housekeeperNames.length > 0) {
        setHousekeeperNames(housekeeperNames);
      }

      // Sync each room to Supabase
      if (hotelId) {
        console.log('🔄 Synchronisation des chambres PDF vers Supabase...');
        for (const room of sortedData) {
          // Normalize cleaning_type for database storage
          let normalizedCleaningType: string | null = null;
          if (room.cleaningType === 'full' || room.cleaningType === 'a_blanc') {
            normalizedCleaningType = 'full';
          } else if (room.cleaningType === 'quick' || room.cleaningType === 'recouche') {
            normalizedCleaningType = 'quick';
          } else if (room.cleaningType === 'none') {
            normalizedCleaningType = 'none';
          }
          
          await supabase.from('rooms').upsert({
            hotel_id: hotelId,
            room_number: room.number,
            floor: room.floor || null,
            status: room.status || 'needs-cleaning',
            cleaning_type: normalizedCleaningType,
            cleaning_priority: room.isUrgent ? 10 : (room.notUrgent ? 1 : 5),
            notes: room.notes || null
          }, { 
            onConflict: 'hotel_id,room_number',
            ignoreDuplicates: false 
          });
        }
        console.log('✅ Toutes les chambres synchronisées vers Supabase');
      }

      // Auto-distribute if method specified
      if (distributionMethod && housekeeperNames && housekeeperNames.length > 0) {
        console.log("🔄 Auto-distribution selon méthode:", distributionMethod);
        const roomsPerHousekeeper = Math.ceil(sortedData.length / housekeeperNames.length);
        const updatedRooms = sortedData.map((room, index) => {
          const housekeeperIndex = Math.floor(index / roomsPerHousekeeper);
          const assignedHousekeeper = housekeeperNames[housekeeperIndex] || housekeeperNames[0];
          return { ...room, assignedTo: assignedHousekeeper };
        });
        setRooms(updatedRooms);
        setIsDistributed(true);
        
        // Persist assignments in Supabase
        if (hotelId && housekeepers.length > 0) {
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
      } else {
        setRooms(sortedData);
        setIsDistributed(false);
      }
      
      toast({
        title: "PDF traité avec succès",
        description: `${data.length} chambres importées${distributionMethod ? ` et distribuées (${distributionMethod})` : ''}`
      });
      
    } catch (error) {
      console.error("❌ Erreur traitement PDF:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Erreur lors du traitement du PDF"
      });
    } finally {
      // Disable flag after delay
      setTimeout(async () => {
        setIsImporting(false);
        const { realtimeManager } = await import('@/services/RealtimeManager');
        realtimeManager.resume();
        console.log('✅ Import terminé, rechargement automatique réactivé');
      }, 3000);
    }
  }, [hotelId, housekeepers, setRooms, setHousekeeperNames, setIsDistributed, setAvailableFloors]);

  return {
    isImporting,
    handlePdfProcessed
  };
}
