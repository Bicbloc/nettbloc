import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Room } from '@/services/pdfService';
import { useNotifications, Notification } from '@/hooks/use-notifications';

interface HousekeepingContextType {
  housekeeperNames: string[];
  rooms: Room[];
  isDistributed: boolean;
  notifications: Notification[];
  setHousekeeperNames: React.Dispatch<React.SetStateAction<string[]>>;
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  setIsDistributed: (distributed: boolean) => void;
  getHousekeeperRooms: (name: string) => Room[];
  updateRoomStatus: (roomNumber: string, newStatus: string, housekeeperName?: string) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
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
  const [housekeeperNames, setHousekeeperNames] = useState<string[]>([
    "Housekeeper 1", "Housekeeper 2", "Housekeeper 3", "Housekeeper 4"
  ]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isDistributed, setIsDistributed] = useState<boolean>(false);
  const { notifications, addNotification } = useNotifications();

  const getHousekeeperRooms = (name: string) => {
    return rooms.filter(room => room.assignedTo === name);
  };

  const updateRoomStatus = (roomNumber: string, newStatus: string, housekeeperName?: string) => {
    setRooms(prev => prev.map(room => 
      room.number === roomNumber 
        ? { ...room, status: newStatus }
        : room
    ));

    // Ajouter notification pour l'admin
    const statusMessages = {
      'clean': 'a terminé le nettoyage de la chambre',
      'in-progress': 'a commencé le nettoyage de la chambre',
      'needs-attention': 'a signalé une remarque pour la chambre'
    };

    const message = statusMessages[newStatus as keyof typeof statusMessages];
    if (message && housekeeperName) {
      addNotification({
        title: `${housekeeperName} - Chambre ${roomNumber}`,
        description: `${housekeeperName} ${message} ${roomNumber}`,
        type: 'room-status',
        housekeeperName,
        roomNumber,
      });
    }
  };

  const value = {
    housekeeperNames,
    rooms,
    isDistributed,
    notifications,
    setHousekeeperNames,
    setRooms,
    setIsDistributed,
    getHousekeeperRooms,
    updateRoomStatus,
    addNotification,
  };

  return (
    <HousekeepingContext.Provider value={value}>
      {children}
    </HousekeepingContext.Provider>
  );
};