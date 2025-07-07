import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Room } from '@/services/pdfService';
import { useNotifications, Notification } from '@/hooks/use-notifications';

interface HousekeepingContextType {
  housekeeperNames: string[];
  rooms: Room[];
  isDistributed: boolean;
  notifications: Notification[];
  housekeeperAccessCodes: Record<string, string>;
  setHousekeeperNames: React.Dispatch<React.SetStateAction<string[]>>;
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  setIsDistributed: (distributed: boolean) => void;
  setHousekeeperAccessCodes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
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
  const [housekeeperNames, setHousekeeperNames] = useState<string[]>(() => {
    const saved = localStorage.getItem('housekeeperNames');
    return saved ? JSON.parse(saved) : ["Housekeeper 1", "Housekeeper 2", "Housekeeper 3", "Housekeeper 4"];
  });
  
  const [rooms, setRooms] = useState<Room[]>(() => {
    const saved = localStorage.getItem('rooms');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [isDistributed, setIsDistributed] = useState<boolean>(() => {
    const saved = localStorage.getItem('isDistributed');
    return saved === 'true';
  });
  
  const { notifications, addNotification } = useNotifications();
  const [housekeeperAccessCodes, setHousekeeperAccessCodes] = useState<Record<string, string>>({});

  // Sauvegarder dans localStorage quand les données changent
  useEffect(() => {
    localStorage.setItem('housekeeperNames', JSON.stringify(housekeeperNames));
  }, [housekeeperNames]);

  useEffect(() => {
    localStorage.setItem('rooms', JSON.stringify(rooms));
  }, [rooms]);

  useEffect(() => {
    localStorage.setItem('isDistributed', isDistributed.toString());
    console.log("LocalStorage - isDistributed sauvegardé:", isDistributed);
  }, [isDistributed]);

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
      'needs-attention': 'a signalé une remarque pour la chambre',
      'ready-to-clean': 'a marqué la chambre comme prête à nettoyer'
    };

    const message = statusMessages[newStatus as keyof typeof statusMessages];
    if (message && housekeeperName) {
      console.log('Envoi notification:', housekeeperName, roomNumber, newStatus); // Debug
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
    housekeeperAccessCodes,
    setHousekeeperNames,
    setRooms,
    setIsDistributed,
    setHousekeeperAccessCodes,
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