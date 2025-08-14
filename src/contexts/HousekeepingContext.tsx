import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Room } from '@/services/pdfService';
import { useNotifications, type Notification } from '@/hooks/use-notifications';
import { HotelStateManager } from '@/services/HotelStateManager';
import { supabase } from '@/integrations/supabase/client';

interface HousekeepingContextType {
  housekeeperNames: string[];
  rooms: Room[];
  isDistributed: boolean;
  notifications: Notification[];
  housekeepers: Array<{id: string, name: string, access_code: string}>;
  setHousekeeperNames: React.Dispatch<React.SetStateAction<string[]>>;
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  setIsDistributed: (distributed: boolean) => void;
  getHousekeeperRooms: (name: string) => Room[];
  updateRoomStatus: (roomNumber: string, newStatus: string, housekeeperName?: string, remark?: string) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'is_read' | 'hotel_id'>) => void;
  validateHotelConnection: () => Promise<string | null>;
  refreshHousekeepers: () => Promise<void>;
}

const HousekeepingContext = createContext<HousekeepingContextType | undefined>(undefined);

export const useHousekeeping = () => {
  const context = useContext(HousekeepingContext);
  if (!context) {
    throw new Error('useHousekeeping must be used within a HousekeepingProvider');
  }
  return context;
};

interface HousekeepingProviderProps {
  children: ReactNode;
}

export const HousekeepingProvider: React.FC<HousekeepingProviderProps> = ({ children }) => {
  const manager = HotelStateManager.getInstance();
  const [hotelState, setHotelState] = useState(manager.getState());
  const { notifications, addNotification } = useNotifications(hotelState.hotel?.id);
  const [housekeepers, setHousekeepers] = useState<Array<{id: string, name: string, access_code: string}>>([]);

  // Subscribe to hotel state changes
  useEffect(() => {
    const unsubscribe = manager.subscribe(setHotelState);
    return unsubscribe;
  }, [manager]);

  // Refresh housekeepers when hotel changes
  useEffect(() => {
    if (hotelState.hotel?.id) {
      refreshHousekeepers();
    }
  }, [hotelState.hotel?.id]);

  // Sync data every 30 seconds (reduced frequency)
  useEffect(() => {
    if (!hotelState.hotel?.id) return;

    const interval = setInterval(() => {
      // Only refresh housekeepers to avoid state conflicts
      refreshHousekeepers();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [hotelState.hotel?.id]);

  const getHousekeeperRooms = (name: string): Room[] => {
    return hotelState.rooms.filter(room => room.assignedTo === name);
  };

  const updateRoomStatus = (roomNumber: string, newStatus: string, housekeeperName?: string, remark?: string) => {
    const updatedRooms = hotelState.rooms.map(room => {
      if (room.number === roomNumber) {
        return { 
          ...room, 
          status: newStatus,
          remark: remark || room.remark
        };
      }
      return room;
    });
    
    manager.setRooms(updatedRooms);

    // Add notification for admin
    if (housekeeperName && hotelState.hotel?.id) {
      let notification;
      
      if (newStatus === 'clean') {
        notification = {
          title: `Femme de chambre (${housekeeperName}) - CH ${roomNumber} - Propre`,
          description: `${housekeeperName} a terminé le nettoyage de la chambre ${roomNumber}`,
          type: 'cleaning-end' as const,
          housekeeperName,
          roomNumber,
          user_type: 'admin' as const,
        };
      } else if (newStatus === 'in-progress') {
        notification = {
          title: `Femme de chambre (${housekeeperName}) - CH ${roomNumber} - En cours`,
          description: `${housekeeperName} a commencé le nettoyage de la chambre ${roomNumber}`,
          type: 'cleaning-start' as const,
          housekeeperName,
          roomNumber,
          user_type: 'admin' as const,
        };
      } else if (newStatus === 'needs-attention') {
        notification = {
          title: `Remarque de la femme de chambre (${housekeeperName}) - CH ${roomNumber} - Problème signalé`,
          description: remark ? `${housekeeperName} a signalé: "${remark}"` : `${housekeeperName} a signalé un problème dans la chambre ${roomNumber}`,
          type: 'remark' as const,
          housekeeperName,
          roomNumber,
          user_type: 'admin' as const,
        };
      } else {
        notification = {
          title: `Femme de chambre (${housekeeperName}) - CH ${roomNumber}`,
          description: `${housekeeperName} a mis à jour le statut de la chambre ${roomNumber}`,
          type: 'room-status' as const,
          housekeeperName,
          roomNumber,
          user_type: 'admin' as const,
        };
      }

      addNotification(notification);
    }
  };

  const validateHotelConnection = async (): Promise<string | null> => {
    try {
      if (!hotelState.hotel?.id) {
        return "Aucun hôtel configuré";
      }

      const { data: hotel, error } = await supabase
        .from('hotels')
        .select('id, name, hotel_code')
        .eq('id', hotelState.hotel.id)
        .single();

      if (error || !hotel) {
        return "Impossible de valider la connexion à l'hôtel";
      }

      console.log('✅ Connexion hôtel validée:', hotel);
      return null;
    } catch (error) {
      console.error('Erreur validation connexion hôtel:', error);
      return "Erreur de connexion à la base de données";
    }
  };

  const refreshHousekeepers = async () => {
    try {
      if (!hotelState.hotel?.id) {
        console.log('Pas de hotelId, skip refresh housekeepers');
        return;
      }

      const { data: housekeepersData, error } = await supabase
        .from('housekeepers')
        .select('id, name, access_code')
        .eq('hotel_id', hotelState.hotel.id)
        .eq('is_active', true);

      if (error) {
        console.error('Erreur récupération housekeepers:', error);
        return;
      }

      const validHousekeepers = (housekeepersData || []).filter(h => h.name && h.access_code);
      setHousekeepers(validHousekeepers);
      
      // Update names in the unified state
      const names = validHousekeepers.map(h => h.name);
      if (names.length > 0) {
        manager.setHousekeeperNames(names);
      }

      console.log('✅ Femmes de chambre mises à jour:', validHousekeepers.length);
    } catch (error) {
      console.error('Erreur refresh housekeepers:', error);
    }
  };

  const setIsDistributed = (distributed: boolean) => {
    manager.setDistributed(distributed);
  };

  return (
    <HousekeepingContext.Provider value={{
      housekeeperNames: hotelState.housekeeperNames,
      rooms: hotelState.rooms,
      isDistributed: hotelState.isDistributed,
      notifications,
      housekeepers,
      setHousekeeperNames: manager.setHousekeeperNames.bind(manager),
      setRooms: manager.setRooms.bind(manager),
      setIsDistributed,
      getHousekeeperRooms,
      updateRoomStatus,
      addNotification,
      validateHotelConnection,
      refreshHousekeepers
    }}>
      {children}
    </HousekeepingContext.Provider>
  );
};
