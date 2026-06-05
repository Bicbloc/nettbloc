import { useEffect, useState, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import { AlertCircle, RefreshCw, LogOut, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSearchParams, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useHotel } from "@/contexts/HotelContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSessionTracking } from "@/hooks/use-session-tracking";
import { Room, CleaningConfig, getDefaultCleaningConfig } from "@/services/pdfService";
import { generateReport, generateCombinedReport } from "@/services/reportService";
import { toast } from "@/hooks/use-toast";
import { ManualAssignmentDialog } from "@/components/ManualAssignmentDialog";
import { supabase } from "@/integrations/supabase/client";
import { useReportEmail } from "@/hooks/use-report-email";
import EmailReportDialog from "@/components/EmailReportDialog";
import { RedistributionDialog, RedistributionMethod } from "@/components/RedistributionDialog";
import { ReportFields as CustomReportFields } from "@/components/ReportCustomFields";
import { useHousekeeping } from "@/contexts/HousekeepingContext";
import { useNotificationContext } from "@/contexts/NotificationContext";
import { DailyActionLogPanel } from "@/components/DailyActionLogPanel";
import { NotificationSound } from "@/components/NotificationSound";
import { DeleteRoomDialog } from "@/components/DeleteRoomDialog";
import { LinkRoomsDialog } from "@/components/LinkRoomsDialog";
import { cleanupInvalidHotelIds, generateHotelId } from "@/lib/utils";
import { redistributeRooms } from "@/utils/redistributionUtils";
import { storageService } from "@/services/storageService";
import { PremiumLimitGuard } from "@/components/PremiumLimitGuard";
import { useSubscription } from "@/hooks/useSubscription";
import { HeroHeader } from "@/components/HeroHeader";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { useConnectionStatus } from "@/hooks/use-connection-status";
import { realtimeManager } from "@/services/RealtimeManager";
import { FirstTimeSetupWizard, useFirstTimeSetup } from "@/components/FirstTimeSetupWizard";
import { FeatureTour, isFeatureTourDone, markFeatureTourDone, TOUR_TOPICS } from "@/components/FeatureTour";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useRoomManagement } from "@/hooks/use-room-management";
import { useHousekeeperManagement } from "@/hooks/use-housekeeper-management";
import { useDashboardDialogs } from "@/hooks/use-dashboard-dialogs";
import { SupabaseService } from "@/services/supabaseService";
import { AssignmentService } from "@/services/assignmentService";
import { usePdfWorkflow } from "@/hooks/use-pdf-workflow";
import { useOnboarding } from "@/hooks/use-onboarding";
import { OnboardingWizard, TrialExpiryBanner, TrialExpiredBlocker } from "@/components/onboarding";
import { useUserTypeGuard } from "@/hooks/use-user-type-guard";

// Layout components
import { MainLayout, TabValue } from "@/components/layout";

// Dashboard tab components — lazy loaded for code splitting
const OverviewTab = lazy(() => import("@/components/dashboard/OverviewTab").then(m => ({ default: m.OverviewTab })));
const RoomManagementTab = lazy(() => import("@/components/dashboard/RoomManagementTab").then(m => ({ default: m.RoomManagementTab })));
const AssignmentTab = lazy(() => import("@/components/dashboard/AssignmentTab").then(m => ({ default: m.AssignmentTab })));
const AccessCodesTab = lazy(() => import("@/components/dashboard/AccessCodesTab").then(m => ({ default: m.AccessCodesTab })));
const LinenTab = lazy(() => import("@/components/dashboard/LinenTab").then(m => ({ default: m.LinenTab })));
const IncidentsTab = lazy(() => import("@/components/dashboard/IncidentsTab").then(m => ({ default: m.IncidentsTab })));
const ReportsTab = lazy(() => import("@/components/dashboard/ReportsTab").then(m => ({ default: m.ReportsTab })));
const TrainingTab = lazy(() => import("@/components/dashboard/TrainingTab").then(m => ({ default: m.TrainingTab })));
const ArchivesTab = lazy(() => import("@/components/dashboard/ArchivesTab").then(m => ({ default: m.ArchivesTab })));

import { HotelSelectionDialog } from "@/components/dashboard/HotelSelectionDialog";
import { NewDayBanner } from "@/components/dashboard/NewDayBanner";
import { GovernessInspectionInterface } from "@/components/governess/GovernessInspectionInterface";
import { LostAndFoundTab } from "@/components/dashboard/LostAndFoundTab";
import { TaskTemplateManager } from "@/components/templates/TaskTemplateManager";
import { ManualTaskManager } from "@/components/tasks/ManualTaskManager";
import { useRoomStats, useRoomHelpers } from "@/hooks/use-room-stats";
import { useAssignmentHandlers } from "@/hooks/use-assignment-handlers";

const LogoutButton = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-destructive hover:text-destructive mt-4"
      onClick={async () => {
        await signOut();
        navigate('/auth', { replace: true });
      }}
    >
      <LogOut className="h-4 w-4 mr-1" />
      Déconnexion
    </Button>
  );
};

const Index = () => {
  const [searchParams] = useSearchParams();
  const { isAuthenticated, loading: authLoading, isInitialized, user } = useAuth();
  const { isHotelReady } = useHotel();
  const { t } = useLanguage();
  const isGuestMode = searchParams.get('mode') === 'guest';

  // Vérifier le type d'utilisateur pour les utilisateurs authentifiés (pas en mode invité)
  const { isLoading: typeCheckLoading, isVerified } = useUserTypeGuard('establishment');

  // Attendre initialisation auth
  if (!isInitialized || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">{t.common.verification}</p>
        </div>
      </div>
    );
  }

  // Redirection si pas authentifié
  if (!isAuthenticated && !isGuestMode) {
    const isStaffMode = searchParams.get('mode') === 'staff';
    return <Navigate to={isStaffMode ? "/auth?mode=staff" : "/landing"} replace />;
  }

  // Vérifier le type d'utilisateur (seulement pour les authentifiés, pas en guest mode)
  if (isAuthenticated && !isGuestMode && user) {
    if (typeCheckLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
          <div className="text-center space-y-4">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground text-sm">Vérification des accès...</p>
            <LogoutButton />
          </div>
        </div>
      );
    }

    if (!isVerified) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-destructive/5 via-background to-destructive/10">
          <div className="text-center space-y-4">
            <div className="w-8 h-8 border-4 border-destructive border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground text-sm">Redirection vers votre espace...</p>
            <LogoutButton />
          </div>
        </div>
      );
    }
  }

  // Attendre que l'hôtel soit prêt (pour les utilisateurs authentifiés)
  if (isAuthenticated && !isHotelReady) {
    return <HotelLoadingScreen />;
  }

  return <IndexDashboard />;
};

// Composant séparé pour éviter les problèmes de hooks
const HotelLoadingScreen = () => {
  const { t } = useLanguage();
  const [timedOut, setTimedOut] = useState(false);
  
  useEffect(() => {
    const timeout = setTimeout(() => {
      setTimedOut(true);
    }, 10000);
    
    return () => clearTimeout(timeout);
  }, []);

  if (timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="text-center space-y-4 max-w-sm mx-auto px-4">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <p className="text-foreground font-medium">Impossible de charger l'établissement</p>
          <p className="text-muted-foreground text-sm">Vérifiez votre connexion ou réessayez.</p>
          <Button onClick={() => window.location.reload()} variant="outline" className="mt-2">
            <RefreshCw className="h-4 w-4 mr-2" /> Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
      <div className="text-center space-y-4">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground text-sm">{t.common.loadingEstablishment}</p>
      </div>
    </div>
  );
};

const IndexDashboard = () => {
  const [searchParams] = useSearchParams();
  const { isAuthenticated, user } = useAuth();
  const { hotelId, hotelName, hotelCode: contextHotelCode } = useHotel();
  const { t, language } = useLanguage();
  const isGuestMode = searchParams.get('mode') === 'guest';
  const navigate = useNavigate();
  const { isConnected: isPlatformConnected } = useConnectionStatus();

  // Utiliser hotelId du contexte
  const currentHotelId = hotelId;
  const { isPremium, isFree, loading: subscriptionLoading } = useSubscription();
  
  useSessionTracking();
  
  const [activeTab, setActiveTab] = useState<TabValue>(() => storageService.getAdminTab() as TabValue || 'overview');
  const [cleaningConfig, setCleaningConfig] = useState<CleaningConfig>(getDefaultCleaningConfig(isPremium));

  // Listen for navigate-to-pms-config events from dialogs
  useEffect(() => {
    const handler = () => {
      setActiveTab('rooms');
      setTimeout(() => {
        const el = document.querySelector('[data-pms-config]');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    };
    window.addEventListener('navigate-to-pms-config', handler);
    return () => window.removeEventListener('navigate-to-pms-config', handler);
  }, []);

  // Listen for navigate-to-training events from PDF workflow
  useEffect(() => {
    const handler = () => {
      setActiveTab('training' as TabValue);
    };
    window.addEventListener('navigate-to-training', handler);
    return () => window.removeEventListener('navigate-to-training', handler);
  }, []);

  // Listen for navigate-to-assignment events (e.g. from PMS panel)
  useEffect(() => {
    const handler = () => {
      setActiveTab('assignment' as TabValue);
    };
    window.addEventListener('navigate-to-assignment', handler);
    return () => window.removeEventListener('navigate-to-assignment', handler);
  }, []);
  
  const { 
    housekeeperNames, 
    setHousekeeperNames,
    rooms,
    setRooms,
    isDistributed,
    setIsDistributed,
    housekeepers,
    refreshHousekeepers,
    notifications
  } = useHousekeeping();

  // Compteurs par onglet basés sur le journal des actions (daily_action_logs)
  // exposé via le contexte de notifications — afin que le badge "Incidents"
  // et les autres onglets reflètent les actions réelles non lues.
  const { notifications: journalNotifications, markManyAsRead } = useNotificationContext();

  const tabForNotification = useCallback((n: { type?: string; title?: string; description?: string }): TabValue => {
    const type = (n.type || '').toLowerCase();
    const text = `${n.title || ''} ${n.description || ''}`.toLowerCase();
    if (type === 'remark' || text.includes('incident')) return 'incidents';
    if (type === 'assignment') return 'rooms';
    if (type.includes('cleaning') || type === 'room-status') return 'rooms';
    if (text.includes('linge') || text.includes('linen')) return 'linen';
    if (text.includes('objet') || text.includes('lost')) return 'lost-found';
    return 'overview';
  }, []);

  const notificationCounts = useMemo(() => {
    const unread = (journalNotifications || []).filter(n => !n.is_read);
    const counts: Partial<Record<TabValue, number>> = {};
    unread.forEach(n => {
      const tab = tabForNotification(n);
      counts[tab] = (counts[tab] || 0) + 1;
    });
    return counts;
  }, [journalNotifications, tabForNotification]);

  // Quand l'utilisateur ouvre un onglet, on marque comme lues (en un seul batch)
  // les notifications qui lui correspondent → le compteur se vide une fois la
  // source consultée, sans déclencher de boucle de re-rendu.
  const journalRef = useRef(journalNotifications);
  journalRef.current = journalNotifications;
  useEffect(() => {
    const ids = (journalRef.current || [])
      .filter(n => !n.is_read && tabForNotification(n) === activeTab)
      .map(n => n.id);
    if (ids.length > 0) void markManyAsRead(ids);
  }, [activeTab, tabForNotification, markManyAsRead]);
  
  // hotelId est maintenant fourni par le contexte - pas besoin de useAutoSetup
  // const { hotel, accessCode, isSetupComplete, loading: setupLoading } = useAutoSetup();
  
  const { needsSetup, loading: setupCheckLoading } = useFirstTimeSetup(currentHotelId);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showFeatureTour, setShowFeatureTour] = useState(false);
  const [tourStartStep, setTourStartStep] = useState(0);
  
  // Room management hooks
  const {
    handleRoomUpdate,
    handleRoomUnassign,
    handleRoomReassign,
    handleAddRoom,
    handleDeleteRoom,
    handleLinkRooms,
  } = useRoomManagement({
    hotelId: currentHotelId,
    rooms,
    setRooms,
    housekeepers,
    refreshHousekeepers
  });
  
  const {
    housekeeperFloorPreferences,
    setHousekeeperFloorPreferences,
    housekeeperMaxRoomsOverrides,
    setHousekeeperMaxRoomsOverrides,
    handleDeleteHousekeeper,
    handleRenameHousekeeper,
  } = useHousekeeperManagement({
    housekeeperNames,
    setHousekeeperNames,
    setRooms,
    housekeepers,
    refreshHousekeepers
  });
  
  const {
    isManualAssignmentOpen,
    setIsManualAssignmentOpen,
    isReportDialogOpen,
    setIsReportDialogOpen,
    isRedistributionDialogOpen,
    setIsRedistributionDialogOpen,
    isHotelSelectionOpen,
    setIsHotelSelectionOpen,
    showDeleteDialog,
    setShowDeleteDialog,
    showLinkDialog,
    setShowLinkDialog,
    showActionLogPanel,
    setShowActionLogPanel,
    showCreateColumnDialog,
    setShowCreateColumnDialog,
    selectedRoom,
    setSelectedRoom,
    selectedHousekeeper,
    setSelectedHousekeeper,
    reportAction,
    setReportAction,
    reportHousekeeper,
    setReportHousekeeper,
  } = useDashboardDialogs();
  
  const [availableFloors, setAvailableFloors] = useState<number[]>([]);
  const { email, setEmail } = useReportEmail();
  const [reportCustomFields, setReportCustomFields] = useState<CustomReportFields>({ toDoItems: [], toKnowItems: [] });
  const [availableHotels, setAvailableHotels] = useState<any[]>([]);
  const [selectedHotel, setSelectedHotel] = useState<any | null>(null);
  const [hotelCode, setHotelCode] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [filteredRooms, setFilteredRooms] = useState<Room[] | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  
  // PDF workflow hook - gère tout (pause realtime, sync DB, assignations)
  const { isImporting, handlePdfProcessed } = usePdfWorkflow({
    hotelId: currentHotelId,
    cleaningConfig,
    housekeepers,
    setRooms,
    setHousekeeperNames,
    setIsDistributed,
    setAvailableFloors,
    refreshHousekeepers
  });
  
  // Assignment handlers
  const { handleManualAssign, handleDirectRoomAssignment } = useAssignmentHandlers({
    hotelId: currentHotelId,
    rooms,
    setRooms,
    housekeepers,
    refreshHousekeepers,
    setIsAssigning
  });
  
  // Room stats
  const roomStats = useRoomStats(rooms, cleaningConfig);
  const { getHousekeeperRooms, getUnassignedRooms, getCleanRooms, calculateHousekeeperLoad } = useRoomHelpers(rooms);

  // Setup wizard effect
  useEffect(() => {
    if (!setupCheckLoading && needsSetup && isAuthenticated && currentHotelId) {
      setShowSetupWizard(true);
    }
  }, [needsSetup, setupCheckLoading, isAuthenticated, currentHotelId]);
  
  const handleSetupComplete = (newConfig: CleaningConfig) => {
    setCleaningConfig(newConfig);
    setShowSetupWizard(false);
    // Lancer le tutoriel guidé juste après la configuration initiale
    if (!isFeatureTourDone(currentHotelId)) {
      setShowFeatureTour(true);
      markFeatureTourDone(currentHotelId);
    }
  };

  // Démarrer le tutoriel à la première connexion (si pas de wizard en cours)
  useEffect(() => {
    if (
      isAuthenticated &&
      currentHotelId &&
      !showSetupWizard &&
      !setupCheckLoading &&
      !needsSetup &&
      !isFeatureTourDone(currentHotelId)
    ) {
      setShowFeatureTour(true);
      // Marquer comme vu dès l'ouverture auto pour ne plus l'afficher aux connexions suivantes
      markFeatureTourDone(currentHotelId);
    }
  }, [isAuthenticated, currentHotelId, showSetupWizard, setupCheckLoading, needsSetup]);

  const handleFeatureTourClose = () => {
    setShowFeatureTour(false);
    markFeatureTourDone(currentHotelId);
  };

  const handleStartTour = (stepIndex: number = 0) => {
    setTourStartStep(stepIndex);
    setShowFeatureTour(true);
  };

  // Update config based on premium status
  useEffect(() => {
    if (!subscriptionLoading) {
      setCleaningConfig(prevConfig => ({
        ...getDefaultCleaningConfig(isPremium),
        fullCleaningTime: prevConfig.fullCleaningTime,
        quickCleaningTime: prevConfig.quickCleaningTime
      }));
    }
  }, [isPremium, subscriptionLoading]);
  
  // Persist active tab
  useEffect(() => {
    storageService.saveAdminTab(activeTab);
  }, [activeTab]);

  // Cleanup invalid hotel IDs
  useEffect(() => {
    cleanupInvalidHotelIds();
  }, []);

  // Sync hotel code from context
  useEffect(() => {
    if (contextHotelCode) {
      setHotelCode(contextHotelCode);
    }
  }, [contextHotelCode]);
  
  // Realtime handler - IGNORER pendant import pour éviter désassignation
  const handleRealtimeUpdate = useCallback((table: string, payload: any) => {
    // Ignorer les updates realtime pendant l'import
    if (isImporting) {
      return;
    }
    
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    if (table === 'rooms' && (eventType === 'UPDATE' || eventType === 'INSERT')) {
      setRooms(prev => {
        const existingIndex = prev.findIndex(r => r.number === newRecord.room_number);
        if (existingIndex !== -1) {
          return prev.map((r, i) => {
            if (i !== existingIndex) return r;
            let normalizedCleaningType: typeof r.cleaningType = r.cleaningType;
            if (newRecord.cleaning_type === 'full' || newRecord.cleaning_type === 'a_blanc') {
              normalizedCleaningType = 'a_blanc';
            } else if (newRecord.cleaning_type === 'quick' || newRecord.cleaning_type === 'recouche') {
              normalizedCleaningType = 'recouche';
            } else if (newRecord.status === 'checkout' || newRecord.status === 'ready-to-clean') {
              normalizedCleaningType = 'a_blanc';
            }
            // IMPORTANT: Préserver assignedTo pour éviter désassignation
            return { 
              ...r, 
              status: newRecord.status,
              cleaningType: normalizedCleaningType,
              notes: newRecord.notes || r.notes
            };
          });
        }
        return prev;
      });

      if (newRecord.status === 'clean') {
        toast({
          title: "✅ Chambre nettoyée",
          description: `Chambre ${newRecord.room_number} marquée propre`,
          duration: 4000
        });
      }
    }
    
    if (table === 'assignments' && newRecord?.status === 'completed' && currentHotelId) {
      setTimeout(() => refreshHousekeepers?.(), 500);
    }
  }, [currentHotelId, refreshHousekeepers, setRooms, isImporting]);

  const realtimeSync = useRealtimeSync({
    hotelId: currentHotelId || undefined,
    tables: ['rooms', 'assignments'],
    onUpdate: handleRealtimeUpdate
  });

  // Rechargement réutilisable des chambres depuis la base (filet de secours)
  const refetchRooms = useCallback(async () => {
    // Ne pas recharger si une opération est en cours
    if (!currentHotelId || isImporting || isAssigning) return;

    try {
        const { data: roomsData, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('hotel_id', currentHotelId);

        if (error || !roomsData) return;

        // Récupérer les assignations (inclure 'completed' pour ne pas désassigner
        // automatiquement les chambres terminées par la femme de chambre).
        const { data: assignmentsData } = await supabase
          .from('assignments')
          .select('room_id, housekeeper_name')
          .eq('hotel_id', currentHotelId)
          .in('status', ['assigned', 'in_progress', 'completed']);

        const assignmentMap: Record<string, string> = {};
        (assignmentsData || []).forEach((a: any) => {
          assignmentMap[a.room_id] = a.housekeeper_name;
        });

        const mergedRooms: Room[] = roomsData.map((r: any) => {
          const assignment = assignmentMap[r.id];
          let cleaningType: 'a_blanc' | 'recouche' | 'none' = 'a_blanc';
          if (r.cleaning_type === 'full' || r.cleaning_type === 'a_blanc') {
            cleaningType = 'a_blanc';
          } else if (r.cleaning_type === 'quick' || r.cleaning_type === 'recouche') {
            cleaningType = 'recouche';
          } else if (r.cleaning_type === 'none') {
            cleaningType = 'none';
          }
          let status = r.status;
          return {
            number: r.room_number,
            status,
            cleaningType,
            assignedTo: assignment || undefined,
            floor: r.floor || undefined,
            notes: r.notes || undefined,
            isUrgent: r.cleaning_priority === 10,
            notUrgent: r.cleaning_priority === 1,
            isTwin: false,
            priority: r.cleaning_priority === 10 ? 'high' as const : undefined,
            lastCleanedAt: r.last_cleaned_at || r.updated_at || undefined
          };
        });

        setRooms(mergedRooms);
        
        // Extract floors
        const floors = new Set<number>();
        mergedRooms.forEach(room => {
          const floor = room.floor || (room.number.length > 0 ? parseInt(room.number[0]) : 0);
          if (!isNaN(floor)) floors.add(floor);
        });
        setAvailableFloors(Array.from(floors).sort((a, b) => a - b));

        if (mergedRooms.some(r => r.assignedTo)) {
          setIsDistributed(true);
        }
      } catch (error) {
        console.error('Error loading rooms:', error);
      }
    // IMPORTANT: ne PAS inclure `isAssigning` dans les dépendances.
    // Sinon, 2s après chaque affectation (quand isAssigning repasse à false),
    // un rechargement complet se déclenche et peut désassigner les chambres
    // à cause d'une course avec l'écriture en base. Le temps réel gère les MAJ.
  }, [currentHotelId, isImporting, isAssigning, setRooms, setIsDistributed]);

  // Chargement initial des chambres
  useEffect(() => {
    refetchRooms();
  }, [refetchRooms]);

  // Filet de secours: polling + rattrapage à la reconnexion temps réel
  useEffect(() => {
    if (!currentHotelId) return;

    // 1) Polling de secours toutes les 20s (le temps réel reste prioritaire)
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refetchRooms();
      }
    }, 20000);

    // 2) Rattrapage immédiat lorsqu'on récupère la connexion
    const unsubscribe = realtimeManager.onConnectionStatusChange((status) => {
      if (status === 'SUBSCRIBED' || status === 'ONLINE') {
        refetchRooms();
      }
    });

    // 3) Rattrapage au retour de l'onglet (téléphones mis en veille)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refetchRooms();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(intervalId);
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [currentHotelId, refetchRooms]);

  // handlePdfProcessed is now provided by usePdfWorkflow hook

  // Redistribution handler
  const handleRedistribute = async (method: RedistributionMethod, selectedHousekeepers?: string[]) => {
    const housekeepersToUse = selectedHousekeepers && selectedHousekeepers.length > 0 
      ? selectedHousekeepers 
      : housekeeperNames;
    
    if (housekeepersToUse.length === 0 || rooms.length === 0) {
      toast({ variant: "destructive", title: "Erreur", description: "Données manquantes" });
      return;
    }

    if (currentHotelId) {
      await supabase.from('assignments').delete().eq('hotel_id', currentHotelId).in('status', ['assigned']);
    }

    try {
      const redistributedRooms = redistributeRooms(rooms, housekeepersToUse, method);
      setRooms(redistributedRooms);
      setIsDistributed(true);
      setIsRedistributionDialogOpen(false);

      // Persist assignments
      if (currentHotelId) {
        for (const room of redistributedRooms) {
          if (room.assignedTo && room.cleaningType !== 'none' && room.status !== 'maintenance') {
            const hk = housekeepers.find(h => h.name === room.assignedTo);
            const { data: roomData } = await supabase
              .from('rooms')
              .select('id')
              .eq('hotel_id', currentHotelId)
              .eq('room_number', room.number)
              .single();
            
            if (roomData?.id && hk) {
              await AssignmentService.assignRoom(currentHotelId, roomData.id, hk.user_id || hk.id, room.assignedTo);
            }
          }
        }
      }

      const methodName = method === 'random' ? 'aléatoire' : method === 'floor' ? 'par étage' : 'par type';
      toast({ title: "Redistribution terminée", description: `Méthode ${methodName} - ${housekeepersToUse.length} femme${housekeepersToUse.length > 1 ? 's' : ''} de chambre` });
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Erreur lors de la redistribution" });
    }
  };

  const handleConfigChange = (newConfig: CleaningConfig) => setCleaningConfig(newConfig);
  
  const handleHousekeeperNamesChange = (names: string[]) => {
    setHousekeeperNames(names);
    const updatedPreferences: Record<string, number[]> = {};
    names.forEach(name => {
      updatedPreferences[name] = housekeeperFloorPreferences[name] || [];
    });
    setHousekeeperFloorPreferences(updatedPreferences);
  };

  const handleDistributeWithValidation = async () => {
    // Utilise les infos du contexte / session — pas de saisie manuelle
    const effectiveHotelCode = (contextHotelCode || hotelCode || '').trim();
    const effectiveEmail = (user?.email || userEmail || '').trim();

    if (housekeeperNames.length === 0 || rooms.length === 0) {
      toast({ variant: "destructive", title: t.toasts.missingData, description: t.toasts.missingDataDesc });
      return;
    }

    if (!effectiveHotelCode || !effectiveEmail) {
      toast({ variant: "destructive", title: t.toasts.missingInfo, description: t.toasts.missingDataDesc });
      return;
    }

    try {
      const deterministicHotelId = generateHotelId(effectiveHotelCode);
      let hotel = await SupabaseService.getHotelByCode(effectiveHotelCode);

      if (!hotel) {
        hotel = await SupabaseService.createHotelWithId(deterministicHotelId, hotelName || `Hôtel ${effectiveHotelCode}`, effectiveEmail, effectiveHotelCode);
      }

      if (!hotel?.id) {
        toast({ variant: "destructive", title: t.toasts.genericError, description: t.toasts.hotelCreateError });
        return;
      }

      storageService.saveHotel({ id: hotel.id, name: hotel.name || `Hôtel ${effectiveHotelCode}`, code: effectiveHotelCode });

      setSelectedHotel(hotel);
      await handleRedistribute('random');
    } catch (error) {
      toast({ variant: "destructive", title: t.toasts.distributionError, description: t.toasts.distributionErrorDesc });
    }
  };

  const handleHotelSelection = (hotel: any) => {
    setSelectedHotel(hotel);
    storageService.saveHotel({ id: hotel.id, name: hotel.name, code: hotel.hotel_code || '' });
    setIsHotelSelectionOpen(false);
    toast({ title: "Hôtel sélectionné", description: `${hotel.name} sélectionné` });
    setTimeout(() => handleRedistribute('random'), 500);
  };

  const openManualAssignment = (housekeeperName?: string) => {
    setSelectedHousekeeper(housekeeperName || "");
    setIsManualAssignmentOpen(true);
  };

  const handleGenerateReport = async (name: string, housekeeperRooms: Room[]) => {
    setReportAction("single");
    setReportHousekeeper(name);
    setIsReportDialogOpen(true);
  };

  const handleGenerateAllReports = async () => {
    setReportAction("all");
    setIsReportDialogOpen(true);
  };

  const handleReportConfirm = async (confirmedEmail: string, customFields: CustomReportFields) => {
    setEmail(confirmedEmail);
    setReportCustomFields(customFields);
    setIsReportDialogOpen(false);
    
    try {
      if (reportAction === "single") {
        const housekeeperRooms = getHousekeeperRooms(reportHousekeeper);
        await generateReport(reportHousekeeper, housekeeperRooms, cleaningConfig, customFields, currentHotelId || undefined);
        toast({ title: "Rapport envoyé", description: `Rapport pour ${reportHousekeeper} créé.` });
      } else {
        const housekeepersWithRooms = housekeeperNames.filter(name => getHousekeeperRooms(name).length > 0);
        if (housekeepersWithRooms.length === 0) {
          toast({ variant: "destructive", title: "Aucune chambre assignée" });
          return;
        }
        await generateCombinedReport(
          housekeepersWithRooms.map(name => ({ name, rooms: getHousekeeperRooms(name) })), 
          cleaningConfig,
          customFields,
          currentHotelId || undefined
        );
        toast({ title: "Rapports créés", description: `${housekeepersWithRooms.length} rapports générés.` });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de générer les rapports." });
    }
  };

  // Note: Auth check is now done at the top of the component

  // Onboarding check
  const { needsOnboarding, isTrialExpired, trialWarningLevel, isLoading: onboardingLoading } = useOnboarding();
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);

  // Show onboarding wizard for new users
  useEffect(() => {
    if (!onboardingLoading && needsOnboarding && isAuthenticated) {
      setShowOnboardingWizard(true);
    }
  }, [needsOnboarding, onboardingLoading, isAuthenticated]);

  // Block access if trial expired
  if (isTrialExpired && !subscriptionLoading) {
    return <TrialExpiredBlocker />;
  }

  return (
    <>
      {/* Onboarding Wizard for new users */}
      <OnboardingWizard
        isOpen={showOnboardingWizard}
        onComplete={() => setShowOnboardingWizard(false)}
      />

      {currentHotelId && (
        <FirstTimeSetupWizard
          isOpen={showSetupWizard && !showOnboardingWizard}
          onComplete={handleSetupComplete}
          hotelCode={contextHotelCode || ''}
          hotelId={currentHotelId}
          isPremium={isPremium}
        />
      )}

      <FeatureTour
        isOpen={showFeatureTour && !showOnboardingWizard && !showSetupWizard}
        onTabChange={setActiveTab}
        onClose={handleFeatureTourClose}
        initialStep={tourStartStep}
      />

      {!isGuestMode && currentHotelId && !showFeatureTour && !showSetupWizard && !showOnboardingWizard && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              className="fixed bottom-20 right-4 z-50 rounded-full shadow-lg gap-2 sm:bottom-6"
            >
              <GraduationCap className="h-4 w-4" />
              {language === 'fr' ? 'Tutoriel' : 'Tutorial'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-[60vh] w-64 overflow-y-auto">
            <DropdownMenuItem onClick={() => handleStartTour(0)} className="font-medium">
              {language === 'fr' ? '▶ Revoir tout depuis le début' : '▶ Replay from the start'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>
              {language === 'fr' ? 'Revoir une fonctionnalité' : 'Review a feature'}
            </DropdownMenuLabel>
            {TOUR_TOPICS.slice(1).map((topic) => (
              <DropdownMenuItem key={topic.index} onClick={() => handleStartTour(topic.index)}>
                {topic.title[language === 'fr' ? 'fr' : 'en']}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <NotificationSound />

      
      <MainLayout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isPremium={isPremium}
        isFree={isFree}
        isGuestMode={isGuestMode}
        isConnected={isPlatformConnected}
        hotelName={hotelName || undefined}
        hotelCode={contextHotelCode || undefined}
        currentHotelId={currentHotelId}
        subscriptionLoading={subscriptionLoading}
        onStartWorkflow={() => setActiveTab('overview')}
        notificationCounts={notificationCounts}
      >
        {/* Trial expiry banner */}
        {trialWarningLevel > 0 && (
          <div className="mb-4">
            <TrialExpiryBanner />
          </div>
        )}
        
        <HeroHeader hotelName={hotelName || undefined} isPremium={isPremium} />

        {!isGuestMode && currentHotelId && (
          <div className="mt-6">
            <NewDayBanner
              hotelId={currentHotelId}
              roomsEmpty={rooms.length === 0}
              onStarted={refetchRooms}
            />
          </div>
        )}

        <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
        <div className="space-y-6 mt-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <OverviewTab
              rooms={rooms}
              housekeeperNames={housekeeperNames}
              cleaningConfig={cleaningConfig}
              isPremium={isPremium}
              currentHotelId={currentHotelId}
              roomStats={roomStats}
              onPdfProcessed={handlePdfProcessed}
              onConfigChange={handleConfigChange}
              onHousekeeperNamesChange={handleHousekeeperNamesChange}
              onDistribute={handleDistributeWithValidation}
            />
          )}

          {/* Rooms Tab */}
          {activeTab === 'rooms' && (
            <RoomManagementTab
              rooms={rooms}
              housekeeperNames={housekeeperNames}
              currentHotelId={currentHotelId}
              onPdfProcessed={handlePdfProcessed}
              onAddRoom={handleAddRoom}
              onRoomUpdate={handleRoomUpdate}
              onRoomUnassign={handleRoomUnassign}
              onRoomReassign={handleRoomReassign}
              onOpenManualAssignment={() => openManualAssignment()}
              onDeleteRoom={handleDeleteRoom}
              onLinkRooms={(roomNumber) => { 
                const room = rooms.find(r => r.number === roomNumber);
                if (room) { setSelectedRoom(room); setShowLinkDialog(true); }
              }}
            />
          )}

          {/* Assignment Tab */}
          {activeTab === 'assignment' && (
            <AssignmentTab
              rooms={rooms}
              housekeeperNames={housekeeperNames}
              housekeepers={housekeepers}
              cleaningConfig={cleaningConfig}
              currentHotelId={currentHotelId}
              hotelId={currentHotelId || ''}
              availableFloors={availableFloors}
              housekeeperFloorPreferences={housekeeperFloorPreferences}
              housekeeperMaxRoomsOverrides={housekeeperMaxRoomsOverrides}
              isDistributed={isDistributed}
              onPdfProcessed={handlePdfProcessed}
              onRedistribute={handleRedistribute}
              onRoomUpdate={handleRoomUpdate}
              onRoomUnassign={handleRoomUnassign}
              onRoomReassign={handleRoomReassign}
              onDirectAssign={handleDirectRoomAssignment}
              onFloorPreferenceChange={(name, floors) => setHousekeeperFloorPreferences(prev => ({ ...prev, [name]: floors }))}
              onDeleteHousekeeper={handleDeleteHousekeeper}
              onMaxRoomsOverrideChange={(name, maxRooms) => setHousekeeperMaxRoomsOverrides(prev => ({ ...prev, [name]: maxRooms || 0 }))}
              onRenameHousekeeper={handleRenameHousekeeper}
              onGenerateReport={handleGenerateReport}
              onGenerateAccessCode={async (name) => housekeepers.find(h => h.name === name)?.access_code || ''}
              onOpenManualAssignment={openManualAssignment}
              setActiveTab={(tab: string) => setActiveTab(tab as TabValue)}
            />
          )}

          {/* Access Codes Tab */}
          {activeTab === 'access-codes' && (
            <PremiumLimitGuard 
              feature="access_codes" 
              title="Codes d'accès"
              description="Gérez les codes d'accès de vos femmes de chambre avec la version Premium."
            >
              <AccessCodesTab currentHotelId={currentHotelId} />
            </PremiumLimitGuard>
          )}

          {/* Linen Tab */}
          {activeTab === 'linen' && (
            <PremiumLimitGuard 
              feature="linen_inventory" 
              title="Inventaire du linge"
              description="Gérez l'inventaire du linge de votre établissement avec la version Premium."
            >
              <LinenTab currentHotelId={currentHotelId} />
            </PremiumLimitGuard>
          )}

          {/* Incidents Tab */}
          {activeTab === 'incidents' && (
            <PremiumLimitGuard 
              feature="incidents" 
              title="Gestion des incidents"
              description="Suivez et gérez les incidents de votre établissement avec la version Premium."
            >
              <IncidentsTab currentHotelId={currentHotelId} />
            </PremiumLimitGuard>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <ReportsTab
              rooms={rooms}
              housekeeperNames={housekeeperNames}
              cleaningConfig={cleaningConfig}
              isDistributed={isDistributed}
              hotelId={currentHotelId}
              onGenerateReport={handleGenerateReport}
              onGenerateAllReports={handleGenerateAllReports}
            />
          )}

          {/* Training Tab */}
          {activeTab === 'training' && (
            <TrainingTab currentHotelId={currentHotelId} />
          )}

          {/* Archives Tab */}
          {activeTab === 'archives' && (
            <ArchivesTab currentHotelId={currentHotelId} />
          )}

          {/* Templates Tab */}
          {activeTab === 'templates' && currentHotelId && (
            <TaskTemplateManager hotelId={currentHotelId} />
          )}

          {/* Tickets Tab */}
          {activeTab === 'tickets' && currentHotelId && (
            <ManualTaskManager
              hotelId={currentHotelId}
              housekeeperNames={housekeeperNames}
              governessNames={[]}
              technicianNames={[]}
            />
          )}


          {/* Inspections Tab */}
          {activeTab === 'inspections' && (
            <PremiumLimitGuard 
              feature="inspection" 
              title="Inspection des chambres"
              description="Inspectez et validez le nettoyage des chambres avec la version Premium."
            >
              {currentHotelId && (
                <GovernessInspectionInterface
                  hotelId={currentHotelId}
                  governessName="Gouvernante"
                />
              )}
            </PremiumLimitGuard>
          )}

          {/* Lost & Found Tab */}
          {activeTab === 'lost-found' && (
            <PremiumLimitGuard 
              feature="lost_found" 
              title="Objets Trouvés"
              description="Gérez les objets trouvés et leur restitution aux clients avec la version Premium."
            >
              <LostAndFoundTab currentHotelId={currentHotelId} />
            </PremiumLimitGuard>
          )}
        </div>
        </Suspense>
      </MainLayout>

      {/* Dialogs */}
      <ManualAssignmentDialog
        isOpen={isManualAssignmentOpen}
        onClose={() => setIsManualAssignmentOpen(false)}
        rooms={rooms}
        housekeeperNames={housekeeperNames}
        onAssignRooms={handleManualAssign}
        housekeeperPreferredFloors={housekeeperFloorPreferences}
      />
      
      <EmailReportDialog
        isOpen={isReportDialogOpen}
        onClose={() => setIsReportDialogOpen(false)}
        onConfirm={handleReportConfirm}
        initialEmail={email}
        housekeeperName={reportAction === "single" ? reportHousekeeper : undefined}
        allHousekeepers={housekeeperNames.filter(name => getHousekeeperRooms(name).length > 0)}
        hotelId={selectedHotel?.id || undefined}
        checkedOutCount={rooms.filter(r => r.status === 'checkout' || r.cleaningType === 'a_blanc').length}
      />
      
      {showDeleteDialog && selectedRoom && (
        <DeleteRoomDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          room={selectedRoom}
          onDeleteRoom={handleDeleteRoom}
        />
      )}

      {showLinkDialog && selectedRoom && (
        <LinkRoomsDialog
          open={showLinkDialog}
          onOpenChange={setShowLinkDialog}
          room={selectedRoom}
          allRooms={rooms}
          onLinkRooms={handleLinkRooms}
        />
      )}
      
      <HotelSelectionDialog
        isOpen={isHotelSelectionOpen}
        onOpenChange={setIsHotelSelectionOpen}
        availableHotels={availableHotels}
        onSelectHotel={handleHotelSelection}
      />

      <RedistributionDialog
        isOpen={isRedistributionDialogOpen}
        onClose={() => setIsRedistributionDialogOpen(false)}
        onRedistribute={handleRedistribute}
        housekeeperCount={housekeeperNames.length}
        roomCount={rooms.filter(r => r.cleaningType !== 'none' && r.status !== 'maintenance').length}
        housekeeperNames={housekeeperNames}
        onAddHousekeeper={() => {
          setIsRedistributionDialogOpen(false);
          setActiveTab('access-codes');
        }}
      />

      <DailyActionLogPanel
        isOpen={showActionLogPanel}
        onClose={() => setShowActionLogPanel(false)}
        hotelId={currentHotelId || ''}
      />
    </>
  );
};

export default Index;
