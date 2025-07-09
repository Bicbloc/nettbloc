import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Room } from '@/services/pdfService';
import { useNotifications, Notification } from '@/hooks/use-notifications';
import { HotelSessionService } from '@/services/hotelSessionService';

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
  const [housekeeperNames, setHousekeeperNames] = useState<string[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isDistributed, setIsDistributed] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  
  const { notifications, addNotification } = useNotifications();
  const [housekeeperAccessCodes, setHousekeeperAccessCodes] = useState<Record<string, string>>({});

  // Initialiser la session au chargement
  useEffect(() => {
    const initializeSession = async () => {
      try {
        const token = await HotelSessionService.initializeSession();
        if (token) {
          console.log('Session initialisée:', token);
          await loadSessionData();
        }
      } catch (error) {
        console.error('Erreur initialisation session:', error);
        setIsInitialized(true);
      }
    };

    initializeSession();
  }, []);

  // Synchronisation en temps réel - vérifier les changements toutes les 5 secondes
  useEffect(() => {
    if (!isInitialized) return;

    const interval = setInterval(async () => {
      try {
        const session = await HotelSessionService.getSession();
        if (session) {
          // Mettre à jour les données si elles ont changé
          setHousekeeperNames(prev => {
            const newNames = session.housekeeper_names || [];
            return JSON.stringify(prev) !== JSON.stringify(newNames) ? newNames : prev;
          });
          
          setRooms(prev => {
            const newRooms = session.room_data || [];
            return JSON.stringify(prev) !== JSON.stringify(newRooms) ? newRooms : prev;
          });
          
          setIsDistributed(prev => {
            const newDistributed = session.is_distributed || false;
            return prev !== newDistributed ? newDistributed : prev;
          });

          // Générer des codes d'accès pour les nouvelles femmes de chambre
          setHousekeeperAccessCodes(prev => {
            const newCodes = { ...prev };
            (session.housekeeper_names || []).forEach((name, index) => {
              if (!newCodes[name]) {
                newCodes[name] = String(1000 + index).slice(-4);
              }
            });
            return newCodes;
          });
        }
      } catch (error) {
        console.error('Erreur synchronisation:', error);
      }
    }, 5000); // Vérifier toutes les 5 secondes

    return () => clearInterval(interval);
  }, [isInitialized]);

  // Charger les données de la session
  const loadSessionData = async () => {
    try {
      const session = await HotelSessionService.getSession();
      if (session) {
        setHousekeeperNames(session.housekeeper_names || []);
        setRooms(session.room_data || []);
        setIsDistributed(session.is_distributed || false);
        
        // Générer des codes d'accès pour les femmes de chambre
        const codes: Record<string, string> = {};
        (session.housekeeper_names || []).forEach((name, index) => {
          codes[name] = String(1000 + index).slice(-4);
        });
        setHousekeeperAccessCodes(codes);
        
        setIsInitialized(true);
        console.log('Données de session chargées:', {
          housekeepers: session.housekeeper_names?.length || 0,
          rooms: session.room_data?.length || 0,
          distributed: session.is_distributed,
          codes: Object.keys(codes).length
        });
      }
    } catch (error) {
      console.error('Erreur chargement session:', error);
      setIsInitialized(true);
    }
  };

  // Sauvegarder les changements en base de données
  useEffect(() => {
    if (isInitialized && housekeeperNames.length > 0) {
      HotelSessionService.updateHousekeeperNames(housekeeperNames);
    }
  }, [housekeeperNames, isInitialized]);

  useEffect(() => {
    if (isInitialized && rooms.length > 0) {
      HotelSessionService.updateRoomData(rooms);
    }
  }, [rooms, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      if (isDistributed) {
        HotelSessionService.markAsDistributed();
      }
      console.log("Session - isDistributed sauvegardé:", isDistributed);
    }
  }, [isDistributed, isInitialized]);

  const getHousekeeperRooms = (name: string) => {
    return rooms.filter(room => room.assignedTo === name);
  };

  const updateRoomStatus = async (roomNumber: string, newStatus: string, housekeeperName?: string) => {
    // Mettre à jour localement
    setRooms(prev => prev.map(room => 
      room.number === roomNumber 
        ? { ...room, status: newStatus }
        : room
    ));

    // Mettre à jour en base de données
    try {
      await HotelSessionService.updateRoomStatus(roomNumber, newStatus);
    } catch (error) {
      console.error('Erreur mise à jour statut chambre:', error);
    }

    // Ajouter notification pour l'admin
    const statusMessages = {
      'clean': 'a terminé le nettoyage de la chambre',
      'in-progress': 'a commencé le nettoyage de la chambre',
      'needs-attention': 'a signalé une remarque pour la chambre',
      'ready-to-clean': 'a marqué la chambre comme prête à nettoyer'
    };

    const message = statusMessages[newStatus as keyof typeof statusMessages];
    if (message && housekeeperName) {
      console.log('🔔 Envoi notification:', housekeeperName, roomNumber, newStatus);
      const notification = {
        title: `${housekeeperName} - Chambre ${roomNumber}`,
        description: `${housekeeperName} ${message} ${roomNumber}`,
        type: 'room-status' as const,
        housekeeperName,
        roomNumber,
      };
      console.log('📝 Notification créée:', notification);
      addNotification(notification);
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