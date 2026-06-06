import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, Clock, Home, Building2, MapPin, AlertCircle, Wifi, WifiOff, Sparkles, ScrollText, X, RefreshCw, Package, ClipboardList, Info } from 'lucide-react';
import { IncidentReportWizard } from './incident/IncidentReportWizard';
import { LinenQuickInventory } from './linen/LinenQuickInventory';
import { RoomCardEnhanced } from './housekeeper/RoomCardEnhanced';
import { HousekeeperHeader } from './housekeeper/HousekeeperHeader';
import { HousekeeperActivityLog } from './housekeeper/HousekeeperActivityLog';
import { HousekeeperStatsBar } from './housekeeper/HousekeeperStatsBar';
import { HousekeeperTabNav } from './housekeeper/HousekeeperTabNav';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { realtimeManager } from '@/services/RealtimeManager';
import { storageService } from '@/services/storageService';
import { LostItemReportWizard } from './lost-and-found/LostItemReportWizard';
import { RoomStatusTabs, RoomFilterTab, filterRoomsByTab, calculateRoomCounts } from './RoomStatusTabs';
import { UserTypeGuard } from '@/hooks/use-user-type-guard';
import { DailyInstructionsBanner } from './housekeeper/DailyInstructionsBanner';
import { StaffTasksList } from './tasks/StaffTasksList';
import { ReadOnlyFloorPlan } from './registry/ReadOnlyFloorPlan';
import { StaffNotificationBanner, dispatchStaffNotification } from './housekeeper/StaffNotificationBanner';
import { HousekeeperIncidentsList } from './housekeeper/HousekeeperIncidentsList';

const HOUSEKEEPER_TEMP_LINEN_TASK_ID = 'temp-housekeeper-linen-task';

interface Room {
  id: string;
  room_number: string;
  status: string;
  notes?: string;
  cleaning_priority: number;
  cleaning_type?: string;
  is_twin?: boolean;
  do_not_disturb?: boolean;
}

interface ActivityLogEntry {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

// InstructionsTabContent removed — uses DailyInstructionsBanner directly

const HousekeeperWorkContent: React.FC = () => {
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
  const [activeLinenTask, setActiveLinenTask] = useState<string | null>(null);
  const [newRoomsCount, setNewRoomsCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [dismissedRoomIds, setDismissedRoomIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'rooms' | 'inventory' | 'tasks' | 'instructions' | 'plan'>('rooms');
  const [roomFilterTab, setRoomFilterTab] = useState<RoomFilterTab>('all');
  const [pendingTasksCount, setPendingTasksCount] = useState(0);
  const [hasNewInstructions, setHasNewInstructions] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());
  
  // Pointage
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  
  // Journal d'activité local
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [showActivityLog, setShowActivityLog] = useState(false);

  // Ref pour accéder à loadWorkData dans le callback
  const loadWorkDataRef = useRef<(background?: boolean) => void>(() => {});

  // Fonction pour ajouter au journal d'activité
  const addToActivityLog = useCallback((message: string, type: ActivityLogEntry['type'] = 'info') => {
    setActivityLog(prev => [{
      id: Date.now().toString(),
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      message,
      type
    }, ...prev].slice(0, 50));
  }, []);

  // Récupération des paramètres URL (pour compatibilité)
  const hotelIdFromUrl = searchParams.get('hotel');

  // State pour le profil housekeeper authentifié
  const [housekeeperProfile, setHousekeeperProfile] = useState<any>(null);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  
  // Récupération robuste du hotelId - simplifié avec storageService
  const getHotelId = (): string | null => {
    // 1. URL en priorité
    if (hotelIdFromUrl && hotelIdFromUrl.length >= 30) return hotelIdFromUrl;
    // 2. Hôtel explicitement choisi côté femme de chambre
    const lockedHousekeeperHotelId = storageService.getHousekeeperHotelId();
    if (lockedHousekeeperHotelId && lockedHousekeeperHotelId.length >= 30) return lockedHousekeeperHotelId;
    // 3. Profil housekeeper
    if (housekeeperProfile?.currentHotelId && housekeeperProfile.currentHotelId.length >= 30) {
      return housekeeperProfile.currentHotelId;
    }
    // 4. storageService global seulement si le portail actif est bien femme de chambre
    if (storageService.getActivePortal() === 'housekeeper') {
      const storedId = storageService.getHotelId();
      if (storedId && storedId.length >= 30) return storedId;
    }
    return null;
  };
  
  const hotelId = getHotelId();
  const housekeeperName = housekeeperProfile?.name || 'Femme de chambre';

  // Charger/sauvegarder le pointage
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const savedStart = localStorage.getItem(`pointage_start_${today}_${housekeeperName}`);
    const savedEnd = localStorage.getItem(`pointage_end_${today}_${housekeeperName}`);
    
    if (savedStart) setStartTime(savedStart);
    if (savedEnd) setEndTime(savedEnd);
  }, [housekeeperName]);

  // ID du timesheet courant
  const [currentTimesheetId, setCurrentTimesheetId] = useState<string | null>(null);

  // Charger le timesheet existant de la base de données
  useEffect(() => {
    const loadExistingTimesheet = async () => {
      if (!hotelId || !housekeeperProfile?.id) return;
      
      const today = new Date().toISOString().split('T')[0];
      
      try {
        const { data: existing } = await supabase
          .from('staff_timesheets')
          .select('*')
          .eq('hotel_id', hotelId)
          .eq('housekeeper_profile_id', housekeeperProfile.id)
          .eq('work_date', today)
          .maybeSingle();
        
        if (existing) {
          setCurrentTimesheetId(existing.id);
          if (existing.start_time) {
            const startDate = new Date(existing.start_time);
            setStartTime(startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
          }
          if (existing.end_time) {
            const endDate = new Date(existing.end_time);
            setEndTime(endDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
          }
        }
      } catch (error) {
        console.error('Erreur chargement timesheet:', error);
      }
    };
    
    loadExistingTimesheet();
  }, [hotelId, housekeeperProfile?.id]);

  const handleStartPointage = async () => {
    const now = new Date();
    const nowTime = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const today = now.toISOString().split('T')[0];
    
    setStartTime(nowTime);
    localStorage.setItem(`pointage_start_${today}_${housekeeperName}`, nowTime);
    addToActivityLog(`⏰ Pointage début: ${nowTime}`, 'success');
    
    // Sauvegarder en base de données
    if (hotelId && housekeeperProfile?.id) {
      try {
        // Vérifier si un enregistrement existe déjà pour aujourd'hui
        const { data: existing } = await supabase
          .from('staff_timesheets')
          .select('id')
          .eq('hotel_id', hotelId)
          .eq('housekeeper_profile_id', housekeeperProfile.id)
          .eq('work_date', today)
          .maybeSingle();
        
        if (existing) {
          // Mettre à jour l'existant
          await supabase
            .from('staff_timesheets')
            .update({ start_time: now.toISOString() })
            .eq('id', existing.id);
          setCurrentTimesheetId(existing.id);
        } else {
          // Créer un nouvel enregistrement
          const { data, error } = await supabase
            .from('staff_timesheets')
            .insert({
              hotel_id: hotelId,
              staff_type: 'housekeeper',
              staff_name: housekeeperName,
              staff_id: housekeeperProfile.id,
              housekeeper_profile_id: housekeeperProfile.id,
              work_date: today,
              start_time: now.toISOString(),
              status: 'pending',
              rooms_cleaned: 0,
              rooms_recouche: 0,
              rooms_depart: 0,
            })
            .select()
            .single();
          
          if (error) {
            console.error('Erreur création pointage:', error);
          } else if (data) {
            setCurrentTimesheetId(data.id);
          }
        }
      } catch (error) {
        console.error('Erreur sauvegarde pointage:', error);
      }
    }
  };

  const handleEndPointage = async () => {
    const now = new Date();
    const nowTime = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const today = now.toISOString().split('T')[0];
    
    setEndTime(nowTime);
    localStorage.setItem(`pointage_end_${today}_${housekeeperName}`, nowTime);
    addToActivityLog(`⏰ Pointage fin: ${nowTime}`, 'success');
    
    // Mettre à jour en base de données
    if (hotelId && housekeeperProfile?.id) {
      try {
        // Compter les chambres nettoyées
        const cleanedRooms = rooms.filter(r => r.status === 'clean');
        const recoucheCount = cleanedRooms.filter(r => r.cleaning_type === 'recouche' || r.cleaning_type === 'occupied').length;
        const departCount = cleanedRooms.filter(r => r.cleaning_type === 'depart' || r.cleaning_type === 'checkout').length;
        
        // Chercher l'enregistrement existant
        const { data: existing } = await supabase
          .from('staff_timesheets')
          .select('id')
          .eq('hotel_id', hotelId)
          .eq('housekeeper_profile_id', housekeeperProfile.id)
          .eq('work_date', today)
          .maybeSingle();
        
        if (existing) {
          await supabase
            .from('staff_timesheets')
            .update({ 
              end_time: now.toISOString(),
              rooms_cleaned: cleanedRooms.length,
              rooms_recouche: recoucheCount,
              rooms_depart: departCount,
            })
            .eq('id', existing.id);
          
        } else {
          // Créer un nouveau si inexistant
          await supabase
            .from('staff_timesheets')
            .insert({
              hotel_id: hotelId,
              staff_type: 'housekeeper',
              staff_name: housekeeperName,
              staff_id: housekeeperProfile.id,
              housekeeper_profile_id: housekeeperProfile.id,
              work_date: today,
              end_time: now.toISOString(),
              status: 'pending',
              rooms_cleaned: cleanedRooms.length,
              rooms_recouche: recoucheCount,
              rooms_depart: departCount,
            });
        }
      } catch (error) {
        console.error('Erreur sauvegarde pointage fin:', error);
      }
    }
  };

  // Calculer la durée de travail
  const calculateWorkDuration = (start: string, end: string): string => {
    try {
      const [startH, startM] = start.split(':').map(Number);
      const [endH, endM] = end.split(':').map(Number);
      
      let totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
      if (totalMinutes < 0) totalMinutes += 24 * 60; // Passage minuit
      
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      
      return `${hours}h${minutes > 0 ? String(minutes).padStart(2, '0') : ''}`;
    } catch {
      return '';
    }
  };

  // Vérification de l'authentification au montage
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Sur un rafraîchissement à froid (surtout en WebView mobile), le SDK
        // Supabase peut ne pas avoir fini de réhydrater le token depuis le
        // stockage. getSession() renverrait alors null à tort et éjecterait la
        // femme de chambre. On réessaie quelques fois avant d'abandonner.
        let session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          const { data } = await supabase.auth.getSession();
          session = data.session;
          if (session) break;
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        if (!session) {
          const cachedProfile = storageService.getHousekeeperProfile();
          if (cachedProfile) {
            setHousekeeperProfile(cachedProfile);
            setIsAuthChecked(true);
          } else {
            navigate('/housekeeper/auth');
          }
          return;
        }
        
        // Charger le profil housekeeper depuis la base de données
        const { data: profile, error } = await supabase
          .from('housekeeper_profiles')
          .select('*')
          .eq('email', session.user.email)
          .maybeSingle();
        
        if (error || !profile) {
          const cachedProfile = storageService.getHousekeeperProfile();
          if (cachedProfile) {
            setHousekeeperProfile(cachedProfile);
            setIsAuthChecked(true);
          } else {
            navigate('/housekeeper/signup');
          }
          return;
        }
        
        const lockedHousekeeperHotelId = storageService.getHousekeeperHotelId() || hotelIdFromUrl || undefined;

        setHousekeeperProfile(profile);
        storageService.saveHousekeeperProfile({
          id: profile.id,
          name: profile.name,
          email: profile.email,
          currentHotelId: lockedHousekeeperHotelId || storageService.getHotelId() || undefined,
        });
        
        // Vérifier qu'un hôtel est sélectionné
        const currentHotelId = lockedHousekeeperHotelId || storageService.getHotelId();
        if (!currentHotelId || currentHotelId.length < 30) {
          navigate('/housekeeper/hotels');
          return;
        }

        storageService.saveHousekeeperHotel({ id: currentHotelId });
        
        setIsAuthChecked(true);
      } catch (error) {
        console.error('❌ Erreur vérification auth:', error);
        const cachedProfile = storageService.getHousekeeperProfile();
        if (cachedProfile) {
          setHousekeeperProfile(cachedProfile);
          setIsAuthChecked(true);
        } else {
          navigate('/housekeeper/auth');
        }
      }
    };
    
    checkAuth();
  }, [navigate, hotelIdFromUrl]);

  // Charger les données une fois authentifié
  useEffect(() => {
    if (isAuthChecked && housekeeperProfile && hotelId) {
      loadWorkData();
      loadTasksAndInstructions();
    }
  }, [isAuthChecked, housekeeperProfile, hotelId]);

  // Charger les tâches et instructions pour les badges
  const loadTasksAndInstructions = async () => {
    if (!hotelId || !housekeeperProfile) return;
    
    const today = new Date().toISOString().split('T')[0];
    const currentDayOfWeek = new Date().getDay();
    
    try {
      // Charger les tâches
      const { data: templates, error: tasksError } = await supabase
        .from('task_templates')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('is_active', true)
        .or(`assigned_to_type.eq.housekeeper,assigned_to_all.eq.true`);
      
      if (!tasksError && templates) {
        // Filtrer les tâches pour aujourd'hui
        const todaysTasks = templates.filter(t => {
          if (t.is_one_time) {
            return t.one_time_date === today;
          }
          return t.days_of_week?.includes(currentDayOfWeek);
        });
        
        // Vérifier lesquelles sont complétées
        const taskIds = todaysTasks.map(t => t.id);
        const { data: completions } = await supabase
          .from('task_completions')
          .select('task_template_id')
          .in('task_template_id', taskIds)
          .eq('completion_date', today);
        
        const completedIds = new Set(completions?.map(c => c.task_template_id) || []);
        const pendingTemplates = todaysTasks.filter(t => !completedIds.has(t.id)).length;
        
        // Also count pending manual tasks (tickets)
        const { data: manualTasks } = await supabase
          .from('manual_tasks')
          .select('id, status, assigned_to_name')
          .eq('hotel_id', hotelId)
          .eq('task_date', today)
          .eq('assigned_to_type', 'housekeeper')
          .in('status', ['pending', 'in_progress']);
        
        const pendingManual = (manualTasks || []).filter(t => 
          !t.assigned_to_name || t.assigned_to_name === housekeeperProfile?.name
        ).length;

        const { data: linenTasks } = await supabase
          .from('linen_inventory_tasks')
          .select('id, assigned_to, status')
          .eq('hotel_id', hotelId)
          .eq('task_date', today)
          .in('status', ['pending', 'in_progress']);

        const myInventoryTask = (linenTasks || []).find((task: any) =>
          task.assigned_to === housekeeperProfile?.id ||
          normalizeName(task.assigned_to) === normalizeName(housekeeperProfile?.name)
        );

        setActiveLinenTask(myInventoryTask?.id || null);
        setPendingTasksCount(pendingTemplates + pendingManual + (myInventoryTask ? 1 : 0));
      }
      
      // Charger les instructions
      const { data: instructions, error: instructionsError } = await supabase
        .from('daily_instructions')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('instruction_date', today)
        .maybeSingle();
      
      if (!instructionsError && instructions) {
        const hasContent = instructions.instructions || instructions.to_know || instructions.todo_list;
        const dismissedKey = `instructions_dismissed_${hotelId}_${today}`;
        const wasDismissed = localStorage.getItem(dismissedKey) === 'true';
        setHasNewInstructions(!!hasContent && !wasDismissed);
      }
    } catch (error) {
      console.error('Error loading tasks/instructions:', error);
    }
  };

  // Normaliser un nom pour comparaison
  const normalizeName = (name: string | null | undefined): string => {
    return (name || '').trim().toLowerCase();
  };

  // Gestion intelligente des mises à jour temps réel - SYNC COMPLÈTE avec interface client
  const handleRealtimeUpdate = useCallback((table: string, payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    // Vérifier si cela concerne notre hôtel
    const recordHotelId = newRecord?.hotel_id || oldRecord?.hotel_id;
    if (recordHotelId && recordHotelId !== hotelId) return;
    
    // Collecter tous les identifiants possibles pour la femme de chambre
    const possibleIds = [
      housekeeperProfile?.id,
      housekeeper?.id,
      housekeeper?.access_code,
      housekeeper?.user_id
    ].filter(Boolean);
    
    const normalizedMyName = normalizeName(housekeeperProfile?.name || housekeeperName);
    
    const isForMe = (record: any) => {
      if (!record) return false;
      const normalizedRecordName = normalizeName(record.housekeeper_name);
      return possibleIds.includes(record.housekeeper_id) || 
             normalizedRecordName === normalizedMyName ||
             (normalizedRecordName && normalizedMyName && (
               normalizedRecordName.includes(normalizedMyName) ||
               normalizedMyName.includes(normalizedRecordName)
             ));
    };
    
    if (table === 'assignments') {
      if (eventType === 'INSERT') {
        if (isForMe(newRecord)) {
          loadWorkDataRef.current(true);
          addToActivityLog(`🆕 Nouvelle chambre assignée par le responsable`, 'info');
          dispatchStaffNotification('🆕 Nouvelle chambre', 'Une chambre vous a été assignée par le responsable');
          setNewRoomsCount(prev => prev + 1);
          setTimeout(() => setNewRoomsCount(0), 5000);
        }
      } else if (eventType === 'UPDATE') {
        if (isForMe(newRecord) || isForMe(oldRecord)) {
          loadWorkDataRef.current(true);
          addToActivityLog(`🔄 Assignation mise à jour`, 'info');
        }
      } else if (eventType === 'DELETE') {
        // Chambre retirée par le responsable ou clôture journée
        const wasMyAssignment = isForMe(oldRecord);
        if (wasMyAssignment) {
          setAssignments(prev => prev.filter(a => a.id !== oldRecord.id));
          setRooms(prev => prev.filter(r => r.id !== oldRecord.room_id));
          addToActivityLog(`🗑️ Chambre retirée par le responsable`, 'warning');
        }
      }
    }
    
    if (table === 'rooms') {
      if (eventType === 'UPDATE') {
        const isMyRoom = rooms.some(r => r.id === newRecord.id);
        const isTrackedCheckout = newRecord.status === 'ready-to-clean' || newRecord.status === 'checkout';
        
        // Notification si chambre devient disponible (checkout)
        if (isTrackedCheckout && 
            oldRecord?.status !== 'ready-to-clean' && oldRecord?.status !== 'checkout') {
          addToActivityLog(`🚪 Chambre ${newRecord.room_number} disponible - Client sorti`, 'info');
          dispatchStaffNotification('🚪 Client sorti', `Chambre ${newRecord.room_number} prête à nettoyer`);
          loadWorkDataRef.current(true);
          // Si la chambre m'est déjà assignée, elle reste dans la liste principale
          // (le badge "Client sorti" s'affichera grâce au statut mis à jour ci-dessous).
          if (!isMyRoom) {
            setAvailableRooms(prev => {
              if (!prev.find(r => r.id === newRecord.id)) {
                return [...prev, newRecord];
              }
              return prev;
            });
          }
        }
        
        // Mise à jour locale si c'est ma chambre - SYNCHRONISATION COMPLÈTE
        if (isMyRoom) {
          setRooms(prev => prev.map(r => {
            if (r.id !== newRecord.id) return r;
            // Fusionner en gardant la structure locale
            return { 
              ...r, 
              status: newRecord.status,
              cleaning_type: newRecord.cleaning_type || (isTrackedCheckout ? 'a_blanc' : r.cleaning_type),
              notes: newRecord.notes || r.notes,
              cleaning_priority: newRecord.cleaning_priority || r.cleaning_priority
            };
          }));
          // Si statut changé par le responsable
          if (newRecord.status !== oldRecord?.status) {
            addToActivityLog(`🔄 Chambre ${newRecord.room_number} mise à jour: ${newRecord.status}`, 'info');
          }
        }

        if (!isMyRoom && isTrackedCheckout) {
          // Rattrapage fiable: une chambre libérée doit apparaître tout de suite
          // même si l'assignation ou le cache local ne sont pas encore alignés.
          loadWorkDataRef.current(true);
        }
      } else if (eventType === 'DELETE') {
        // Chambre supprimée (clôture journée)
        const wasMyRoom = rooms.some(r => r.id === oldRecord.id);
        if (wasMyRoom) {
          setRooms(prev => prev.filter(r => r.id !== oldRecord.id));
          addToActivityLog(`🗑️ Chambre supprimée (clôture journée)`, 'warning');
        }
      }
    }

    if (table === 'linen_inventory_tasks') {
      const isAssignedToMe = (record: any) => {
        if (!record) return false;
        return (
          record.assigned_to === housekeeperProfile?.id ||
          normalizeName(record.assigned_to) === normalizedMyName
        );
      };

      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        if (isAssignedToMe(newRecord) || isAssignedToMe(oldRecord)) {
          loadWorkDataRef.current(true);
          if (isAssignedToMe(newRecord) && ['pending', 'in_progress'].includes(newRecord.status)) {
            addToActivityLog(`🧺 Inventaire linge attribué`, 'info');
            dispatchStaffNotification('🧺 Inventaire linge', 'Une tâche d’inventaire vous a été attribuée');
          }
        }
      }

      if (eventType === 'DELETE' && isAssignedToMe(oldRecord)) {
        setActiveLinenTask(null);
        loadWorkDataRef.current(true);
      }
    }
    
    // Écouter les suppressions massives (clôture journée) via daily_reports
    if (table === 'daily_reports') {
      if (eventType === 'INSERT') {
        addToActivityLog(`📊 Journée clôturée par le responsable`, 'warning');
        // Réinitialiser l'interface
        setRooms([]);
        setAssignments([]);
        setAvailableRooms([]);
        setStartTime(null);
        setEndTime(null);
        // Nettoyer le cache local
        if (hotelId && housekeeperProfile?.id) {
          localStorage.removeItem(`assignments_${hotelId}_${housekeeperProfile.id}`);
          const today = new Date().toISOString().split('T')[0];
          localStorage.removeItem(`pointage_start_${today}_${housekeeperName}`);
          localStorage.removeItem(`pointage_end_${today}_${housekeeperName}`);
        }
      }
    }
  }, [hotelId, housekeeperName, housekeeperProfile, housekeeper, addToActivityLog, rooms]);

  // Synchronisation en temps réel - écouter TOUTES les tables pertinentes
  const { isConnected } = useRealtimeSync({
    hotelId: hotelId || undefined,
    tables: ['assignments', 'rooms', 'daily_reports', 'notifications', 'linen_inventory_tasks'],
    onUpdate: handleRealtimeUpdate
  });

  // Filet de secours: recharge les données si le temps réel est coupé / au retour de connexion
  useEffect(() => {
    if (!isAuthChecked || !housekeeperProfile || !hotelId) return;

    // Polling de secours toutes les 25s (le temps réel reste prioritaire)
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadWorkDataRef.current(true);
      }
    }, 25000);

    // Rattrapage immédiat au retour de connexion temps réel
    const unsubscribe = realtimeManager.onConnectionStatusChange((status) => {
      if (status === 'SUBSCRIBED' || status === 'ONLINE') {
        loadWorkDataRef.current(true);
      }
    });

    // Rattrapage au retour de l'onglet (téléphone mis en veille)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        loadWorkDataRef.current(true);
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(intervalId);
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthChecked, housekeeperProfile, hotelId]);



  const loadWorkData = async (background = false) => {
    try {
      if (!background) setIsRefreshing(true);
      
      // Cache rapide (uniquement avec un profil valide pour éviter un décalage de clé)
      const cachedKey = housekeeperProfile?.id
        ? `assignments_${hotelId}_${housekeeperProfile.id}`
        : null;
      const cachedData = cachedKey ? localStorage.getItem(cachedKey) : null;
      if (cachedData && rooms.length === 0) {
        try {
          const { assignments: cachedAssignments, rooms: cachedRooms, timestamp } = JSON.parse(cachedData);
          if (Date.now() - timestamp < 12 * 60 * 60 * 1000) {
            setAssignments(cachedAssignments || []);
            setRooms(cachedRooms || []);
          }
        } catch (e) {
          console.error('Erreur parsing cache:', e);
        }
      }
      
      let authResult: any;
      
      // Utiliser uniquement l'authentification via profil
      if (!housekeeperProfile) {
        console.error('❌ Pas de profil housekeeper');
        navigate('/housekeeper/auth');
        return;
      }
      
      // Utiliser la fonction RPC sécurisée pour récupérer les infos de l'hôtel
      // Cette fonction vérifie que la femme de chambre a bien une demande approuvée
      const { data: hotelData, error: hotelError } = await supabase
        .rpc('get_hotel_for_housekeeper', {
          p_housekeeper_profile_id: housekeeperProfile.id,
          p_hotel_id: hotelId
        });

      if (hotelError) {
        console.error('❌ Erreur RPC get_hotel_for_housekeeper:', hotelError);
        // Lors d'un rafraîchissement en arrière-plan (retour caméra, réveil du
        // téléphone, reconnexion temps réel), une erreur réseau transitoire ne
        // doit JAMAIS éjecter la femme de chambre de l'établissement ni effacer
        // ses données. On garde l'état actuel et on réessaiera plus tard.
        if (background) {
          return;
        }
        toast({
          title: "Erreur",
          description: "Impossible de charger l'hôtel",
          variant: "destructive"
        });
        navigate('/housekeeper/hotels');
        return;
      }

      // hotelData est un tableau, prendre le premier élément
      const hotelResult = Array.isArray(hotelData) ? hotelData[0] : hotelData;
      
      if (!hotelResult) {
        // Fallback: charger directement depuis la table hotels via le nom stocké
        const { data: fallbackHotel } = await supabase
          .from('hotels')
          .select('id, name, hotel_code, email, address, settings')
          .eq('id', hotelId)
          .single();
        
        if (!fallbackHotel) {
          // Idem: ne pas éjecter lors d'un rafraîchissement en arrière-plan
          if (background) {
            return;
          }
          toast({
            title: "Erreur",
            description: "Hôtel non trouvé ou accès non autorisé",
            variant: "destructive"
          });
          navigate('/housekeeper/hotels');
          return;
        }
        
        setHotel(fallbackHotel);
        setHousekeeper({
          id: housekeeperProfile.id,
          name: housekeeperProfile.name,
          email: housekeeperProfile.email
        });
      } else {
        setHotel(hotelResult);
        setHousekeeper({
          id: housekeeperProfile.id,
          name: housekeeperProfile.name,
          email: housekeeperProfile.email
        });
      }

      authResult = {
        success: true,
        hotel: hotelResult,
        user: {
          id: housekeeperProfile.id,
          name: housekeeperProfile.name,
          email: housekeeperProfile.email
        }
      };

      const housekeeperId = housekeeperProfile?.id;
      const profileName = housekeeperProfile?.name;

      // Récupérer TOUS les noms possibles associés à cet utilisateur
      let allPossibleNames: string[] = [];
      let allPossibleIds: string[] = [];
      
      if (profileName) {
        allPossibleNames.push(profileName.trim());
        allPossibleNames.push(profileName.trim().toLowerCase());
      }
      
      if (housekeeperId) {
        allPossibleIds.push(housekeeperId);
        
        // Chercher toutes les entrées dans la table housekeepers liées à cet utilisateur
        const { data: hkData } = await supabase
          .from('housekeepers')
          .select('id, name, user_id')
          .eq('hotel_id', hotelId)
          .or(`user_id.eq.${housekeeperId},name.ilike.${profileName || ''}`);
        
        if (hkData && hkData.length > 0) {
          hkData.forEach(hk => {
            if (hk.id) allPossibleIds.push(hk.id);
            if (hk.name) {
              allPossibleNames.push(hk.name.trim());
            }
          });
        }
      }
      
      // Dédupliquer les noms et IDs
      allPossibleIds = [...new Set(allPossibleIds.filter(Boolean))];
      allPossibleNames = [...new Set(allPossibleNames.filter(Boolean))];
      
      
      // Construire le filtre OR pour inclure tous les IDs et noms possibles
      let orFilters: string[] = [];
      allPossibleIds.forEach(id => {
        orFilters.push(`housekeeper_id.eq.${id}`);
      });
      allPossibleNames.forEach(name => {
        // Utiliser ilike pour ignorer la casse
        orFilters.push(`housekeeper_name.ilike.${name}`);
      });
      
      const orFilter = orFilters.join(',');

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
            cleaning_type,
            is_twin,
            do_not_disturb
          )
        `)
        .eq('hotel_id', hotelId)
        .or(orFilter)
        .in('status', ['assigned', 'in_progress', 'completed'])
        .order('created_at', { ascending: false });

      if (assignmentsError) {
        console.error('Erreur chargement assignations:', assignmentsError);
        const cached = localStorage.getItem(`assignments_${hotelId}_${housekeeperId}`);
        if (cached) {
          try {
            const { assignments: cachedAssignments, rooms: cachedRooms, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < 12 * 60 * 60 * 1000) {
              setAssignments(cachedAssignments);
              setRooms(cachedRooms);
            }
          } catch (e) {
            console.error('Erreur parsing cache:', e);
          }
        }
        return;
      }

      
      // Dédupliquer les assignations (garder la plus récente par chambre)
      const uniqueAssignments = assignmentsData?.reduce((acc: any[], curr: any) => {
        const existingIndex = acc.findIndex(a => a.room_id === curr.room_id);
        if (existingIndex === -1) {
          acc.push(curr);
        } else if (new Date(curr.created_at) > new Date(acc[existingIndex].created_at)) {
          acc[existingIndex] = curr;
        }
        return acc;
      }, []) || [];

      // IMPORTANT: Extraire TOUTES les chambres assignées (recouche ET à blanc)
      const extractedRooms: Room[] = uniqueAssignments
        .filter((a: any) => a.rooms)
        .map((a: any) => ({
          id: a.rooms.id,
          room_number: a.rooms.room_number,
          status: a.rooms.status || 'needs-cleaning',
          notes: a.rooms.notes,
          cleaning_priority: a.rooms.cleaning_priority || 5,
          cleaning_type: a.rooms.cleaning_type || ((a.rooms.status === 'ready-to-clean' || a.rooms.status === 'checkout') ? 'a_blanc' : undefined),
          is_twin: a.rooms.is_twin || false,
          do_not_disturb: a.rooms.do_not_disturb || false

        }));

      // Log détaillé pour debug
      const aBlancCount = extractedRooms.filter(r => r.cleaning_type === 'full' || r.cleaning_type === 'checkout' || r.cleaning_type === 'À blanc').length;
      const recoucheCount = extractedRooms.filter(r => r.cleaning_type === 'quick' || r.cleaning_type === 'stayover' || r.cleaning_type === 'Recouche').length;
      const otherCount = extractedRooms.length - aBlancCount - recoucheCount;
      
      // Protection contre la perte de données : lors d'un rafraîchissement en
      // arrière-plan, si la requête revient vide (RLS transitoire, réveil du
      // téléphone, retour caméra) alors qu'on avait déjà des chambres, on
      // ignore ce résultat vide pour ne pas effacer le travail en cours.
      if (background && extractedRooms.length === 0 && rooms.length > 0) {
        return;
      }

      const normalizedRooms = extractedRooms.map((room) => ({
        ...room,
        cleaning_type: room.cleaning_type || ((room.status === 'ready-to-clean' || room.status === 'checkout') ? 'a_blanc' : room.cleaning_type)
      }));

      setAssignments(uniqueAssignments);
      setRooms(normalizedRooms);

      const { data: checkoutRooms } = await supabase
        .from('rooms')
        .select('id, room_number, status, notes, cleaning_priority, cleaning_type, is_twin, do_not_disturb')
        .eq('hotel_id', hotelId)
        .in('status', ['ready-to-clean', 'checkout'])
        .order('updated_at', { ascending: false });

      const fallbackCheckoutRooms: Room[] = (checkoutRooms || []).map((room: any) => ({
        id: room.id,
        room_number: room.room_number,
        status: room.status,
        notes: room.notes,
        cleaning_priority: room.cleaning_priority || 5,
        cleaning_type: room.cleaning_type || 'a_blanc',
        is_twin: room.is_twin || false,
        do_not_disturb: room.do_not_disturb || false,
      }));

      setAvailableRooms(
        fallbackCheckoutRooms.filter(room => !normalizedRooms.some(existing => existing.id === room.id))
      );
      
      // Sauvegarder dans le cache (seulement si on a des données réelles)
      if (normalizedRooms.length > 0) {
        localStorage.setItem(`assignments_${hotelId}_${housekeeperId}`, JSON.stringify({
          assignments: uniqueAssignments,
          rooms: normalizedRooms,
          timestamp: Date.now()
        }));
      }

      // Charger les tâches d'inventaire linge
      const today = new Date().toISOString().split('T')[0];
        const { data: linenTasks } = await supabase
        .from('linen_inventory_tasks')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('task_date', today)
        .in('status', ['pending', 'in_progress']);
      
      if (linenTasks && linenTasks.length > 0) {
        const normalizedHousekeeperName = normalizeName(housekeeperName);
        const possibleAssigneeIds = [
          housekeeperProfile?.id,
          housekeeper?.id,
          housekeeper?.access_code,
          housekeeper?.user_id,
        ].filter(Boolean);

        const myTask = linenTasks.find((t: any) =>
          possibleAssigneeIds.includes(t.assigned_to) ||
          t.assigned_to === housekeeperName ||
          normalizeName(t.assigned_to) === normalizedHousekeeperName
        );

        setActiveLinenTask(myTask?.id || null);
      } else {
        setActiveLinenTask(null);
      }
      
    } catch (error) {
      console.error('Erreur chargement données:', error);
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

  // Mettre à jour la ref pour le callback realtime
  useEffect(() => {
    loadWorkDataRef.current = loadWorkData;
  });

  const handleRoomStatusChange = async (roomId: string, newStatus: string, notes?: string) => {
    try {
      const room = rooms.find(r => r.id === roomId);
      if (!room) return;

      const nowIso = new Date().toISOString();
      const { error: roomError } = await supabase
        .from('rooms')
        .update({ 
          status: newStatus,
          notes: notes || room.notes,
          last_cleaned_at: newStatus === 'clean' ? nowIso : undefined
        })
        .eq('id', roomId);

      if (roomError) throw roomError;

      // Répercuter le statut (propre/sale) vers le PMS Apaleo (best-effort)
      if (hotelId) {
        supabase.functions
          .invoke('apaleo-update-condition', {
            body: { hotelId, roomNumber: room.room_number, status: newStatus },
          })
          .then(({ data, error }) => {
            if (error) console.warn('⚠️ Synchro statut Apaleo échouée:', error.message);
            else console.log('🔄 Synchro Apaleo:', data);
          })
          .catch((e) => console.warn('⚠️ Synchro statut Apaleo échouée:', e));
      }

      const assignment = assignments.find(a => a.room_id === roomId);
      if (assignment) {
        const newAssignmentStatus = newStatus === 'clean' ? 'completed' : 
                                    (newStatus === 'in-progress' || newStatus === 'in_progress') ? 'in_progress' : 'assigned';
        
        await supabase
          .from('assignments')
          .update({ 
            status: newAssignmentStatus,
            completed_at: newStatus === 'clean' ? new Date().toISOString() : null,
            started_at: (newStatus === 'in_progress' || newStatus === 'in-progress') ? new Date().toISOString() : assignment.started_at
          })
          .eq('id', assignment.id);
      }

      // Logger l'action dans daily_action_logs + notifier l'admin en temps réel
      if (hotelId) {
        const actionType = newStatus === 'clean' ? 'cleaning-end' : 'cleaning-start';
        const description = `${housekeeperName} - Chambre ${room.room_number} - ${newStatus === 'clean' ? 'Nettoyage terminé' : 'Nettoyage démarré'}`;
        
        // 1. Journal d'action
        await supabase.from('daily_action_logs').insert({
          hotel_id: hotelId,
          action_type: actionType,
          description,
          room_number: room.room_number,
          actor_name: housekeeperName,
          actor_type: 'housekeeper',
          details: { 
            notes, 
            previousStatus: room.status, 
            cleaningType: room.cleaning_type,
            timestamp: new Date().toISOString()
          }
        });

        // 2. Notification temps réel pour l'admin via RPC
        await supabase.rpc('log_housekeeper_action', {
          p_hotel_id: hotelId,
          p_type: actionType,
          p_title: newStatus === 'clean' ? '✅ Nettoyage terminé' : '🔄 Nettoyage en cours',
          p_description: description,
          p_housekeeper_name: housekeeperName,
          p_room_number: room.room_number
        });
      }

      // Mise à jour optimiste locale
      setRooms(prev => prev.map(r => 
        r.id === roomId ? { ...r, status: newStatus, notes: notes || r.notes } : r
      ));

      const statusText = newStatus === 'clean' ? 'terminé' : 'en cours';
      addToActivityLog(`✅ Chambre ${room.room_number} - Nettoyage ${statusText}`, 'success');

      toast({
        title: newStatus === 'clean' ? "✅ Chambre nettoyée" : "🔄 En cours",
        description: `Chambre ${room.room_number} ${statusText}`,
      });

    } catch (error) {
      console.error('Erreur changement statut:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le statut",
        variant: "destructive"
      });
    }
  };

  // Retirer une chambre de la vue de la femme de chambre (la masquer localement).
  const handleUnassignRoom = (roomId: string, roomNumber: string) => {
    setDismissedRoomIds(prev => {
      const next = new Set(prev);
      next.add(roomId);
      return next;
    });
    setRooms(prev => prev.filter(r => r.id !== roomId));
    setAvailableRooms(prev => prev.filter(r => r.id !== roomId));
    addToActivityLog(`➖ Chambre ${roomNumber} masquée de votre liste`, 'info');
    toast({
      title: "Chambre retirée",
      description: `Chambre ${roomNumber} masquée de votre liste`,
    });
  };



  const handleLogout = async () => {
    await supabase.auth.signOut();
    storageService.clearHousekeeperProfile();
    storageService.clearHousekeeperHotel();
    storageService.clearHotel();
    localStorage.removeItem(`assignments_${hotelId}_${housekeeperProfile?.id || 'temp'}`);
    navigate('/housekeeper/auth');
  };

  const completedRooms = rooms.filter(r => r.status === 'clean').length;
  const totalRooms = rooms.length;
  const progressPercent = totalRooms > 0 ? Math.round((completedRooms / totalRooms) * 100) : 0;

  // Calculate room counts for tabs
  const roomCounts = useMemo(() => {
    const counts = calculateRoomCounts(rooms.map(r => ({
      status: r.status,
      cleaning_type: r.cleaning_type
    })));
    return counts;
  }, [rooms]);
  
  // Apply tab filter to rooms
  const filteredByTab = useMemo(() => {
    const filtered = filterRoomsByTab(rooms
      .filter(r => !dismissedRoomIds.has(r.id))
      .map(r => ({
        ...r,
        cleaning_type: r.cleaning_type
      })), roomFilterTab);
    return filtered;
  }, [rooms, roomFilterTab, dismissedRoomIds]);

  const sortedRooms = [...filteredByTab].sort((a, b) => {
    if (a.status === 'clean' && b.status !== 'clean') return 1;
    if (a.status !== 'clean' && b.status === 'clean') return -1;
    if (a.cleaning_priority !== b.cleaning_priority) return b.cleaning_priority - a.cleaning_priority;
    return a.room_number.localeCompare(b.room_number, undefined, { numeric: true });
  });
  
  // Realtime handles live updates — no polling needed

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Chargement de vos chambres...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-muted/30">
      <HousekeeperHeader
        hotelName={hotel?.name || 'Mon Hôtel'}
        housekeeperName={housekeeperName}
        isConnected={isConnected}
        newRoomsCount={newRoomsCount}
        onToggleActivityLog={() => setShowActivityLog(!showActivityLog)}
        onLogout={handleLogout}
      />

      <div className="flex-1 overflow-y-auto overscroll-contain">
      {/* Notification banner compacte et glissable */}
      <StaffNotificationBanner hotelId={hotelId || undefined} />


      {showActivityLog && (
        <HousekeeperActivityLog entries={activityLog} onClose={() => setShowActivityLog(false)} />
      )}

      <div className="container mx-auto px-4 py-4 space-y-4">
        {/* Consignes du jour */}
        {hotelId && <DailyInstructionsBanner hotelId={hotelId} />}

        {/* Bannière tâches disponibles - redirige vers l'onglet tâches */}
        {pendingTasksCount > 0 && (
          <Card 
            className="p-3 cursor-pointer hover:shadow-md transition-shadow bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200"
            onClick={() => setActiveTab('tasks')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 p-2 rounded-full">
                  <ClipboardList className="h-5 w-5 text-amber-700" />
                </div>
                <div>
                  <span className="font-semibold text-amber-900">
                    {pendingTasksCount} tâche{pendingTasksCount > 1 ? 's' : ''} disponible{pendingTasksCount > 1 ? 's' : ''}
                  </span>
                  <p className="text-xs text-amber-700">Appuyez pour voir vos tâches</p>
                </div>
              </div>
              <Badge className="bg-amber-500 text-white animate-pulse">{pendingTasksCount}</Badge>
            </div>
          </Card>
        )}

        <HousekeeperStatsBar
          completedRooms={completedRooms}
          totalRooms={totalRooms}
          progressPercent={progressPercent}
          startTime={startTime}
          endTime={endTime}
          rooms={rooms}
          onStartPointage={handleStartPointage}
          onEndPointage={handleEndPointage}
          calculateWorkDuration={calculateWorkDuration}
        />

        <HousekeeperTabNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          totalRooms={totalRooms}
          pendingTasksCount={pendingTasksCount}
          hasNewInstructions={hasNewInstructions}
          hotelId={hotelId}
          onInstructionsDismiss={() => {
            if (hotelId) {
              const today = new Date().toISOString().split('T')[0];
              localStorage.setItem(`instructions_dismissed_${hotelId}_${today}`, 'true');
              setHasNewInstructions(false);
            }
          }}
          onInventoryOpen={() => {
            return;
          }}
        />

        {/* Contenu selon l'onglet actif */}
        {activeTab === 'rooms' && (
          <>
            {/* Onglets de filtrage par statut */}
            <RoomStatusTabs
              activeTab={roomFilterTab}
              onTabChange={setRoomFilterTab}
              counts={roomCounts}
              compact={true}
            />
            
            {/* Actions rapides */}
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant="outline" 
                className="flex-1 gap-2"
                onClick={() => loadWorkData()}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Actualisation...' : 'Actualiser'}
              </Button>
              {hotelId && (
                <>
                  <IncidentReportWizard 
                    hotelId={hotelId}
                    userType="housekeeper"
                    userName={housekeeperName}
                    trigger={
                      <Button variant="outline" size="sm" className="gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Incident
                      </Button>
                    }
                  />
                  <LostItemReportWizard
                    hotelId={hotelId}
                    reporterName={housekeeperName}
                    reporterType="housekeeper"
                    trigger={
                      <Button variant="outline" size="sm" className="gap-2">
                        <Package className="h-4 w-4" />
                        Objet trouvé
                      </Button>
                    }
                  />
                </>
              )}
            </div>

            {/* Liste des chambres */}
            {sortedRooms.length === 0 && availableRooms.length === 0 ? (
              <Card className="p-8 text-center">
                <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">
                  {rooms.length === 0 ? 'Aucune chambre assignée' : 'Aucune chambre dans ce filtre'}
                </h3>
                <p className="text-muted-foreground">
                  {rooms.length === 0 
                    ? 'Attendez que le responsable vous assigne des chambres'
                    : 'Sélectionnez un autre onglet pour voir les chambres'
                  }
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {availableRooms.filter(room => !rooms.some(existing => existing.id === room.id) && !dismissedRoomIds.has(room.id)).length > 0 && (
                  <Card className="border-warning/30 bg-warning/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">Clients sortis détectés</p>
                        <p className="text-sm text-muted-foreground">
                          Ces chambres viennent d’être libérées et remontent en direct.
                        </p>
                      </div>
                      <Badge variant="secondary" className="bg-background text-foreground">
                        {availableRooms.filter(room => !rooms.some(existing => existing.id === room.id) && !dismissedRoomIds.has(room.id)).length}
                      </Badge>
                    </div>
                  </Card>
                )}

                {availableRooms
                  .filter(room => !rooms.some(existing => existing.id === room.id) && !dismissedRoomIds.has(room.id))
                  .map(room => (
                    <RoomCardEnhanced
                      key={`checkout-${room.id}`}
                      room={{
                        ...room,
                        cleaning_type: room.cleaning_type || 'a_blanc',
                      }}
                      hotelId={hotelId || ''}
                      housekeeperName={housekeeperName}
                      onUpdateStatus={handleRoomStatusChange}
                      onUnassign={handleUnassignRoom}
                    />
                  ))}

                {sortedRooms.map(room => (
                  <RoomCardEnhanced
                    key={room.id}
                    room={room}
                    hotelId={hotelId || ''}
                    housekeeperName={housekeeperName}
                    onUpdateStatus={handleRoomStatusChange}
                    onUnassign={handleUnassignRoom}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'tasks' && hotelId && (
          <div className="space-y-4">
            <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-blue-500 text-white">
                  <ClipboardList className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Tâches du jour</h3>
                  <p className="text-sm text-muted-foreground">
                    {pendingTasksCount > 0 
                      ? `${pendingTasksCount} tâche(s) à effectuer` 
                      : 'Toutes les tâches sont terminées'
                    }
                  </p>
                </div>
              </div>
            </Card>

            {/* Incidents attribués à cette femme de chambre */}
            <div className="space-y-2">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                Incidents qui me sont attribués
              </h3>
              <HousekeeperIncidentsList hotelId={hotelId} housekeeperName={housekeeperName} />
            </div>

            <StaffTasksList
              hotelId={hotelId}
              staffType="housekeeper"
              staffId={housekeeperProfile?.id}
              staffName={housekeeperName}
            />
          </div>
        )}

        {activeTab === 'instructions' && hotelId && (
          <DailyInstructionsBanner hotelId={hotelId} />
        )}

        {activeTab === 'plan' && hotelId && (
          <ReadOnlyFloorPlan
            hotelId={hotelId}
            highlightedRooms={rooms.map(r => r.room_number)}
          />
        )}

        {activeTab === 'inventory' && hotelId && (
          <div className="flex flex-col pb-2">
            <section className="mb-3 rounded-2xl border bg-card px-4 py-3 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Inventaire du linge</p>
                  <p className="text-xs text-muted-foreground">
                    {activeLinenTask ? 'Tâche attribuée prête à scanner.' : 'Aucune tâche attribuée pour le moment.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!activeLinenTask && housekeeperProfile?.id && (
                    <Button
                      onClick={() => setActiveLinenTask(HOUSEKEEPER_TEMP_LINEN_TASK_ID)}
                      size="sm"
                      className="shrink-0"
                    >
                      Commencer l’inventaire
                    </Button>
                  )}
                  <Badge variant={isConnected ? 'secondary' : 'outline'}>
                    {isConnected ? 'Live' : 'Pause'}
                  </Badge>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border bg-card shadow-sm">
              {activeLinenTask ? (
                <LinenQuickInventory
                  taskId={activeLinenTask}
                  hotelId={hotelId}
                  assignedToId={housekeeperProfile?.id}
                  embedded
                  onClose={() => {
                    setActiveLinenTask(null);
                    setActiveTab('rooms');
                    toast({
                      title: "✅ Inventaire terminé",
                      description: "Merci pour votre travail!"
                    });
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-center">
                  <div className="max-w-sm space-y-2">
                    <p className="text-base font-semibold">Aucun inventaire attribué</p>
                    <p className="text-sm text-muted-foreground">
                      Dès qu’un responsable vous assigne une tâche, elle apparaîtra ici automatiquement, ou vous pouvez la démarrer ici.
                    </p>
                    {housekeeperProfile?.id && (
                      <Button
                        onClick={() => setActiveLinenTask(HOUSEKEEPER_TEMP_LINEN_TASK_ID)}
                        className="mt-2"
                      >
                        Commencer l’inventaire
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

      </div>
      </div>
    </div>

  );
};

// Wrapper avec le guard de type d'utilisateur
export const HousekeeperWorkSimple: React.FC = () => {
  return (
    <UserTypeGuard expectedType="housekeeper">
      <HousekeeperWorkContent />
    </UserTypeGuard>
  );
};
