import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, Clock, Home, LogOut, Building2, MapPin, AlertCircle, Wifi, WifiOff, Sparkles, ScrollText, X } from 'lucide-react';
import { HousekeeperAuthService } from '@/services/housekeeperAuthService';
import { IncidentReportDialogSimple } from './incident/IncidentReportDialogSimple';
import { Package } from 'lucide-react';
import { LinenQuickInventory } from './linen/LinenQuickInventory';
import { RoomCardEnhanced } from './housekeeper/RoomCardEnhanced';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';

interface Room {
  id: string;
  room_number: string;
  status: string;
  notes?: string;
  cleaning_priority: number;
  cleaning_type?: string;
}

interface ActivityLogEntry {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export const HousekeeperWorkSimple: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [hotel, setHotel] = useState<any>(null);
  const [housekeeper, setHousekeeper] = useState<any>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [roomNotes, setRoomNotes] = useState<Record<string, string>>({});
  const [showGeneralIncidentDialog, setShowGeneralIncidentDialog] = useState(false);
  const [showLinenInventory, setShowLinenInventory] = useState(false);
  const [activeLinenTask, setActiveLinenTask] = useState<string | null>(null);
  const [newRoomsCount, setNewRoomsCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [activeTab, setActiveTab] = useState<'rooms' | 'inventory'>('rooms');
  
  // Journal d'activité local
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [showActivityLog, setShowActivityLog] = useState(false);

  // Fonction pour ajouter au journal d'activité
  const addToActivityLog = useCallback((message: string, type: ActivityLogEntry['type'] = 'info') => {
    setActivityLog(prev => [{
      id: Date.now().toString(),
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      message,
      type
    }, ...prev].slice(0, 50)); // Garder max 50 entrées
  }, []);

  // Essayer d'abord les query params, puis le localStorage
  const accessCodeFromUrl = searchParams.get('access_code');
  const hotelIdFromUrl = searchParams.get('hotel');
  const housekeeperNameFromUrl = searchParams.get('name');

  // Récupérer depuis localStorage avec fallbacks multiples
  const housekeeperData = localStorage.getItem('housekeeper') ? JSON.parse(localStorage.getItem('housekeeper')!) : null;
  const housekeeperProfile = localStorage.getItem('housekeeperProfile') ? JSON.parse(localStorage.getItem('housekeeperProfile')!) : null;
  
  const isAuthenticatedHousekeeper = housekeeperProfile?.isAuthenticated;
  const accessCode = isAuthenticatedHousekeeper 
    ? null 
    : (accessCodeFromUrl || housekeeperData?.accessCode);
  
  // Récupération robuste du hotelId avec plusieurs fallbacks
  const getHotelId = (): string | null => {
    // 1. URL en priorité
    if (hotelIdFromUrl && hotelIdFromUrl.length >= 30) return hotelIdFromUrl;
    // 2. localStorage standard
    const storedId = localStorage.getItem('selectedHotelId');
    if (storedId && storedId.length >= 30) return storedId;
    // 3. Clé de backup
    const backupId = localStorage.getItem('lastSelectedHotelId');
    if (backupId && backupId.length >= 30) return backupId;
    // 4. currentHotelId legacy
    const legacyId = localStorage.getItem('currentHotelId');
    if (legacyId && legacyId.length >= 30) return legacyId;
    // 5. Dans le profil
    if (housekeeperProfile?.currentHotelId && housekeeperProfile.currentHotelId.length >= 30) {
      return housekeeperProfile.currentHotelId;
    }
    return null;
  };
  
  const hotelId = getHotelId();
  const housekeeperName = housekeeperNameFromUrl || housekeeperProfile?.name || housekeeperData?.name || 'Femme de chambre';

  useEffect(() => {
    // Vérification renforcée de l'hotelId
    const storedHotelId = localStorage.getItem('selectedHotelId');
    
    console.log('🔍 Vérification hotelId:', {
      fromUrl: hotelIdFromUrl,
      fromStorage: storedHotelId,
      final: hotelId,
      isAuthenticatedHousekeeper
    });

    // Validation stricte du hotelId (doit être un UUID valide)
    if (hotelId && hotelId.length < 30) {
      console.error('❌ HotelId invalide:', hotelId);
      toast({
        title: "Erreur de session",
        description: "Hotel ID introuvable. Veuillez resélectionner votre hôtel.",
        variant: "destructive"
      });
      navigate('/housekeeper/hotels');
      return;
    }

    // Une femme de chambre authentifiée n'a pas besoin de code d'accès
    if ((accessCode && hotelId) || (isAuthenticatedHousekeeper && hotelId)) {
      loadWorkData();
    } else if (!accessCode && !isAuthenticatedHousekeeper) {
      navigate('/housekeeper/auth');
    }
  }, [accessCode, hotelId, isAuthenticatedHousekeeper]);

  // Normaliser un nom pour comparaison (trim + lowercase)
  const normalizeName = (name: string | null | undefined): string => {
    return (name || '').trim().toLowerCase();
  };

  // Gestion intelligente des mises à jour temps réel
  const handleRealtimeUpdate = useCallback((table: string, payload: any) => {
    console.log(`📡 Mise à jour temps réel ${table}:`, payload);
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    if (table === 'assignments') {
      if (eventType === 'INSERT') {
        // Identifiants possibles du housekeeper actuel
        const possibleIds = [
          housekeeperProfile?.id,
          housekeeper?.id,
          housekeeper?.access_code,
          housekeeper?.user_id
        ].filter(Boolean);
        
        // Normaliser les noms pour comparaison
        const normalizedMyName = normalizeName(housekeeperName);
        const normalizedRecordName = normalizeName(newRecord.housekeeper_name);
        
        // Vérifier par ID OU par nom normalisé
        const isForMe = possibleIds.includes(newRecord.housekeeper_id) || 
                        normalizedRecordName === normalizedMyName;
        
        // Vérifier que c'est pour le bon hôtel
        const isCorrectHotel = newRecord.hotel_id === hotelId;
        
        console.log('🔍 Vérification assignation:', {
          possibleIds,
          recordHousekeeperId: newRecord.housekeeper_id,
          recordHousekeeperName: newRecord.housekeeper_name,
          normalizedRecordName,
          housekeeperName,
          normalizedMyName,
          isForMe,
          isCorrectHotel
        });
        
        if (isForMe && isCorrectHotel) {
          console.log('🆕 Nouvelle assignation reçue pour moi! Rechargement complet...');
          
          // Recharger TOUTES les données pour être sûr de la synchronisation
          loadWorkData();
          
          // Ajouter au journal d'activité
          addToActivityLog('🆕 Nouvelle chambre assignée', 'info');
          
          // Incrémenter le compteur
          setNewRoomsCount(prev => prev + 1);
          setTimeout(() => setNewRoomsCount(0), 5000);
        }
      } else if (eventType === 'UPDATE') {
        // Mise à jour d'une assignation existante
        setAssignments(prev => prev.map(a => 
          a.id === newRecord.id ? { ...a, ...newRecord } : a
        ));
      } else if (eventType === 'DELETE') {
        // Assignation supprimée
        setAssignments(prev => prev.filter(a => a.id !== oldRecord.id));
        setRooms(prev => prev.filter(r => r.id !== oldRecord.room_id));
      }
    }
    
    if (table === 'rooms') {
      if (eventType === 'UPDATE' || eventType === 'INSERT') {
        // Vérifier si une chambre devient ready-to-clean
        if (newRecord.status === 'ready-to-clean' && oldRecord?.status !== 'ready-to-clean') {
          console.log('🚪 Nouvelle chambre disponible:', newRecord.room_number);
          addToActivityLog(`🚪 Chambre ${newRecord.room_number} disponible - Client sorti`, 'info');
          
          // Ajouter à la liste des chambres disponibles
          setAvailableRooms(prev => {
            if (!prev.find(r => r.id === newRecord.id)) {
              return [...prev, newRecord];
            }
            return prev;
          });
        }
        
        // Mettre à jour le statut de la chambre localement
        setRooms(prev => {
          const exists = prev.find(r => r.id === newRecord.id);
          if (exists) {
            // Log cleaning_type changes (sans notification)
            if (newRecord.cleaning_type && newRecord.cleaning_type !== exists.cleaning_type) {
              console.log('🔄 Type de nettoyage mis à jour:', {
                room: newRecord.room_number,
                oldType: exists.cleaning_type,
                newType: newRecord.cleaning_type
              });
            }
            
            return prev.map(r => r.id === newRecord.id ? { ...r, ...newRecord } : r);
          } else if (eventType === 'INSERT') {
            return [...prev, newRecord];
          }
          return prev;
        });
      } else if (eventType === 'DELETE') {
        setRooms(prev => prev.filter(r => r.id !== oldRecord.id));
      }
    }
  }, [hotelId, housekeeperName, isAuthenticatedHousekeeper, housekeeperProfile, housekeeper, addToActivityLog]);

  // Synchronisation en temps réel des assignations et chambres
  const { isConnected } = useRealtimeSync({
    hotelId: hotelId || undefined,
    tables: ['assignments', 'rooms'],
    onUpdate: handleRealtimeUpdate
  });

  // Polling de secours si le realtime échoue (toutes les 15 secondes)
  // NE PAS effacer les données existantes pendant le polling
  useEffect(() => {
    const pollInterval = setInterval(() => {
      // Vérifier que hotelId existe toujours
      const currentHotelId = getHotelId();
      if (!currentHotelId) {
        console.warn('⚠️ HotelId disparu pendant le polling!');
        // Tenter de récupérer depuis le backup
        const backupId = localStorage.getItem('lastSelectedHotelId');
        if (backupId && backupId.length >= 30) {
          console.log('🔄 Récupération hotelId depuis backup');
          localStorage.setItem('selectedHotelId', backupId);
        }
        return;
      }
      
      if (!isConnected && currentHotelId) {
        console.log('⏰ Polling de secours - realtime non connecté');
        loadWorkData();
      }
    }, 15000); // 15 secondes

    return () => clearInterval(pollInterval);
  }, [isConnected]);

  const loadWorkData = async () => {
    try {
      setIsRefreshing(true);
      
      // Charger immédiatement depuis le cache pour affichage rapide
      const cachedKey = `assignments_${hotelId}_${housekeeperProfile?.id || 'temp'}`;
      const cachedData = localStorage.getItem(cachedKey);
      if (cachedData && rooms.length === 0) {
        try {
          const { assignments: cachedAssignments, rooms: cachedRooms, timestamp } = JSON.parse(cachedData);
          // Utiliser le cache si moins de 12h
          if (Date.now() - timestamp < 12 * 60 * 60 * 1000) {
            console.log('📦 Chargement rapide depuis le cache');
            setAssignments(cachedAssignments || []);
            setRooms(cachedRooms || []);
          }
        } catch (e) {
          console.error('Erreur parsing cache initial:', e);
        }
      }
      
      let authResult: any;
      
      // Si c'est une femme de chambre authentifiée (avec profil)
      if (isAuthenticatedHousekeeper && housekeeperProfile) {
        // Récupérer l'hôtel
        const { data: hotelData, error: hotelError } = await supabase
          .from('hotels')
          .select('*')
          .eq('id', hotelId)
          .single();

        if (hotelError || !hotelData) {
          toast({
            title: "Erreur",
            description: "Hôtel non trouvé",
            variant: "destructive"
          });
          navigate('/housekeeper/hotels');
          return;
        }

        authResult = {
          success: true,
          hotel: hotelData,
          user: {
            id: housekeeperProfile.id,
            name: housekeeperProfile.name,
            email: housekeeperProfile.email
          }
        };
      } else {
        // Vérifier l'authentification avec le code (femmes de chambre temporaires)
        authResult = await HousekeeperAuthService.authenticateWithFullCode(accessCode!);
        
        if (!authResult.success) {
          toast({
            title: "Code invalide",
            description: authResult.error || "Code d'accès non valide",
            variant: "destructive"
          });
          navigate('/housekeeper/login');
          return;
        }
      }

      setHotel(authResult.hotel);
      setHousekeeper(authResult.user);

      // Charger les assignations de cette femme de chambre
      // Utiliser l'ID du profil pour les femmes de chambre authentifiées
      const housekeeperId = isAuthenticatedHousekeeper 
        ? housekeeperProfile.id 
        : (authResult.user?.id || authResult.user?.access_code);

      console.log('🔍 Recherche assignations pour:', {
        housekeeperId,
        hotelId,
        isAuthenticated: isAuthenticatedHousekeeper,
        profileId: housekeeperProfile?.id
      });

      // Récupérer l'ID du housekeeper dans la table housekeepers si authentifié
      let housekeeperTableId = housekeeperId;
      if (isAuthenticatedHousekeeper && housekeeperId) {
        const { data: hkData } = await supabase
          .from('housekeepers')
          .select('id')
          .eq('hotel_id', hotelId)
          .eq('user_id', housekeeperId)
          .single();
        
        if (hkData) {
          housekeeperTableId = hkData.id;
          console.log('🔗 ID housekeeper trouvé:', housekeeperTableId);
        }
      }

      // Charger les assignations depuis Supabase - chercher par TOUS les identifiants possibles
      // Construire une liste complète d'identifiants à rechercher
      const possibleIds = [
        housekeeperId,
        housekeeperTableId,
        housekeeperProfile?.id
      ].filter(Boolean);

      console.log('🔍 Recherche avec identifiants possibles:', possibleIds);

      // Construire le filtre OR pour tous les IDs possibles
      let orFilter = possibleIds.map(id => `housekeeper_id.eq.${id}`).join(',');
      
      // Ajouter également le filtre par nom
      if (housekeeperName) {
        orFilter += `,housekeeper_name.eq.${housekeeperName}`;
      }

      // Récupérer toutes les assignations actives (sans filtre de date)
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select(`
          *,
          rooms (
            id,
            room_number,
            status,
            notes,
            cleaning_priority,
            cleaning_type
          )
        `)
        .eq('hotel_id', hotelId)
        .or(orFilter)
        .in('status', ['assigned', 'in_progress', 'completed'])
        .order('created_at', { ascending: false });

      console.log('📋 Assignations trouvées:', assignmentsData);
      console.log('❌ Erreur assignations (le cas échéant):', assignmentsError);

      if (assignmentsError) {
        console.error('Erreur chargement assignations:', assignmentsError);
        // Essayer de charger depuis le cache localStorage
        const cachedData = localStorage.getItem(`assignments_${hotelId}_${housekeeperId}`);
        if (cachedData) {
          try {
            const { assignments: cachedAssignments, rooms: cachedRooms, timestamp } = JSON.parse(cachedData);
            // Utiliser le cache si moins de 12h
            if (Date.now() - timestamp < 12 * 60 * 60 * 1000) {
              console.log('📦 Utilisation du cache localStorage pour les assignations');
              setAssignments(cachedAssignments || []);
              setRooms(cachedRooms || []);
              return;
            }
          } catch (e) {
            console.error('Erreur parsing cache:', e);
          }
        }
        // Fallback: afficher toutes les chambres en attente
        loadAllPendingRooms();
      } else {
        setAssignments(assignmentsData || []);
        const roomsList = (assignmentsData || [])
          .map(a => a.rooms)
          .filter(Boolean);
        
        // Dédoublonner par room_id pour éviter les doublons
        const uniqueRooms = roomsList.reduce((acc: typeof roomsList, room) => {
          if (!acc.find(r => r.id === room.id)) {
            acc.push(room);
          }
          return acc;
        }, []);
        
        setRooms(uniqueRooms);
        
        // Persister en localStorage pour la reconnexion
        try {
          localStorage.setItem(`assignments_${hotelId}_${housekeeperId}`, JSON.stringify({
            assignments: assignmentsData,
            rooms: uniqueRooms,
            timestamp: Date.now()
          }));
          console.log('💾 Assignations sauvegardées en cache');
        } catch (e) {
          console.error('Erreur sauvegarde cache:', e);
        }
      }

      // Charger les chambres disponibles (ready-to-clean non assignées)
      const { data: availableRoomsData } = await supabase
        .from('rooms')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('status', 'ready-to-clean')
        .order('room_number');
      
      if (availableRoomsData) {
        // Filtrer celles qui ne sont pas déjà assignées
        const assignedRoomIds = (assignmentsData || []).map(a => a.room_id);
        const unassignedAvailable = availableRoomsData.filter(
          room => !assignedRoomIds.includes(room.id)
        );
        setAvailableRooms(unassignedAvailable);
      }

      // Charger les tâches d'inventaire du linge
      const { data: linenTask } = await supabase
        .from('linen_inventory_tasks')
        .select('*')
        .eq('assigned_to', housekeeperId)
        .in('status', ['pending', 'in_progress'])
        .order('task_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (linenTask) {
        setActiveLinenTask(linenTask.id);
      }

    } catch (error) {
      console.error('Erreur chargement données travail:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données de travail",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };


  const loadAllPendingRooms = async () => {
    // Fallback: charger toutes les chambres à nettoyer
    console.log('🔄 Fallback: Chargement de toutes les chambres à nettoyer pour hotel:', hotelId);
    const { data: roomsData, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('hotel_id', hotelId)
      .in('status', ['dirty', 'to_clean'])
      .order('room_number');

    console.log('🏠 Chambres en fallback:', roomsData);
    if (error) {
      console.error('❌ Erreur fallback chambres:', error);
    }

    if (!error && roomsData) {
      setRooms(roomsData);
      
      // Si aucune chambre trouvée, afficher un message informatif
      if (roomsData.length === 0) {
        toast({
          title: "Aucune chambre à nettoyer",
          description: "Toutes les chambres sont propres ou aucune chambre n'est configurée pour cet établissement.",
          variant: "default"
        });
      }
    } else if (error) {
      console.error('Erreur chargement chambres:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les chambres",
        variant: "destructive"
      });
    }
  };

  const updateRoomStatus = async (roomId: string, newStatus: string) => {
    const startTime = Date.now();
    
    try {
      const room = rooms.find(r => r.id === roomId);
      
      // Mettre à jour le statut de la chambre
      const updateData: any = { 
        status: newStatus,
        last_cleaned_at: newStatus === 'clean' ? new Date().toISOString() : null
      };
      
      // Ajouter les notes si disponibles
      const hasComment = roomNotes[roomId] && roomNotes[roomId].trim().length > 0;
      if (hasComment) {
        updateData.notes = roomNotes[roomId];
      }
      
      const { error: roomError } = await supabase
        .from('rooms')
        .update(updateData)
        .eq('id', roomId);

      if (roomError) {
        toast({
          title: "Erreur",
          description: "Impossible de mettre à jour le statut",
          variant: "destructive"
        });
        return;
      }
      
      // Notification uniquement pour chambre terminée
      if (newStatus === 'clean') {
        toast({
          title: "✅ Chambre terminée",
          description: `Chambre ${room?.room_number} marquée comme propre`,
          duration: 3000
        });
      }
      
      // Notification séparée si un commentaire a été ajouté
      if (hasComment) {
        toast({
          title: "💬 Commentaire ajouté",
          description: `Commentaire enregistré pour la chambre ${room?.room_number}`,
          duration: 3000
        });
      }

      // Calculer la durée si la chambre est terminée
      let duration = 0;
      const assignment = assignments.find(a => a.rooms?.id === roomId);
      
      if (assignment && newStatus === 'clean') {
        const startedAt = new Date(assignment.started_at || assignment.assigned_at).getTime();
        duration = Math.round((Date.now() - startedAt) / 60000); // en minutes
      }

      // Mettre à jour l'assignation si elle existe
      if (assignment) {
        const updateData: any = {
          status: newStatus === 'clean' ? 'completed' : 'in_progress',
        };
        
        if (newStatus === 'in_progress') {
          updateData.started_at = new Date().toISOString();
        } else if (newStatus === 'clean') {
          updateData.completed_at = new Date().toISOString();
          updateData.actual_duration = duration;
        }

        const { error: assignmentError } = await supabase
          .from('assignments')
          .update(updateData)
          .eq('id', assignment.id);

        if (assignmentError) {
          console.error('Erreur mise à jour assignation:', assignmentError);
        }
      }

      // Si la chambre est terminée, ajouter au journal
      if (newStatus === 'clean') {
        const roomNumber = rooms.find(r => r.id === roomId)?.room_number || roomId;
        addToActivityLog(`✅ Chambre ${roomNumber} terminée`, 'success');
      } else if (newStatus === 'in_progress') {
        const roomNumber = rooms.find(r => r.id === roomId)?.room_number || roomId;
        addToActivityLog(`🔄 Chambre ${roomNumber} en cours`, 'info');
      }

      // Mettre à jour l'état local - garder la chambre dans la liste même si propre
      setRooms(prev => {
        const updatedRooms = prev.map(room => 
          room.id === roomId 
            ? { ...room, status: newStatus }
            : room
        );
        
        // Mettre à jour le cache avec les chambres mises à jour (ne pas supprimer les chambres propres)
        const cachedKey = `assignments_${hotelId}_${housekeeperProfile?.id || 'temp'}`;
        try {
          const updatedAssignments = assignments.map(a => 
            a.rooms?.id === roomId 
              ? { ...a, status: newStatus === 'clean' ? 'completed' : 'in_progress', rooms: { ...a.rooms, status: newStatus } }
              : a
          );
          localStorage.setItem(cachedKey, JSON.stringify({
            assignments: updatedAssignments,
            rooms: updatedRooms,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.error('Erreur mise à jour cache:', e);
        }
        
        return updatedRooms;
      });

      // Log d'activité
      await supabase
        .from('activities')
        .insert({
          hotel_id: hotelId,
          entity_type: 'room',
          entity_id: roomId,
          activity_type: 'room_status_update',
          actor_name: housekeeperName,
          actor_type: 'housekeeper',
          details: {
            room_number: rooms.find(r => r.id === roomId)?.room_number,
            new_status: newStatus,
            access_code: accessCode
          }
        });

      if (newStatus !== 'clean') {
        // Log entry already added above
      }

    } catch (error) {
      console.error('Erreur mise à jour statut:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue",
        variant: "destructive"
      });
    }
  };

  const handleLogout = () => {
    // Nettoyer le localStorage - MAIS garder le cache des assignations pour la persistance
    localStorage.removeItem('housekeeper');
    localStorage.removeItem('housekeeperProfile');
    localStorage.removeItem('selectedHotelId');
    localStorage.removeItem('selectedHotelName');
    localStorage.removeItem('selectedHotelCode');
    
    // NE PAS nettoyer le cache des assignations - le garder pour la prochaine connexion
    // const cacheKey = `assignments_${hotelId}_${housekeeperProfile?.id || 'temp'}`;
    // localStorage.removeItem(cacheKey);
    
    // Rediriger vers la page appropriée
    if (isAuthenticatedHousekeeper) {
      navigate('/housekeeper/hotels');
    } else {
      navigate('/housekeeper/login');
    }
  };

  const handleRefresh = async () => {
    console.log('🔄 Rafraîchissement manuel déclenché');
    await loadWorkData();
  };

  const takeAvailableRoom = async (roomId: string) => {
    try {
      // Déterminer l'ID du housekeeper
      const housekeeperId = isAuthenticatedHousekeeper 
        ? housekeeperProfile.id 
        : (housekeeper?.id || housekeeper?.access_code);
      
      // Créer une assignation
      const { error } = await supabase
        .from('assignments')
        .insert({
          hotel_id: hotelId,
          room_id: roomId,
          housekeeper_id: housekeeperId,
          housekeeper_name: housekeeperName,
          status: 'assigned'
        });
      
      if (error) throw error;
      
      // Mettre à jour le statut de la chambre à dirty
      await supabase
        .from('rooms')
        .update({ status: 'dirty' })
        .eq('id', roomId);
      
      // Retirer de la liste des chambres disponibles
      const room = availableRooms.find(r => r.id === roomId);
      setAvailableRooms(prev => prev.filter(r => r.id !== roomId));
      
      // Ajouter à mes chambres
      if (room) {
        setRooms(prev => [...prev, { ...room, status: 'dirty' }]);
      }
      
      toast({
        title: "✅ Chambre assignée",
        description: `Chambre ${room?.room_number} ajoutée à votre liste`,
        duration: 3000
      });
    } catch (error) {
      console.error('Erreur auto-assignation:', error);
      toast({
        title: "Erreur",
        description: "Impossible de prendre cette chambre",
        variant: "destructive"
      });
    }
  };

  const handleOpenLinenInventory = async () => {
    if (!hotelId) return;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const assignedToId = housekeeperProfile?.id || housekeeper?.id;
      
      if (!assignedToId) {
        toast({
          title: "Erreur",
          description: "Impossible d'identifier l'utilisateur",
          variant: "destructive"
        });
        return;
      }
      
      // Check if there's already a task for today
      const { data: existingTasks } = await supabase
        .from('linen_inventory_tasks')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('assigned_to', assignedToId)
        .eq('task_date', today)
        .maybeSingle();
      
      let taskId: string;
      
      if (existingTasks) {
        taskId = existingTasks.id;
      } else {
        // Create a new task
        const { data: newTask, error } = await supabase
          .from('linen_inventory_tasks')
          .insert({
            hotel_id: hotelId,
            assigned_to: assignedToId,
            assigned_by: assignedToId,
            task_date: today,
            status: 'pending'
          })
          .select()
          .single();
        
        if (error) throw error;
        taskId = newTask.id;
      }
      
      setActiveLinenTask(taskId);
      setShowLinenInventory(true);
    } catch (error) {
      console.error('Erreur création tâche inventaire:', error);
      toast({
        title: "Erreur",
        description: "Impossible de créer la tâche d'inventaire",
        variant: "destructive"
      });
    }
  };

  const unassignRoom = async (roomId: string, roomNumber: string) => {
    try {
      // Find assignment for this room
      const assignment = assignments.find(a => a.rooms?.id === roomId);
      if (!assignment) return;

      // Delete assignment
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', assignment.id);

      if (error) throw error;

      // Remove from local state
      setRooms(prev => prev.filter(r => r.id !== roomId));
      setAssignments(prev => prev.filter(a => a.id !== assignment.id));

      // Pas de notification pour désassignation
      console.log(`Chambre ${roomNumber} désassignée`);

    } catch (error) {
      console.error('Erreur désassignation:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de désassigner la chambre"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="p-6 text-center">
          <div className="animate-pulse">Chargement...</div>
        </Card>
      </div>
    );
  }

  const completedRooms = rooms.filter(r => r.status === 'clean').length;
  const totalRooms = rooms.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-3 sm:p-4 lg:p-6">
      {/* Journal d'activité (panneau latéral) */}
      {showActivityLog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
          <div className="bg-background w-80 max-w-full h-full shadow-xl flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <ScrollText className="h-5 w-5" />
                Journal d'activité
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setShowActivityLog(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {activityLog.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucune activité récente
                </p>
              ) : (
                <div className="space-y-2">
                  {activityLog.map(entry => (
                    <div 
                      key={entry.id}
                      className={`p-2 rounded-lg text-sm ${
                        entry.type === 'success' ? 'bg-green-50 border-green-200 border' :
                        entry.type === 'warning' ? 'bg-orange-50 border-orange-200 border' :
                        entry.type === 'error' ? 'bg-red-50 border-red-200 border' :
                        'bg-blue-50 border-blue-200 border'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span>{entry.message}</span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{entry.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Building2 className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-gray-800 truncate">
                {hotel?.name || localStorage.getItem('selectedHotelName') || 'Hôtel non identifié'}
              </h1>
               <p className="text-xs sm:text-base text-gray-600 flex items-center gap-2 truncate">
                 <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                 <span className="truncate">{hotel?.address || 'Adresse non spécifiée'}</span>
                 {isConnected ? (
                   <Badge variant="default" className="text-xs bg-green-500 ml-2">
                     <Wifi className="h-3 w-3 mr-1" />
                     Temps réel
                   </Badge>
                 ) : (
                   <Badge variant="outline" className="text-xs border-orange-500 text-orange-500 ml-2">
                     <WifiOff className="h-3 w-3 mr-1" />
                     Hors ligne
                   </Badge>
                 )}
               </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Bouton journal d'activité */}
            <Button
              onClick={() => setShowActivityLog(true)}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-primary relative"
              title="Journal d'activité"
            >
              <ScrollText className="h-4 w-4" />
              {activityLog.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                  {activityLog.length > 9 ? '9+' : activityLog.length}
                </span>
              )}
            </Button>
            <Button
              onClick={handleRefresh}
              variant="ghost"
              size="sm"
              disabled={isRefreshing}
              className="text-muted-foreground hover:text-primary"
              title="Actualiser les données"
            >
              <Clock className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleLogout}
              className="flex-1 sm:flex-initial"
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </div>

        {/* Indicateur de connexion et nouvelles chambres */}
        <div className="flex items-center gap-3 mb-4">
          <Badge 
            variant={isConnected ? "default" : "destructive"} 
            className="flex items-center gap-1.5"
          >
            {isConnected ? (
              <>
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <Wifi className="h-3 w-3" />
                <span className="hidden sm:inline">En direct</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <WifiOff className="h-3 w-3" />
                <span className="hidden sm:inline">Déconnecté</span>
              </>
            )}
          </Badge>
          
          {newRoomsCount > 0 && (
            <Badge 
              variant="secondary" 
              className="bg-blue-500 text-white animate-bounce inline-flex items-center gap-1"
            >
              +{newRoomsCount} nouvelle{newRoomsCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {/* Statistics Section */}
        <Card className="mb-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              📊 Mes statistiques
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-background/60 rounded-lg p-3">
                <div className="text-2xl font-bold text-primary">{assignments.length}</div>
                <div className="text-xs text-muted-foreground">Assignées</div>
              </div>
              <div className="bg-background/60 rounded-lg p-3">
                <div className="text-2xl font-bold text-orange-500">
                  {assignments.filter(a => a.status === 'in_progress').length}
                </div>
                <div className="text-xs text-muted-foreground">En cours</div>
              </div>
              <div className="bg-background/60 rounded-lg p-3">
                <div className="text-2xl font-bold text-green-500">
                  {assignments.filter(a => a.status === 'completed').length}
                </div>
                <div className="text-xs text-muted-foreground">Terminées</div>
              </div>
              <div className="bg-background/60 rounded-lg p-3">
                <div className="text-2xl font-bold text-blue-500">{availableRooms.length}</div>
                <div className="text-xs text-muted-foreground">Client sorti</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-4">
          <Button 
            variant={activeTab === 'rooms' ? 'default' : 'outline'}
            onClick={() => setActiveTab('rooms')}
            className="flex-1"
          >
            🛏️ Chambres ({rooms.length})
          </Button>
          <Button 
            variant={activeTab === 'inventory' ? 'default' : 'outline'}
            onClick={() => setActiveTab('inventory')}
            className="flex-1 relative"
          >
            📦 Inventaire
            {activeLinenTask && (
              <Badge className="ml-1 bg-red-500 text-white">1</Badge>
            )}
          </Button>
        </div>

         {/* Session Info */}
         <Card className="p-3 sm:p-4 bg-blue-50 border-blue-200">
           <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
             <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
               <div>
                 <p className="text-xs sm:text-sm font-medium text-blue-800">Connecté en tant que</p>
                 <p className="text-sm sm:text-base text-blue-600 truncate">{housekeeperName}</p>
               </div>
               {!isAuthenticatedHousekeeper && (
                 <div>
                   <p className="text-xs sm:text-sm font-medium text-blue-800">Code d'accès</p>
                   <p className="text-sm font-mono text-blue-600">{accessCode}</p>
                 </div>
               )}
             </div>
             <Badge variant="default" className="bg-green-100 text-green-800 whitespace-nowrap">
               <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
               Connecté
             </Badge>
           </div>
         </Card>
      </div>

      {/* Progress */}
      <Card className="mb-4 sm:mb-6">
        <CardContent className="pt-4 sm:pt-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg font-semibold">Progression</h3>
            <Badge variant="outline" className="text-sm sm:text-lg px-2 sm:px-3 py-1">
              {completedRooms} / {totalRooms}
            </Badge>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3">
            <div 
              className="bg-green-500 h-2 sm:h-3 rounded-full transition-all duration-300"
              style={{ width: `${totalRooms > 0 ? (completedRooms / totalRooms) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2">
            {completedRooms === totalRooms && totalRooms > 0 
              ? 'Toutes les chambres terminées !' 
              : `${totalRooms - completedRooms} chambres restantes`}
          </p>
        </CardContent>
      </Card>

      {/* Linen Inventory Section */}
      {activeTab === 'inventory' && (
        <>
          {showLinenInventory && activeLinenTask && hotelId ? (
            <LinenQuickInventory
              taskId={activeLinenTask}
              hotelId={hotelId}
              onClose={() => setShowLinenInventory(false)}
            />
          ) : (
            <Card className="mb-4 sm:mb-6">
              <CardContent className="pt-6 pb-6 text-center">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  Inventaire du linge
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Comptez le linge propre et sale de l'établissement
                </p>
                <Button 
                  onClick={handleOpenLinenInventory}
                  className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700"
                >
                  <Package className="h-4 w-4 mr-2" />
                  Démarrer l'inventaire
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Rooms Tab Content */}
      {activeTab === 'rooms' && (
        <>
          {/* Available Rooms Section */}
          {availableRooms.length > 0 && (
            <Card className="mb-4 sm:mb-6 border-blue-200 bg-blue-50/50">
              <CardHeader>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Badge variant="default" className="bg-blue-600">
                    {availableRooms.length}
                  </Badge>
                  Chambres prêtes à nettoyer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {availableRooms.map(room => (
                    <div
                      key={room.id}
                      className="p-3 sm:p-4 rounded-lg border-2 border-blue-300 bg-white"
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0 w-full sm:w-auto">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg sm:text-xl font-bold">Chambre {room.room_number}</span>
                            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 text-xs">
                              🚪 Client sorti
                            </Badge>
                            
                            {/* Badge type de nettoyage */}
                            {room.cleaning_type && (
                              <Badge variant={room.cleaning_type === 'full' ? 'default' : 'secondary'} className="text-xs">
                                <Sparkles className="h-3 w-3 mr-1" />
                                {room.cleaning_type === 'full' ? 'À blanc' : 'Recouche'}
                              </Badge>
                            )}
                          </div>
                          {room.notes && (
                            <p className="text-xs sm:text-sm text-muted-foreground mt-1 break-words">
                              📝 {room.notes}
                            </p>
                          )}
                        </div>
                        
                        <Button 
                          onClick={() => takeAvailableRoom(room.id)}
                          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
                          size="sm"
                        >
                          Prendre cette chambre
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Room List */}
      {activeTab === 'rooms' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Mes chambres assignées</CardTitle>
          </CardHeader>
          <CardContent>
          {rooms.length === 0 ? (
            <div className="text-center py-8">
              <Home className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-2">
                Aucune chambre à nettoyer
              </h3>
              <p className="text-xs sm:text-base text-gray-500 mb-4 px-4">
                {isLoading 
                  ? "Chargement des chambres..." 
                  : "Toutes les chambres sont propres ou aucune chambre n'est configurée pour cet établissement."}
              </p>
              <p className="text-xs sm:text-sm text-gray-400 px-4">
                L'administrateur doit créer des chambres ou vous assigner des chambres à nettoyer.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {rooms.map(room => (
                <RoomCardEnhanced
                  key={room.id}
                  room={room}
                  hotelId={hotelId!}
                  onUpdateStatus={updateRoomStatus}
                  onUnassign={unassignRoom}
                />
              ))}
            </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Floating Linen Inventory Button */}
      <div className="fixed bottom-24 right-6 z-50">
        <Button
          size="lg"
          className="rounded-full shadow-lg bg-blue-500 hover:bg-blue-600 text-white h-14 w-14 sm:h-auto sm:w-auto sm:px-6"
          onClick={handleOpenLinenInventory}
        >
          <Package className="h-6 w-6 sm:mr-2" />
          <span className="hidden sm:inline">Inventaire linge</span>
        </Button>
      </div>

      {/* Floating Incident Report Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          size="lg"
          className="rounded-full shadow-lg bg-red-500 hover:bg-red-600 text-white h-14 w-14 sm:h-auto sm:w-auto sm:px-6"
          onClick={() => setShowGeneralIncidentDialog(true)}
        >
          <AlertCircle className="h-6 w-6 sm:mr-2" />
          <span className="hidden sm:inline">Signaler un incident</span>
        </Button>
      </div>

      {/* General Incident Dialog */}
      {showGeneralIncidentDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Signaler un incident</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowGeneralIncidentDialog(false)}
              >
                ✕
              </Button>
            </div>
            <div className="p-4">
              <IncidentReportDialogSimple 
                hotelId={hotelId!} 
                userType="housekeeper"
              />
            </div>
          </div>
        </div>
      )}

      {/* Linen Quick Inventory */}
      {showLinenInventory && activeLinenTask && hotelId && (
        <LinenQuickInventory
          taskId={activeLinenTask}
          hotelId={hotelId}
          onClose={() => {
            setShowLinenInventory(false);
            setActiveLinenTask(null);
          }}
        />
      )}
    </div>
  );
};