import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, Clock, Home, LogOut, Building2, MapPin, User, AlertCircle, Wifi, WifiOff, Smartphone, X, Sparkles } from 'lucide-react';
import { HousekeeperAuthService } from '@/services/housekeeperAuthService';
import { GamificationService } from '@/services/gamificationService';
import { BadgeUnlockNotification } from './gamification/BadgeUnlockNotification';
import { LevelUpNotification } from './gamification/LevelUpNotification';
import { LevelProgressBar } from './gamification/LevelProgressBar';
import { IncidentReportDialogSimple } from './incident/IncidentReportDialogSimple';
import { Textarea } from './ui/textarea';
import { AlertTriangle, MessageSquare, Package } from 'lucide-react';
import { LinenInventorySection } from './linen/LinenInventorySection';
import { LinenQuickInventory } from './linen/LinenQuickInventory';
import { RoomCardEnhanced } from './housekeeper/RoomCardEnhanced';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { useNotificationSound } from '@/hooks/use-notification-sound';

interface Room {
  id: string;
  room_number: string;
  status: string;
  notes?: string;
  cleaning_priority: number;
  cleaning_type?: string;
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
  const [levelData, setLevelData] = useState<any>(null);
  const [newBadges, setNewBadges] = useState<any[]>([]);
  const [levelUpData, setLevelUpData] = useState<number | null>(null);
  const [roomNotes, setRoomNotes] = useState<Record<string, string>>({});
  const [showGeneralIncidentDialog, setShowGeneralIncidentDialog] = useState(false);
  const [showLinenInventory, setShowLinenInventory] = useState(false);
  const [activeLinenTask, setActiveLinenTask] = useState<string | null>(null);
  const [newRoomsCount, setNewRoomsCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [swipingCard, setSwipingCard] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<Record<string, number>>({});
  const touchStartX = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);
  const [activeTab, setActiveTab] = useState<'rooms' | 'inventory'>('rooms');
  
  const { playInfo } = useNotificationSound();

  // Essayer d'abord les query params, puis le localStorage
  const accessCodeFromUrl = searchParams.get('access_code');
  const hotelIdFromUrl = searchParams.get('hotel');
  const housekeeperNameFromUrl = searchParams.get('name');

  // Récupérer depuis localStorage
  const housekeeperData = localStorage.getItem('housekeeper') ? JSON.parse(localStorage.getItem('housekeeper')!) : null;
  const housekeeperProfile = localStorage.getItem('housekeeperProfile') ? JSON.parse(localStorage.getItem('housekeeperProfile')!) : null;
  
   const isAuthenticatedHousekeeper = housekeeperProfile?.isAuthenticated;
   const accessCode = isAuthenticatedHousekeeper 
     ? null 
     : (accessCodeFromUrl || housekeeperData?.accessCode);
   const hotelId = hotelIdFromUrl || localStorage.getItem('selectedHotelId');
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
          
          // Notification visuelle
          toast({
            title: "🆕 Nouvelle chambre",
            description: `Une nouvelle chambre vous a été assignée`,
            duration: 4000
          });
          
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
          toast({
            title: "🚪 Chambre disponible",
            description: `Chambre ${newRecord.room_number} - Client sorti`,
            duration: 5000
          });
          
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
  }, [hotelId, housekeeperName, isAuthenticatedHousekeeper, housekeeperProfile, housekeeper, toast, playInfo]);

  // Synchronisation en temps réel des assignations et chambres
  const { isConnected } = useRealtimeSync({
    hotelId: hotelId || undefined,
    tables: ['assignments', 'rooms'],
    onUpdate: handleRealtimeUpdate
  });

  // Polling de secours si le realtime échoue (toutes les 10 secondes au lieu de 30)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      if (!isConnected && hotelId) {
        console.log('⏰ Polling de secours - realtime non connecté');
        loadWorkData();
      }
    }, 10000); // 10 secondes au lieu de 30

    return () => clearInterval(pollInterval);
  }, [isConnected, hotelId]);

  const loadWorkData = async () => {
    try {
      setIsRefreshing(true);
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

      // Charger les données de niveau
      const level = await GamificationService.getHousekeeperLevel(
        authResult.user?.id || authResult.user?.access_code,
        hotelId!
      );
      setLevelData(level);

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

      // Filtrer uniquement les assignations d'aujourd'hui
      const today = new Date().toISOString().split('T')[0];
      
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select(`
          *,
          rooms (
            id,
            room_number,
            status,
            notes,
            cleaning_priority
          )
        `)
        .eq('hotel_id', hotelId)
        .or(orFilter)
        .in('status', ['assigned', 'in_progress'])
        .gte('assigned_at', `${today}T00:00:00`)
        .order('created_at', { ascending: false });

      console.log('📋 Assignations trouvées:', assignmentsData);
      console.log('❌ Erreur assignations (le cas échéant):', assignmentsError);

      if (assignmentsError) {
        console.error('Erreur chargement assignations:', assignmentsError);
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

      // Si la chambre est terminée, ajouter de l'XP
      if (newStatus === 'clean' && housekeeper && hotelId) {
        const gamificationResult = await GamificationService.addXpForRoomCleaned(
          housekeeper.id || housekeeper.access_code,
          hotelId,
          duration
        );

        if (gamificationResult) {
          // Recharger les données de niveau
          const updatedLevel = await GamificationService.getHousekeeperLevel(
            housekeeper.id || housekeeper.access_code,
            hotelId
          );
          setLevelData(updatedLevel);

          // Afficher les notifications de nouveaux badges
          if (gamificationResult.new_badges && gamificationResult.new_badges.length > 0) {
            for (const badgeCode of gamificationResult.new_badges) {
              const badgeData = await GamificationService.getBadgeByCode(badgeCode);
              if (badgeData) {
                setNewBadges(prev => [...prev, badgeData]);
              }
            }
          }

          // Afficher la notification de level up
          if (gamificationResult.level_up) {
            setLevelUpData(gamificationResult.current_level);
          }

          // Toast avec XP gagné
          toast({
            title: "🎉 Chambre terminée !",
            description: `+${duration <= 20 ? 80 : duration <= 30 ? 65 : 50} XP${
              duration <= 20 ? ' (Bonus vitesse !)' : ''
            }`,
          });
        }
      }

      // Mettre à jour l'état local
      setRooms(prev => prev.map(room => 
        room.id === roomId 
          ? { ...room, status: newStatus }
          : room
      ));

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
        const statusText = newStatus === 'in_progress' ? 'en cours' : 'à nettoyer';
        toast({
          title: "Statut mis à jour",
          description: `Chambre ${rooms.find(r => r.id === roomId)?.room_number} : ${statusText}`
        });
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
    // Nettoyer le localStorage
    localStorage.removeItem('housekeeper');
    localStorage.removeItem('housekeeperProfile');
    localStorage.removeItem('selectedHotelId');
    localStorage.removeItem('selectedHotelName');
    localStorage.removeItem('selectedHotelCode');
    
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

  // Swipe gesture handlers
  const handleTouchStart = (e: React.TouchEvent, roomId: string) => {
    touchStartX.current = e.touches[0].clientX;
    setSwipingCard(roomId);
  };

  const handleTouchMove = (e: React.TouchEvent, roomId: string) => {
    if (swipingCard !== roomId) return;
    
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchCurrentX.current - touchStartX.current;
    
    // Only allow swipe to the right (positive values)
    if (diff > 0) {
      setSwipeOffset(prev => ({ ...prev, [roomId]: diff }));
    }
  };

  const handleTouchEnd = async (roomId: string) => {
    const offset = swipeOffset[roomId] || 0;
    
    // If swiped more than 100px, mark as complete
    if (offset > 100) {
      await updateRoomStatus(roomId, 'clean');
    }
    
    // Reset swipe
    setSwipingCard(null);
    setSwipeOffset(prev => {
      const newOffsets = { ...prev };
      delete newOffsets[roomId];
      return newOffsets;
    });
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
      {/* Notifications de badges et level up */}
      {newBadges.map((badge, index) => (
        <BadgeUnlockNotification
          key={badge.code + index}
          badge={badge}
          onClose={() => setNewBadges(prev => prev.filter((_, i) => i !== index))}
        />
      ))}
      
      {levelUpData && (
        <LevelUpNotification
          newLevel={levelUpData}
          onClose={() => setLevelUpData(null)}
        />
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

         {/* Barre de progression du niveau */}
        {levelData && (
          <div className="mb-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex-1">
                <LevelProgressBar
                  currentLevel={levelData.current_level}
                  totalXp={levelData.total_xp}
                  currentStreak={levelData.current_streak}
                />
              </div>
              {/* Indicateur de connexion temps réel */}
              <Badge 
                variant={isConnected ? "default" : "destructive"} 
                className="flex items-center gap-1.5 shrink-0"
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
            </div>
            
            {/* Badge de nouvelles chambres */}
            {newRoomsCount > 0 && (
              <Badge 
                variant="secondary" 
                className="bg-blue-500 text-white animate-bounce inline-flex items-center gap-1"
              >
                +{newRoomsCount} nouvelle{newRoomsCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        )}

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