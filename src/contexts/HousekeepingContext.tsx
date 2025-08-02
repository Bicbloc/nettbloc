import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Room } from '@/services/pdfService';
import { useNotifications, Notification } from '@/hooks/use-notifications';
import { HotelSessionService } from '@/services/hotelSessionService';

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
  const [housekeeperNames, setHousekeeperNames] = useState<string[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isDistributed, setIsDistributed] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  
  const [hotelId, setHotelId] = useState<string | null>(null);
  const { notifications, addNotification } = useNotifications(hotelId || undefined);
  const [housekeepers, setHousekeepers] = useState<Array<{id: string, name: string, access_code: string}>>([]);

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

          // Charger les vraies femmes de chambre depuis la base si on a un hotelId
          refreshHousekeepers();
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
        
        // Récupérer l'ID réel de l'hôtel depuis la base de données
        let sessionHotelId = session.hotel_id;
        const savedHotelCode = localStorage.getItem('selectedHotelCode');
        const savedHotelId = localStorage.getItem('selectedHotelId');
        
        // Valider l'UUID
        const isValidUUID = (uuid: string) => {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          return uuidRegex.test(uuid);
        };
        
        // Priorité au hotelId sauvegardé s'il est valide
        if (savedHotelId && isValidUUID(savedHotelId)) {
          sessionHotelId = savedHotelId;
          console.log('✅ Context - Hotel ID valide récupéré depuis localStorage:', sessionHotelId);
        } else if (savedHotelCode) {
          // Récupérer l'hôtel réel depuis la base de données par son code
          try {
            const { SupabaseService } = await import('@/services/supabaseService');
            const hotel = await SupabaseService.getHotelByCode(savedHotelCode);
            
            if (hotel) {
              sessionHotelId = hotel.id;
              localStorage.setItem('selectedHotelId', hotel.id);
              localStorage.setItem('selectedHotelName', hotel.name);
              console.log('✅ Context - Hotel ID réel récupéré depuis la base:', sessionHotelId);
            } else {
              console.error('❌ Context - Hôtel non trouvé pour le code:', savedHotelCode);
            }
          } catch (error) {
            console.error('❌ Context - Erreur récupération hôtel:', error);
          }
        }
        
        // Assurer qu'on a un hotelId valide
        if (sessionHotelId && isValidUUID(sessionHotelId)) {
          setHotelId(sessionHotelId);
          console.log('✅ Context - Hotel ID valide défini pour les notifications:', sessionHotelId);
        } else {
          console.warn('⚠️ Context - Aucun hotelId valide trouvé - notifications désactivées');
        }
        
        // Charger les vraies femmes de chambre depuis la base
        if (sessionHotelId) {
          await refreshHousekeepers();
        }
        
        setIsInitialized(true);
        console.log('Données de session chargées:', {
          housekeepers: session.housekeeper_names?.length || 0,
          rooms: session.room_data?.length || 0,
          distributed: session.is_distributed,
          hotelId: sessionHotelId
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
        // Générer automatiquement les codes d'accès pour les femmes de chambre
        generateAccessCodesForAssignedHousekeepers();
      }
      console.log("Session - isDistributed sauvegardé:", isDistributed);
    }
  }, [isDistributed, isInitialized]);

  // Vérification périodique pour s'assurer que tous les housekeepers ont des codes
  useEffect(() => {
    if (!isInitialized || !hotelId || housekeeperNames.length === 0) return;

    const checkMissingCodes = async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        
        const { data: existingHousekeepers } = await supabase
          .from('housekeepers')
          .select('name')
          .eq('hotel_id', hotelId)
          .eq('is_active', true);

        const existingNames = existingHousekeepers?.map(h => h.name) || [];
        const missingHousekeepers = housekeeperNames.filter(name => !existingNames.includes(name));
        
        if (missingHousekeepers.length > 0) {
          console.log('🔍 Femmes de chambre sans codes détectées:', missingHousekeepers);
          generateAccessCodesForAssignedHousekeepers(true); // Force la génération
        }
      } catch (error) {
        console.error('❌ Erreur vérification codes manquants:', error);
      }
    };

    // Vérifier immédiatement puis toutes les 30 secondes
    checkMissingCodes();
    const interval = setInterval(checkMissingCodes, 30000);
    
    return () => clearInterval(interval);
  }, [isInitialized, hotelId, housekeeperNames]);

  // Fonction pour générer automatiquement les codes d'accès après distribution
  const generateAccessCodesForAssignedHousekeepers = async (force = false) => {
    const currentHotelId = hotelId || localStorage.getItem('selectedHotelId');
    if (!currentHotelId || housekeeperNames.length === 0) {
      console.log('⚠️ Génération codes: Conditions non remplies', { currentHotelId, housekeeperCount: housekeeperNames.length });
      return;
    }

    // Forcer la génération ou attendre que la distribution soit faite
    if (!force && !isDistributed) {
      console.log('⚠️ Génération codes: Distribution pas encore faite, attente...');
      return;
    }

    console.log('🔑 Génération automatique des codes d\'accès pour les femmes de chambre...');

    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Vérifier les femmes de chambre existantes dans la base
      const { data: existingHousekeepers } = await supabase
        .from('housekeepers')
        .select('name, access_code')
        .eq('hotel_id', currentHotelId)
        .eq('is_active', true);

      const existingNames = existingHousekeepers?.map(h => h.name) || [];
      const newHousekeepers = housekeeperNames.filter(name => !existingNames.includes(name));

      if (newHousekeepers.length > 0) {
        console.log('📝 Création de nouvelles femmes de chambre:', newHousekeepers);
        
        // Récupérer le code hôtel
        const { data: hotel } = await supabase
          .from('hotels')
          .select('hotel_code')
          .eq('id', currentHotelId)
          .single();

        const hotelCode = hotel?.hotel_code || 'HTL';
        
        // Utiliser le service de génération pour créer les codes
        const { CodeGenerationService } = await import('@/services/codeGenerationService');
        const generated = await CodeGenerationService.ensureCodesForHotel(currentHotelId, newHousekeepers);
        
        console.log(`✅ ${generated} codes d'accès générés automatiquement`);

        // Rafraîchir les femmes de chambre
        await refreshHousekeepers();

        // Notification de succès
        const { toast } = await import('@/hooks/use-toast');
        toast({
          title: "Codes d'accès générés",
          description: `${newHousekeepers.length} code(s) d'accès généré(s) automatiquement pour les femmes de chambre.`
        });
      } else {
        console.log('✅ Toutes les femmes de chambre ont déjà des codes d\'accès');
      }
    } catch (error) {
      console.error('❌ Erreur génération automatique des codes:', error);
    }
  };

  const getHousekeeperRooms = (name: string) => {
    return rooms.filter(room => room.assignedTo === name);
  };

  const updateRoomStatus = async (roomNumber: string, newStatus: string, housekeeperName?: string, remark?: string) => {
    console.log('🔄 updateRoomStatus appelé:', { roomNumber, newStatus, housekeeperName, remark, hotelId });
    
    // Mettre à jour localement
    setRooms(prev => prev.map(room => 
      room.number === roomNumber 
        ? { ...room, status: newStatus, remark: remark || room.remark }
        : room
    ));

    // Mettre à jour en base de données
    try {
      await HotelSessionService.updateRoomStatus(roomNumber, newStatus);
    } catch (error) {
      console.error('Erreur mise à jour statut chambre:', error);
    }

    // Ajouter notification pour l'admin - FORMAT AMÉLIORÉ
    if (housekeeperName && hotelId) {
      console.log('🔔 Création notification avec hotelId:', hotelId);
      
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

      console.log('📝 Envoi notification:', notification);
      addNotification(notification);
    } else {
      console.warn('⚠️ Notification non créée - manque housekeeperName ou hotelId:', { housekeeperName, hotelId });
    }
  };

  // Fonction pour valider la connexion hôtel
  const validateHotelConnection = async (): Promise<string | null> => {
    const savedHotelCode = localStorage.getItem('selectedHotelCode');
    const savedHotelId = localStorage.getItem('selectedHotelId');
    
    if (savedHotelCode && (!savedHotelId || !hotelId)) {
      console.log('⚙️ Context - Validation de la connexion hôtel...');
      try {
        const { SupabaseService } = await import('@/services/supabaseService');
        const hotel = await SupabaseService.getHotelByCode(savedHotelCode);
        
        if (hotel) {
          localStorage.setItem('selectedHotelId', hotel.id);
          localStorage.setItem('selectedHotelName', hotel.name);
          setHotelId(hotel.id);
          console.log('✅ Context - Connexion hôtel validée:', hotel.id);
          return hotel.id;
        } else {
          console.error('❌ Context - Hôtel non trouvé pour le code:', savedHotelCode);
        }
      } catch (error) {
        console.error('❌ Context - Erreur validation hôtel:', error);
      }
    }
    
    return hotelId || savedHotelId;
  };

  // Fonction pour charger les femmes de chambre depuis la base
  const refreshHousekeepers = async () => {
    const currentHotelId = hotelId || localStorage.getItem('selectedHotelId');
    if (!currentHotelId) return;
    
    try {
      const { SupabaseService } = await import('@/services/supabaseService');
      const dbHousekeepers = await SupabaseService.getHousekeepers(currentHotelId);
      
      setHousekeepers(dbHousekeepers.map(h => ({
        id: h.id,
        name: h.name,
        access_code: h.access_code
      })));
      
      console.log('✅ Femmes de chambre chargées depuis la base:', dbHousekeepers.length);
    } catch (error) {
      console.error('❌ Erreur chargement femmes de chambre:', error);
    }
  };

  const value = {
    housekeeperNames,
    rooms,
    isDistributed,
    notifications,
    housekeepers,
    setHousekeeperNames,
    setRooms,
    setIsDistributed,
    getHousekeeperRooms,
    updateRoomStatus,
    addNotification,
    validateHotelConnection,
    refreshHousekeepers,
  };

  return (
    <HousekeepingContext.Provider value={value}>
      {children}
    </HousekeepingContext.Provider>
  );
};