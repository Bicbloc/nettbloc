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
    console.log(`📡 Temps réel [${table}] ${payload.eventType}:`, {
      roomNumber: payload.new?.room_number,
      status: payload.new?.status,
      notes: payload.new?.notes,
      assignedTo: payload.new?.housekeeper_name,
      id: payload.new?.id
    });
    
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    if (table === 'rooms' && (eventType === 'UPDATE' || eventType === 'INSERT')) {
      setRooms(prev => {
        const existingIndex = prev.findIndex(r => r.number === newRecord.room_number);
        if (existingIndex !== -1) {
          console.log(`✅ Chambre ${newRecord.room_number} trouvée, mise à jour: ${oldRecord?.status} → ${newRecord.status}`);
          return prev.map((r, i) => {
            if (i !== existingIndex) return r;
            // Normalize cleaning_type from database to UI format
            let normalizedCleaningType: typeof r.cleaningType = r.cleaningType;
            if (newRecord.cleaning_type === 'full' || newRecord.cleaning_type === 'a_blanc') {
              normalizedCleaningType = 'a_blanc';
            } else if (newRecord.cleaning_type === 'quick' || newRecord.cleaning_type === 'recouche') {
              normalizedCleaningType = 'recouche';
            }
            return { 
              ...r, 
              status: newRecord.status,
              cleaningType: normalizedCleaningType,
              notes: newRecord.notes || r.notes
            };
          });
        }
        console.log(`⚠️ Chambre ${newRecord.room_number} non trouvée dans la liste locale`);
        return prev;
      });

      // Notification only if status changes to clean
      if (newRecord.status === 'clean') {
        toast({
          title: "✅ Chambre nettoyée",
          description: `Chambre ${newRecord.room_number} marquée propre${newRecord.notes ? ` - ${newRecord.notes}` : ''}`,
          duration: 4000
        });
      }
    }
    
    if (table === 'assignments' && (eventType === 'INSERT' || eventType === 'UPDATE')) {
      console.log('✅ Assignment temps réel:', {
        housekeeper: newRecord.housekeeper_name,
        roomId: newRecord.room_id,
        status: newRecord.status
      });
      
      // Refresh data if an assignment is completed
      if (newRecord.status === 'completed' && hotelId) {
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
