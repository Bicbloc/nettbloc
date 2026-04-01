import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Room } from '@/services/pdfService';
import { useNotifications, type Notification } from '@/hooks/use-notifications';
import { HotelSessionService } from '@/services/hotelSessionService';
import { supabase } from '@/integrations/supabase/client';
import { useHotel } from '@/contexts/HotelContext';
import { storageService } from '@/services/storageService';

interface HousekeepingContextType {
  housekeeperNames: string[];
  rooms: Room[];
  isDistributed: boolean;
  notifications: Notification[];
  housekeepers: Array<{id: string, name: string, access_code: string, user_id: string}>;
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
  
  // Utiliser HotelContext comme source de vérité pour hotelId
  const { hotelId: contextHotelId, isHotelReady } = useHotel();
  const hotelId = contextHotelId;
  
  const [housekeepers, setHousekeepers] = useState<Array<{id: string, name: string, access_code: string, user_id: string}>>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  
  // Hook notifications utilise hotelId du contexte
  const notificationsHook = useNotifications(hotelId || undefined);
  const notifications = notificationsHook?.notifications || [];
  const addNotificationFn = notificationsHook?.addNotification;

  // Initialisation basée sur HotelContext
  useEffect(() => {
    if (isHotelReady && hotelId) {
      setIsInitialized(true);
    } else if (isHotelReady && !hotelId) {
      // Pas d'hôtel (mode invité ou pas connecté)
      setIsInitialized(true);
    }
  }, [isHotelReady, hotelId]);

  // Synchronisation via Realtime — plus de polling
  // Les subscriptions Realtime sur rooms et housekeepers gèrent les mises à jour

  // Charger les données de la session - simplifié car hotelId vient de HotelContext
  const loadSessionData = async () => {
    if (!hotelId) return;
    
    try {
      const session = await HotelSessionService.getSession();
      if (session) {
        setHousekeeperNames(session.housekeeper_names || []);
        setIsDistributed(false);
        
        // Charger les femmes de chambre depuis la base
        await refreshHousekeepers();
        
        setIsInitialized(true);
      }
    } catch (error) {
      console.error('Erreur chargement session:', error);
      setIsInitialized(true);
    }
  };

  // Sauvegarder les changements en base de données et créer les femmes de chambre
  useEffect(() => {
    if (isInitialized && housekeeperNames.length > 0) {
      HotelSessionService.updateHousekeeperNames(housekeeperNames);
      // NOTE: Ne plus appeler syncHousekeepersToDatabase ici car refreshHousekeepers
      // ajoute des noms depuis la BD ce qui re-déclenche cet effect et crée des doublons.
      // La création se fait uniquement via HousekeeperManagement ou handleApproveRequest.
    }
  }, [housekeeperNames, isInitialized]);

  // NOUVEAU: Persister les assignations après chaque modification de rooms
  useEffect(() => {
    if (isInitialized && rooms.length > 0) {
      // Créer un mapping housekeeper -> chambres assignées
      const assignments: Record<string, string> = {};
      rooms.forEach(room => {
        if (room.assignedTo) {
          if (!assignments[room.assignedTo]) {
            assignments[room.assignedTo] = room.number;
          } else {
            assignments[room.assignedTo] += ',' + room.number;
          }
        }
      });

      // Persister immédiatement avec hotel_id
      HotelSessionService.updateHousekeeperAssignments(assignments, hotelId || undefined);
    }
  }, [rooms, isInitialized]);

  // Fonction pour synchroniser les femmes de chambre avec la base de données
  const syncHousekeepersToDatabase = async () => {
    if (!hotelId || housekeeperNames.length === 0) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Récupérer les femmes de chambre existantes
      const { data: existingHousekeepers } = await supabase
        .from('housekeepers')
        .select('name')
        .eq('hotel_id', hotelId)
        .eq('is_active', true);

      const existingNames = existingHousekeepers?.map(h => h.name) || [];
      const newNames = housekeeperNames.filter(name => !existingNames.includes(name));

      // Créer les nouvelles femmes de chambre avec des codes d'accès via la fonction SQL
      for (const name of newNames) {
        // Utiliser la fonction SQL pour générer un code valide
        const { data: accessCode, error: codeError } = await supabase
          .rpc('generate_and_insert_access_code', {
            p_hotel_id: hotelId,
            p_housekeeper_name: name
          });
        
        if (codeError) {
          console.error('❌ Erreur génération code pour', name, ':', codeError);
        } else {
        }
      }

      if (newNames.length > 0) {
        // Rafraîchir la liste après création
        await refreshHousekeepers();
      }
    } catch (error) {
      console.error('❌ Erreur synchronisation femmes de chambre:', error);
    }
  };

  // Phase 3: Les rooms sont maintenant dans Supabase uniquement - plus de sauvegarde localStorage
  // Seules les assignations sont sauvegardées dans la table assignments
  useEffect(() => {
    if (!hotelId || rooms.length === 0) return;

    const saveAssignments = async () => {
      // Sauvegarder uniquement les assignations dans la session pour compatibilité
      const assignments = rooms
        .filter(room => room.assignedTo)
        .reduce((acc, room) => ({
          ...acc,
          [room.number]: room.assignedTo
        }), {});

      await HotelSessionService.updateHousekeeperAssignments(assignments, hotelId);
    };

    const debounceTimeout = setTimeout(saveAssignments, 1000);
    return () => clearTimeout(debounceTimeout);
  }, [rooms, hotelId]);

  useEffect(() => {
    if (isInitialized) {
      if (isDistributed) {
        HotelSessionService.markAsDistributed();
        // DÉSACTIVÉ: Génération automatique des codes d'accès
        // generateAccessCodesForAssignedHousekeepers();
      }
    }
  }, [isDistributed, isInitialized]);


  // Fonction pour générer automatiquement les codes d'accès après distribution
  const generateAccessCodesForAssignedHousekeepers = async (force = false) => {
    const currentHotelId = hotelId || storageService.getHotelId();
    if (!currentHotelId || housekeeperNames.length === 0) {
      return;
    }

    // Forcer la génération ou attendre que la distribution soit faite
    if (!force && !isDistributed) {
      return;
    }


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
        
        // Récupérer le code hôtel
        const { data: hotel } = await supabase
          .from('hotels')
          .select('hotel_code')
          .eq('id', currentHotelId)
          .single();

        const hotelCode = hotel?.hotel_code || 'HTL';
        
        // DÉSACTIVÉ: Génération automatique des codes
        // const { CodeGenerationService } = await import('@/services/codeGenerationService');
        // const generated = await CodeGenerationService.ensureCodesForHotel(currentHotelId, newHousekeepers);
        

        // DÉSACTIVÉ: Rafraîchir les femmes de chambre automatiquement
        // await refreshHousekeepers();

        // DÉSACTIVÉ: Notification de succès automatique
        // const { toast } = await import('@/hooks/use-toast');
        // toast({
        //   title: "Codes d'accès générés",
        //   description: `${newHousekeepers.length} code(s) d'accès généré(s) automatiquement pour les femmes de chambre.`
        // });
      } else {
      }
    } catch (error) {
      console.error('❌ Erreur génération automatique des codes:', error);
    }
  };

  const getHousekeeperRooms = (name: string) => {
    return rooms.filter(room => room.assignedTo === name);
  };

  const updateRoomStatus = async (roomNumber: string, newStatus: string, housekeeperName?: string, remark?: string) => {
    
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

    // JOURNAL D'ACTIONS: Logger les changements de statut importants
    if (hotelId && housekeeperName) {
      try {
        const { ActionLogService } = await import('@/services/actionLogService');
        
        if (newStatus === 'clean') {
          // Logger la fin de nettoyage
          await ActionLogService.logCleaningEnd(hotelId, roomNumber, housekeeperName);
          
          // Si un commentaire/remarque est fourni, le logger aussi
          if (remark && remark.trim()) {
            await ActionLogService.logAction({
              hotelId,
              actionType: 'comment',
              actorName: housekeeperName,
              actorType: 'housekeeper',
              roomNumber,
              description: `Commentaire de ${housekeeperName} pour CH ${roomNumber}: "${remark}"`,
              details: { comment: remark, roomStatus: 'clean' }
            });
          }
        } else if (newStatus === 'in_progress') {
          // Logger le début de nettoyage
          await ActionLogService.logCleaningStart(hotelId, roomNumber, housekeeperName);
        } else if (newStatus === 'needs-attention' && remark) {
          // Logger un signalement de problème
          await ActionLogService.logAction({
            hotelId,
            actionType: 'comment',
            actorName: housekeeperName,
            actorType: 'housekeeper',
            roomNumber,
            description: `Problème signalé par ${housekeeperName} pour CH ${roomNumber}: "${remark}"`,
            details: { comment: remark, roomStatus: 'needs-attention' }
          });
        }
      } catch (error) {
        console.error('❌ Erreur logging action:', error);
      }
    }

    // Ajouter notification pour l'admin - FORMAT AMÉLIORÉ (avec sécurité)
    if (housekeeperName && hotelId && addNotificationFn) {
      
      let notification;
      
      if (newStatus === 'clean') {
        notification = {
          title: `Femme de chambre (${housekeeperName}) - CH ${roomNumber} - Propre`,
          description: remark 
            ? `${housekeeperName} a terminé le nettoyage de la chambre ${roomNumber}. Remarque: "${remark}"`
            : `${housekeeperName} a terminé le nettoyage de la chambre ${roomNumber}`,
          type: 'cleaning-end' as const,
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

      if (addNotificationFn) {
        await addNotificationFn(notification);
      }
    } else {
    }
  };

  // Fonction pour valider la connexion hôtel
  // Validation simplifiée - hotelId vient de HotelContext
  const validateHotelConnection = async (): Promise<string | null> => {
    // Le hotelId est maintenant géré par HotelContext
    return hotelId || null;
  };


  // Rafraîchir la liste des housekeepers depuis la BD - AUTOMATIQUE toutes les 30s
  const refreshHousekeepers = useCallback(async () => {
    const currentHotelId = hotelId || storageService.getHotelId();
    if (!currentHotelId) return;
    
    try {
      const { data, error } = await supabase
        .from('housekeepers')
        .select('id, name, access_code, user_id')
        .eq('hotel_id', currentHotelId)
        .eq('is_active', true);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setHousekeepers(data);
        
        // Mettre à jour aussi housekeeperNames
        const allNames = data.map(h => h.name);
        setHousekeeperNames(prevNames => {
          const combined = [...new Set([...prevNames, ...allNames])];
          return combined;
        });
      }
    } catch (error) {
      console.error('❌ Erreur lors du rafraîchissement des housekeepers:', error);
    }
  }, [hotelId]);

  // Realtime subscription for housekeepers — replaces 30s polling
  useEffect(() => {
    if (!hotelId) return;
    
    refreshHousekeepers(); // Initial load
    
    const channel = supabase
      .channel(`housekeepers-sync-${hotelId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'housekeepers',
        filter: `hotel_id=eq.${hotelId}`,
      }, () => {
        refreshHousekeepers();
      })
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, [hotelId, refreshHousekeepers]);

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
    addNotification: addNotificationFn || (async () => null),
    validateHotelConnection,
    refreshHousekeepers,
  };

  return (
    <HousekeepingContext.Provider value={value}>
      {children}
    </HousekeepingContext.Provider>
  );
};