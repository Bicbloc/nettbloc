import { useCallback } from 'react';
import { Room } from '@/services/pdfService';
import { toast } from '@/hooks/use-toast';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';

interface UseRealtimeRoomsProps {
  hotelId: string | null;
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  refreshHousekeepers?: () => Promise<void>;
}

interface UseRealtimeRoomsReturn {
  realtimeSync: ReturnType<typeof useRealtimeSync>;
}

export function useRealtimeRooms({
  hotelId,
  setRooms,
  refreshHousekeepers
}: UseRealtimeRoomsProps): UseRealtimeRoomsReturn {
  
  const handleRealtimeUpdate = useCallback((table: string, payload: any) => {
    const updateInfo = {
      roomNumber: payload.new?.room_number,
      status: payload.new?.status,
      cleaning_type: payload.new?.cleaning_type,
      notes: payload.new?.notes,
      assignedTo: payload.new?.housekeeper_name,
      id: payload.new?.id
    };
    
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    if (table === 'rooms' && (eventType === 'UPDATE' || eventType === 'INSERT')) {
      setRooms(prev => {
        // Try to find by room_number
        const existingIndex = prev.findIndex(r => 
          r.number === newRecord.room_number
        );
        
        if (existingIndex !== -1) {
          
          const updatedRooms = prev.map((r, i) => {
            if (i !== existingIndex) return r;
            
            // Normalize cleaning_type from database to UI format
            let normalizedCleaningType: typeof r.cleaningType = r.cleaningType;
            const dbCleaningType = (newRecord.cleaning_type || '').toLowerCase();
            
            if (dbCleaningType === 'full' || dbCleaningType === 'a_blanc' || dbCleaningType === 'checkout') {
              normalizedCleaningType = 'a_blanc';
            } else if (dbCleaningType === 'quick' || dbCleaningType === 'recouche' || dbCleaningType === 'stayover') {
              normalizedCleaningType = 'recouche';
            } else if (dbCleaningType === 'none') {
              normalizedCleaningType = 'none';
            }
            
            // Also preserve cleaning_type for RoomStatusTabs filtering
            return { 
              ...r, 
              status: newRecord.status,
              cleaningType: normalizedCleaningType,
              cleaning_type: newRecord.cleaning_type, // Keep raw value for filtering
              notes: newRecord.notes || r.notes
            };
          });
          

          return updatedRooms;
        }
        
        return prev;
      });

      // Notification for status changes
      if (newRecord.status === 'clean' && oldRecord?.status !== 'clean') {
        toast({
          title: "✅ Chambre nettoyée",
          description: `Chambre ${newRecord.room_number} marquée propre${newRecord.notes ? ` - ${newRecord.notes}` : ''}`,
          duration: 4000
        });
      }
      
      // Notification for checkout status
      if ((newRecord.status === 'checkout' || newRecord.status === 'ready-to-clean') && 
          oldRecord?.status !== 'checkout' && oldRecord?.status !== 'ready-to-clean') {
        toast({
          title: "🚪 Client sorti",
          description: `Chambre ${newRecord.room_number} - Client sorti`,
          duration: 4000
        });
      }
    }
    
    if (table === 'assignments' && (eventType === 'INSERT' || eventType === 'UPDATE')) {
        housekeeper: newRecord.housekeeper_name,
        roomId: newRecord.room_id,
        status: newRecord.status
      });
      
      // Refresh data if an assignment is completed or modified
      if ((newRecord.status === 'completed' || eventType === 'UPDATE') && hotelId) {
        setTimeout(() => {
          refreshHousekeepers?.();
        }, 500);
      }
    }
  }, [hotelId, setRooms, refreshHousekeepers]);

  const realtimeSync = useRealtimeSync({
    hotelId: hotelId || undefined,
    tables: ['rooms', 'assignments'],
    onUpdate: handleRealtimeUpdate
  });

  return {
    realtimeSync
  };
}
