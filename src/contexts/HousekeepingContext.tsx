import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Room } from '@/services/pdfService';
import { useNotifications, type Notification } from '@/hooks/use-notifications';
import { HotelSessionService } from '@/services/hotelSessionService';
import { supabase } from '@/integrations/supabase/client';
import { HotelStorageService } from '@/services/hotelStorageService';

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
  
  const [hotelId, setHotelId] = useState<string | null>(null);
  const [housekeepers, setHousekeepers] = useState<Array<{id: string, name: string, access_code: string, user_id: string}>>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  
  // Hook notifications APRÈS les autres états pour éviter les problèmes de montage
  const notificationsHook = useNotifications(hotelId || undefined);
  const notifications = notificationsHook?.notifications || [];
  const addNotificationFn = notificationsHook?.addNotification;

  // Initialiser la session avec persistance RENFORCÉE
  useEffect(() => {
    const initializeSession = async () => {
      try {
        console.log('🏠 Initialisation de la session avec persistance renforcée...');
        
        // ÉTAPE 1: Restaurer l'hôtel depuis le service centralisé
        const hotelSession = HotelStorageService.get();
        
        if (hotelSession?.id) {
          setHotelId(hotelSession.id);
          console.log('✅ Hotel ID restauré depuis HotelStorageService:', hotelSession.id);
        }
        
        // ÉTAPE 2: Initialiser/restaurer la session
        const token = await HotelSessionService.initializeSession();
        if (token) {
          console.log('✅ Session initialisée:', token);
          
          // ÉTAPE 3: Charger les données de session
          await loadSessionData();
          
          // ÉTAPE 4: Forcer la sauvegarde immédiate avec le service centralisé
          const session = await HotelSessionService.getSession();
          if (session?.hotel_id) {
            // Get hotel info from session
            const hotelCode = localStorage.getItem('selectedHotelCode') || '';
            const hotelName = localStorage.getItem('selectedHotelName') || '';
            
            HotelStorageService.save({
              id: session.hotel_id,
              name: hotelName,
              code: hotelCode
            });
          }
        }
      } catch (error) {
        console.error('❌ Erreur initialisation session:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    initializeSession();
  }, []);

  // Synchronisation temps réel ROBUSTE avec sauvegarde continue
  useEffect(() => {
    if (!isInitialized) return;

    const interval = setInterval(async () => {
      try {
        const session = await HotelSessionService.getSession();
        if (session) {
          // SAUVEGARDE CONTINUE dans localStorage + SessionPersistenceService
          const { SessionPersistenceService } = await import('@/services/sessionPersistenceService');
          
          // Sauvegarder l'hotel_id dans TOUS les emplacements
          if (session.hotel_id) {
            localStorage.setItem('selectedHotelId', session.hotel_id);
            localStorage.setItem('hotelId', session.hotel_id);
            localStorage.setItem('lastSavedHotelId', session.hotel_id);
            localStorage.setItem('currentHotelId', session.hotel_id);
            setHotelId(session.hotel_id);
          }
          
          // Sauvegarder les données de session complètes
          SessionPersistenceService.saveSessionData({
            sessionToken: HotelSessionService.getSessionToken() || '',
            hotelId: session.hotel_id || '',
            lastActiveDate: new Date().toISOString(),
            room_data: session.room_data,
            housekeeper_assignments: session.housekeeper_assignments
          });

          // Mettre à jour les données si elles ont changé
          setHousekeeperNames(prev => {
            const newNames = session.housekeeper_names || [];
            return JSON.stringify(prev) !== JSON.stringify(newNames) ? newNames : prev;
          });
          
          setRooms(prev => {
            const newRooms = session.room_data || [];
            return JSON.stringify(prev) !== JSON.stringify(newRooms) ? newRooms : prev;
          });

          // Rafraîchir les femmes de chambre moins fréquemment
          if (session.hotel_id && Math.random() < 0.1) { // 10% des fois seulement
            refreshHousekeepers();
          }
        }
      } catch (error) {
        console.error('⚠️ Erreur synchronisation, tentative de récupération...', error);
        
        // RÉCUPÉRATION AUTOMATIQUE en cas d'erreur avec fallback vers données locales
        const { SessionPersistenceService } = await import('@/services/sessionPersistenceService');
        const savedData = SessionPersistenceService.getSavedSessionData();
        
        if (savedData) {
          console.log('🔄 Restauration depuis session locale');
          if (savedData.hotelId && !hotelId) {
            setHotelId(savedData.hotelId);
            localStorage.setItem('selectedHotelId', savedData.hotelId);
          }
          if (savedData.room_data && rooms.length === 0) {
            setRooms(savedData.room_data);
          }
          if (savedData.housekeeper_assignments && housekeeperNames.length === 0) {
            setHousekeeperNames(Object.keys(savedData.housekeeper_assignments));
          }
        }
      }
    }, 5000); // Réduit à 5 secondes au lieu de 2 pour moins de charge

    return () => clearInterval(interval);
  }, [isInitialized, hotelId, rooms.length, housekeeperNames.length]);

  // Charger les données de la session
  const loadSessionData = async () => {
    try {
      const session = await HotelSessionService.getSession();
      if (session) {
        setHousekeeperNames(session.housekeeper_names || []);
        setRooms(session.room_data || []);
        setIsDistributed(false); // Toujours faux car is_distributed n'existe plus
        
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
          distributed: false,
          hotelId: sessionHotelId
        });
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
      // Créer automatiquement les femmes de chambre dans la base de données
      syncHousekeepersToDatabase();
    }
  }, [housekeeperNames, isInitialized]);

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

      // Créer les nouvelles femmes de chambre avec des codes d'accès temporaires
      for (const name of newNames) {
        // Générer un code d'accès temporaire basique
        const tempCode = `TEMP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        
        await supabase
          .from('housekeepers')
          .insert({
            hotel_id: hotelId,
            name: name,
            user_id: user.id,
            is_active: true,
            access_code: tempCode
          });
      }

      if (newNames.length > 0) {
        console.log(`✅ ${newNames.length} nouvelles femmes de chambre créées dans la base`);
        // Rafraîchir la liste après création
        await refreshHousekeepers();
      }
    } catch (error) {
      console.error('❌ Erreur synchronisation femmes de chambre:', error);
    }
  };

  useEffect(() => {
    if (isInitialized && rooms.length > 0) {
      HotelSessionService.updateRoomData(rooms);
    }
  }, [rooms, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      if (isDistributed) {
        HotelSessionService.markAsDistributed();
        // DÉSACTIVÉ: Génération automatique des codes d'accès
        // generateAccessCodesForAssignedHousekeepers();
      }
      console.log("Session - isDistributed sauvegardé:", isDistributed);
    }
  }, [isDistributed, isInitialized]);

  // DÉSACTIVÉ: Vérification périodique automatique des codes manquants
  // useEffect(() => {
  //   if (!isInitialized || !hotelId || housekeeperNames.length === 0) return;

  //   const checkMissingCodes = async () => {
  //     try {
  //       const { supabase } = await import('@/integrations/supabase/client');
        
  //       const { data: existingHousekeepers } = await supabase
  //         .from('housekeepers')
  //         .select('name')
  //         .eq('hotel_id', hotelId)
  //         .eq('is_active', true);

  //       const existingNames = existingHousekeepers?.map(h => h.name) || [];
  //       const missingHousekeepers = housekeeperNames.filter(name => !existingNames.includes(name));
        
  //       if (missingHousekeepers.length > 0) {
  //         console.log('🔍 Femmes de chambre sans codes détectées:', missingHousekeepers);
  //         generateAccessCodesForAssignedHousekeepers(true); // Force la génération
  //       }
  //     } catch (error) {
  //       console.error('❌ Erreur vérification codes manquants:', error);
  //     }
  //   };

  //   // Vérifier immédiatement puis toutes les 30 secondes
  //   checkMissingCodes();
  //   const interval = setInterval(checkMissingCodes, 30000);
    
  //   return () => clearInterval(interval);
  // }, [isInitialized, hotelId, housekeeperNames]);

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
        
        // DÉSACTIVÉ: Génération automatique des codes
        // const { CodeGenerationService } = await import('@/services/codeGenerationService');
        // const generated = await CodeGenerationService.ensureCodesForHotel(currentHotelId, newHousekeepers);
        
        console.log('⚠️ Génération automatique désactivée - création manuelle requise');

        // DÉSACTIVÉ: Rafraîchir les femmes de chambre automatiquement
        // await refreshHousekeepers();

        // DÉSACTIVÉ: Notification de succès automatique
        // const { toast } = await import('@/hooks/use-toast');
        // toast({
        //   title: "Codes d'accès générés",
        //   description: `${newHousekeepers.length} code(s) d'accès généré(s) automatiquement pour les femmes de chambre.`
        // });
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

    // Ajouter notification pour l'admin - FORMAT AMÉLIORÉ (avec sécurité)
    if (housekeeperName && hotelId && addNotificationFn) {
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
      if (addNotificationFn) {
        await addNotificationFn(notification);
      }
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

  // DÉSACTIVÉ: Vérification périodique automatique des codes d'accès
  // useEffect(() => {
  //   const generateAccessCodesForAssignedHousekeepers = async () => {
  //     if (!hotelId) return;
      
  //     try {
  //       console.log('🔧 Vérification des codes d\'accès manquants...');
        
  //       // Forcer la génération de codes pour toutes les femmes de chambre manquantes
  //       const { CodeGenerationService } = await import('@/services/codeGenerationService');
  //       const results = await CodeGenerationService.forceGenerateAllMissingCodes();
        
  //       if (results.generated > 0) {
  //         console.log(`✅ ${results.generated} code(s) d'accès généré(s) automatiquement`);
  //       }
        
  //       if (results.errors.length > 0) {
  //         console.warn('⚠️ Erreurs lors de la génération automatique:', results.errors);
  //       }
  //     } catch (error) {
  //       console.error('❌ Erreur génération codes automatique:', error);
  //     }
  //   };
    
  //   // Vérifier immédiatement
  //   generateAccessCodesForAssignedHousekeepers();
    
  //   // Puis vérifier toutes les 2 minutes
  //   const interval = setInterval(generateAccessCodesForAssignedHousekeepers, 120000);
    
  //   return () => clearInterval(interval);
  // }, [hotelId]);

  // Rafraîchir la liste des housekeepers depuis la BD - AUTOMATIQUE toutes les 30s
  const refreshHousekeepers = useCallback(async () => {
    const currentHotelId = hotelId || localStorage.getItem('selectedHotelId');
    if (!currentHotelId) return;
    
    try {
      console.log('🔄 Rafraîchissement des housekeepers...');
      const { data, error } = await supabase
        .from('housekeepers')
        .select('id, name, access_code, user_id')
        .eq('hotel_id', currentHotelId)
        .eq('is_active', true);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setHousekeepers(data);
        console.log(`✅ ${data.length} housekeepers rafraîchis depuis la BD`);
        
        // Mettre à jour aussi housekeeperNames
        const allNames = data.map(h => h.name);
        setHousekeeperNames(prevNames => {
          const combined = [...new Set([...prevNames, ...allNames])];
          return combined;
        });
        
        // Sauvegarder immédiatement dans la session
        const sessionData = await HotelSessionService.getSession();
        if (sessionData?.hotel_id) {
          const { SessionPersistenceService } = await import('@/services/sessionPersistenceService');
          SessionPersistenceService.updateSessionData({
            housekeeper_assignments: data.map(hk => ({
              housekeeper_id: hk.id,
              housekeeper_name: hk.name,
              access_code: hk.access_code
            }))
          });
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors du rafraîchissement des housekeepers:', error);
    }
  }, [hotelId]);

  // Rafraîchissement automatique des housekeepers toutes les 30 secondes
  useEffect(() => {
    if (!hotelId) return;
    
    refreshHousekeepers(); // Appel initial
    
    const refreshInterval = setInterval(() => {
      refreshHousekeepers();
    }, 30000); // 30 secondes
    
    return () => clearInterval(refreshInterval);
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