import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserIcon, FileText, Calendar, Layers, Plus, FileDown, AlertTriangle, Bed, Smartphone, Building, Key, LogIn, Bell } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import UserMenu from "@/components/UserMenu";
import { PdfWorkflowDialog } from "@/components/PdfWorkflowDialog";
import { ActiveUsersPanel } from "@/components/ActiveUsersPanel";
import { useSessionTracking } from "@/hooks/use-session-tracking";
import { Room, CleaningConfig, getDefaultCleaningConfig } from "@/services/pdfService";
import { Badge } from "@/components/ui/badge";
import { HousekeeperCard } from "@/components/HousekeeperCard";
import { UnassignedRoomsColumn } from "@/components/UnassignedRoomsColumn";
import { CleanRoomsSection } from "@/components/CleanRoomsSection";
import { generateReport, generateCombinedReport } from "@/services/reportService";
import { toast } from "@/hooks/use-toast";
import { ManualAssignmentDialog } from "@/components/ManualAssignmentDialog";
import { supabase } from "@/integrations/supabase/client";
import { useReportEmail } from "@/hooks/use-report-email";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import EmailReportDialog from "@/components/EmailReportDialog";
import { QuickAddHousekeeperButton } from "@/components/QuickAddHousekeeperButton";
import { CreateColumnDialog } from "@/components/CreateColumnDialog";
import { SyncHousekeepersButton } from "@/components/SyncHousekeepersButton";
import { RedistributionDialog, RedistributionMethod } from "@/components/RedistributionDialog";
import { ReportFields as CustomReportFields } from "@/components/ReportCustomFields";
import { useHousekeeping } from "@/contexts/HousekeepingContext";
import { NotificationBell } from "@/components/NotificationBell";
import { DailyReportCloseButton } from "@/components/DailyReportCloseButton";
import { DailyActionLogPanel } from "@/components/DailyActionLogPanel";
import { NotificationSound } from "@/components/NotificationSound";
import { RoomFilters } from "@/components/RoomFilters";
import { HousekeeperManagement } from "@/components/HousekeeperManagement";
import { IncidentList } from "@/components/incident/IncidentList";
import { useNotificationContext } from "@/contexts/NotificationContext";
import { LinenTypeManager } from "@/components/linen/LinenTypeManager";
import { LinenTrainingManager } from "@/components/linen/LinenTrainingManager";
import { LinenTaskAssignment } from "@/components/linen/LinenTaskAssignment";
import { AdminLinenInventory } from "@/components/linen/AdminLinenInventory";
import { StaffManagement } from "@/components/incident/StaffManagement";
import { IncidentInventoryManager } from "@/components/incident/IncidentInventoryManager";
import { IncidentReportDialogSimple } from "@/components/incident/IncidentReportDialogSimple";
import { IncidentDashboard } from "@/components/incident/IncidentDashboard";
import { RolePermissionsManager } from "@/components/incident/RolePermissionsManager";
import { IncidentReportPrint } from "@/components/incident/IncidentReportPrint";
import { HousekeeperAccessRequests } from "@/components/HousekeeperAccessRequests";
import { SupabaseService } from "@/services/supabaseService";
import { AssignmentService } from "@/services/assignmentService";
import { AddRoomDialog } from "@/components/AddRoomDialog";
import { DeleteRoomDialog } from "@/components/DeleteRoomDialog";
import { LinkRoomsDialog } from "@/components/LinkRoomsDialog";
import { useAutoSetup } from "@/hooks/use-auto-setup";
import { generateHotelId, cleanupInvalidHotelIds } from "@/lib/utils";
import { redistributeRooms, getDistributionStats } from "@/utils/redistributionUtils";
import { UpgradeButton } from "@/components/UpgradeButton";
import { useSubscription } from "@/hooks/useSubscription";
import { HeroHeader } from "@/components/HeroHeader";
import { StatsOverview } from "@/components/StatsOverview";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { FirstTimeSetupWizard, useFirstTimeSetup } from "@/components/FirstTimeSetupWizard";
import { useRoomManagement } from "@/hooks/use-room-management";
import { useHousekeeperManagement } from "@/hooks/use-housekeeper-management";
import { useDashboardDialogs } from "@/hooks/use-dashboard-dialogs";

// New refactored components
import { QuickActionsCard } from "@/components/dashboard/QuickActionsCard";
import { PlanningSummaryCard } from "@/components/dashboard/PlanningSummaryCard";
import { PersonnelSection } from "@/components/dashboard/PersonnelSection";
import { HotelSelectionDialog } from "@/components/dashboard/HotelSelectionDialog";
import { RoomsTable } from "@/components/dashboard/RoomsTable";
import { useRoomStats, useRoomHelpers } from "@/hooks/use-room-stats";
import { useAssignmentHandlers } from "@/hooks/use-assignment-handlers";

const Index = () => {
  const [searchParams] = useSearchParams();
  const { isAuthenticated, loading } = useAuth();
  const isGuestMode = searchParams.get('mode') === 'guest';
  const navigate = useNavigate();
  const location = useLocation();
  
  const { plan, isPremium, isFree, canAccessFeature, loading: subscriptionLoading } = useSubscription();
  
  useSessionTracking();
  
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('nettobloc_admin_tab') || 'overview');
  const [cleaningConfig, setCleaningConfig] = useState<CleaningConfig>(getDefaultCleaningConfig(isPremium));
  
  const { 
    housekeeperNames, 
    setHousekeeperNames,
    rooms,
    setRooms,
    isDistributed,
    setIsDistributed,
    housekeepers,
    refreshHousekeepers
  } = useHousekeeping();
  
  const { hotel, accessCode, isSetupComplete, loading: setupLoading } = useAutoSetup();
  const currentHotelId = hotel?.id || null;
  
  const { needsSetup, loading: setupCheckLoading } = useFirstTimeSetup(currentHotelId);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  
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
  
  // Assignment handlers
  const { handleManualAssign, handleDirectRoomAssignment } = useAssignmentHandlers({
    hotelId: currentHotelId,
    rooms,
    setRooms,
    housekeepers,
    refreshHousekeepers
  });
  
  // Room stats
  const roomStats = useRoomStats(rooms, cleaningConfig);
  const { getHousekeeperRooms, getUnassignedRooms, getCleanRooms, calculateHousekeeperLoad } = useRoomHelpers(rooms);
  
  const [availableFloors, setAvailableFloors] = useState<number[]>([]);
  const { email, setEmail } = useReportEmail();
  const [reportCustomFields, setReportCustomFields] = useState<CustomReportFields>({ toDoItems: [], toKnowItems: [] });
  const [availableHotels, setAvailableHotels] = useState<any[]>([]);
  const [selectedHotel, setSelectedHotel] = useState<any | null>(null);
  const [hotelCode, setHotelCode] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [filteredRooms, setFilteredRooms] = useState<Room[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Setup wizard effect
  useEffect(() => {
    if (!setupCheckLoading && needsSetup && isAuthenticated && currentHotelId) {
      setShowSetupWizard(true);
    }
  }, [needsSetup, setupCheckLoading, isAuthenticated, currentHotelId]);
  
  const handleSetupComplete = (newConfig: CleaningConfig) => {
    setCleaningConfig(newConfig);
    setShowSetupWizard(false);
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
    localStorage.setItem('nettobloc_admin_tab', activeTab);
  }, [activeTab]);

  // Cleanup invalid hotel IDs
  useEffect(() => {
    cleanupInvalidHotelIds();
  }, []);

  // Sync hotel code
  useEffect(() => {
    if (hotel?.hotel_code) {
      setHotelCode(hotel.hotel_code);
    }
  }, [hotel?.hotel_code]);
  
  // Realtime handler
  const handleRealtimeUpdate = useCallback((table: string, payload: any) => {
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
            }
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
  }, [currentHotelId, refreshHousekeepers, setRooms]);

  const realtimeSync = useRealtimeSync({
    hotelId: currentHotelId || undefined,
    tables: ['rooms', 'assignments'],
    onUpdate: handleRealtimeUpdate
  });

  // Load rooms from database
  useEffect(() => {
    const loadRoomsFromDatabase = async () => {
      if (!currentHotelId || isImporting) return;
      
      try {
        const { data: roomsData, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('hotel_id', currentHotelId);

        if (error || !roomsData) return;

        const { data: assignmentsData } = await supabase
          .from('assignments')
          .select('room_id, housekeeper_name')
          .eq('hotel_id', currentHotelId)
          .in('status', ['assigned', 'in_progress']);

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
          return {
            number: r.room_number,
            status: r.status,
            cleaningType,
            assignedTo: assignment || undefined,
            floor: r.floor || undefined,
            notes: r.notes || undefined,
            isUrgent: r.cleaning_priority === 10,
            notUrgent: r.cleaning_priority === 1,
            isTwin: false,
            priority: r.cleaning_priority === 10 ? 'high' as const : undefined
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
    };

    loadRoomsFromDatabase();
    const interval = setInterval(loadRoomsFromDatabase, 120000);
    return () => clearInterval(interval);
  }, [currentHotelId, isImporting, setRooms, setIsDistributed]);

  // PDF processing handler
  const handlePdfProcessed = async (data: Room[], housekeeperNamesParam?: string[], distributionMethod?: 'random' | 'floor' | 'cleaning-type') => {
    setIsImporting(true);
    
    try {
      const floors = new Set<number>();
      data.forEach(room => {
        const floor = room.number.length > 0 ? parseInt(room.number[0]) : 0;
        floors.add(floor);
        room.floor = floor;
        room.isTwin = false;
      });
      setAvailableFloors(Array.from(floors).sort((a, b) => a - b));
      
      const sortedData = [...data].sort((a, b) => 
        a.number.localeCompare(b.number, undefined, { numeric: true })
      );

      if (housekeeperNamesParam && housekeeperNamesParam.length > 0) {
        setHousekeeperNames(housekeeperNamesParam);
      }

      // Sync to Supabase
      if (currentHotelId) {
        for (const room of sortedData) {
          let normalizedCleaningType: string | null = null;
          if (room.cleaningType === 'full' || room.cleaningType === 'a_blanc') {
            normalizedCleaningType = 'full';
          } else if (room.cleaningType === 'quick' || room.cleaningType === 'recouche') {
            normalizedCleaningType = 'quick';
          } else if (room.cleaningType === 'none') {
            normalizedCleaningType = 'none';
          }
          
          await supabase.from('rooms').upsert({
            hotel_id: currentHotelId,
            room_number: room.number,
            floor: room.floor || null,
            status: room.status || 'needs-cleaning',
            cleaning_type: normalizedCleaningType,
            cleaning_priority: room.isUrgent ? 10 : (room.notUrgent ? 1 : 5),
            notes: room.notes || null
          }, { 
            onConflict: 'hotel_id,room_number',
            ignoreDuplicates: false 
          });
        }
      }

      // Auto-distribute if method specified
      if (distributionMethod && housekeeperNamesParam && housekeeperNamesParam.length > 0) {
        const roomsPerHousekeeper = Math.ceil(sortedData.length / housekeeperNamesParam.length);
        const updatedRooms = sortedData.map((room, index) => {
          const housekeeperIndex = Math.floor(index / roomsPerHousekeeper);
          const assignedHousekeeper = housekeeperNamesParam[housekeeperIndex] || housekeeperNamesParam[0];
          return { ...room, assignedTo: assignedHousekeeper };
        });
        setRooms(updatedRooms);
        setIsDistributed(true);
        
        // Persist assignments
        if (currentHotelId && housekeepers.length > 0) {
          for (const room of updatedRooms) {
            if (room.assignedTo) {
              const hk = housekeepers.find(h => h.name === room.assignedTo);
              const { data: roomData } = await supabase
                .from('rooms')
                .select('id')
                .eq('hotel_id', currentHotelId)
                .eq('room_number', room.number)
                .single();
              
              const housekeeperId = hk?.user_id && hk.user_id !== 'null' ? hk.user_id : 
                                    hk?.id && hk.id !== 'null' ? hk.id : null;
              
              if (roomData?.id && housekeeperId) {
                await AssignmentService.assignRoom(currentHotelId, roomData.id, housekeeperId, room.assignedTo);
              }
            }
          }
        }
      } else {
        setRooms(sortedData);
        setIsDistributed(false);
      }
      
      toast({
        title: "PDF traité avec succès",
        description: `${data.length} chambres importées${distributionMethod ? ` et distribuées (${distributionMethod})` : ''}`
      });
    } finally {
      setTimeout(() => setIsImporting(false), 3000);
    }
  };

  // Redistribution handler
  const handleRedistribute = async (method: RedistributionMethod) => {
    if (housekeeperNames.length === 0 || rooms.length === 0) {
      toast({ variant: "destructive", title: "Erreur", description: "Données manquantes" });
      return;
    }

    if (currentHotelId) {
      await supabase.from('assignments').delete().eq('hotel_id', currentHotelId).in('status', ['assigned']);
    }

    try {
      const redistributedRooms = redistributeRooms(rooms, housekeeperNames, method);
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
      toast({ title: "Redistribution terminée", description: `Méthode ${methodName}` });
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
    if (!hotelCode.trim() || !userEmail.trim()) {
      toast({ variant: "destructive", title: "Informations manquantes", description: "Renseignez le code hôtel et votre email." });
      return;
    }
    
    if (housekeeperNames.length === 0 || rooms.length === 0) {
      toast({ variant: "destructive", title: "Données manquantes", description: "Ajoutez des chambres et des femmes de chambre." });
      return;
    }

    try {
      const deterministicHotelId = generateHotelId(hotelCode);
      let hotel = await SupabaseService.getHotelByCode(hotelCode);
      
      if (!hotel) {
        hotel = await SupabaseService.createHotelWithId(deterministicHotelId, `Hôtel ${hotelCode}`, userEmail, hotelCode);
      }
      
      if (!hotel?.id) {
        toast({ variant: "destructive", title: "Erreur", description: "Impossible de créer l'hôtel" });
        return;
      }

      localStorage.setItem('selectedHotelCode', hotelCode);
      localStorage.setItem('userEmail', userEmail);
      localStorage.setItem('selectedHotelId', hotel.id);
      localStorage.setItem('hotelId', hotel.id);
      
      setSelectedHotel(hotel);
      await handleRedistribute('random');
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Erreur de configuration" });
    }
  };

  const handleHotelSelection = (hotel: any) => {
    setSelectedHotel(hotel);
    localStorage.setItem('selectedHotelId', hotel.id);
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
        await generateReport(reportHousekeeper, housekeeperRooms, cleaningConfig, customFields);
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
          customFields
        );
        toast({ title: "Rapports créés", description: `${housekeepersWithRooms.length} rapports générés.` });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de générer les rapports." });
    }
  };

  // Auth redirect
  if (!loading && !isAuthenticated && !isGuestMode) {
    return <Navigate to="/auth" replace />;
  }
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">NettoBloc</CardTitle>
            <CardDescription>Accès nécessaire pour continuer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">Vous devez être connecté pour accéder à l'interface de gestion.</p>
            <div className="space-y-2">
              <Button onClick={() => navigate("/auth")} className="w-full">Se connecter / S'inscrire</Button>
              <Button variant="outline" onClick={() => navigate("/housekeeper-login")} className="w-full">Accès Femme de Chambre</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {hotel && (
        <FirstTimeSetupWizard
          isOpen={showSetupWizard}
          onComplete={handleSetupComplete}
          hotelCode={hotel.hotel_code || ''}
          hotelId={hotel.id}
          isPremium={isPremium}
        />
      )}
      
      <div className="container mx-auto py-6 px-4 md:px-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
                <Building className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  HotelFlow
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  {isGuestMode && <Badge variant="outline" className="text-xs">Mode Invité</Badge>}
                  {!subscriptionLoading && (
                    <Badge 
                      variant="secondary"
                      className={isPremium ? "bg-gradient-premium text-premium-foreground text-xs border-0" : "bg-gradient-freemium text-freemium-foreground text-xs border-0"}
                    >
                      {isPremium ? "Premium" : "Freemium"}
                    </Badge>
                  )}
                  {hotel && <span className="text-xs text-muted-foreground">{hotel.name} • {hotel.hotel_code}</span>}
                </div>
              </div>
            </div>
            {isFree && <UpgradeButton variant="outline" size="sm" className="h-8 px-4 text-xs" />}
          </div>
          
          <div className="flex items-center space-x-4">
            <Badge variant={realtimeSync.isConnected ? "default" : "destructive"} className="h-8 gap-2">
              <div className={`h-2 w-2 rounded-full ${realtimeSync.isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              {realtimeSync.isConnected ? 'Temps réel actif' : 'Déconnecté'}
            </Badge>
            <Button asChild><a href="/housekeeper/auth"><UserIcon className="mr-2 h-4 w-4" />Espace Personnel</a></Button>
            <DailyReportCloseButton hotelId={currentHotelId || hotel?.id || ''} onReportClosed={() => window.location.reload()} />
            <NotificationBell />
            <UserMenu />
          </div>
        </div>

        <NotificationSound />
        <HeroHeader hotelName={hotel?.name} isPremium={isPremium} />
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" orientation="vertical">
          <div className="flex gap-6">
            {/* Sidebar */}
            <div className="hidden md:flex flex-col w-56 shrink-0">
              <TabsList className="flex flex-col h-auto bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-2 sticky top-4 shadow-lg">
                <TabsTrigger value="overview" className="w-full justify-start gap-3 px-4 py-3 text-left data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg transition-all">
                  <Layers className="h-5 w-5" /><span>Vue d'ensemble</span>
                </TabsTrigger>
                <TabsTrigger value="rooms" className="w-full justify-start gap-3 px-4 py-3 text-left data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg transition-all">
                  <Bed className="h-5 w-5" /><span>Chambres</span>
                </TabsTrigger>
                <TabsTrigger value="assignment" className="w-full justify-start gap-3 px-4 py-3 text-left data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg transition-all">
                  <UserIcon className="h-5 w-5" /><span>Affectation</span>
                </TabsTrigger>
                <TabsTrigger value="access-codes" className="w-full justify-start gap-3 px-4 py-3 text-left data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg transition-all relative">
                  <Key className="h-5 w-5" /><span>Codes d'accès</span>
                  <Badge variant="destructive" className="ml-auto h-5 w-5 p-0 flex items-center justify-center text-xs animate-pulse">!</Badge>
                </TabsTrigger>
                <TabsTrigger value="linen" className="w-full justify-start gap-3 px-4 py-3 text-left data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg transition-all">
                  <span className="text-lg">🧺</span><span>Inventaire Linge</span>
                </TabsTrigger>
                <TabsTrigger value="incidents" className="w-full justify-start gap-3 px-4 py-3 text-left data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg transition-all">
                  <AlertTriangle className="h-5 w-5" /><span>Incidents</span>
                </TabsTrigger>
                <TabsTrigger value="reports" className="w-full justify-start gap-3 px-4 py-3 text-left data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg transition-all">
                  <FileText className="h-5 w-5" /><span>Rapports</span>
                </TabsTrigger>
              </TabsList>
            </div>
            
            {/* Main Content */}
            <div className="flex-1 min-w-0">
              <TabsContent value="overview" className="space-y-6 mt-0">
                <StatsOverview 
                  rooms={rooms}
                  housekeeperCount={housekeeperNames.length}
                />

                <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
                  <QuickActionsCard
                    currentHotelId={currentHotelId}
                    cleaningConfig={cleaningConfig}
                    housekeeperNames={housekeeperNames}
                    rooms={rooms}
                    isPremium={isPremium}
                    onPdfProcessed={handlePdfProcessed}
                    onConfigChange={handleConfigChange}
                    onHousekeeperNamesChange={handleHousekeeperNamesChange}
                    onDistribute={handleDistributeWithValidation}
                  />
                  <PlanningSummaryCard
                    twinRooms={roomStats.twinRooms}
                    fullCleaningRooms={roomStats.fullCleaningRooms}
                    quickCleaningRooms={roomStats.quickCleaningRooms}
                    housekeeperCount={housekeeperNames.length}
                    cleaningConfig={cleaningConfig}
                  />
                </div>
                
                <ActiveUsersPanel />
                <PersonnelSection housekeeperCount={housekeeperNames.length} />
              </TabsContent>

              <TabsContent value="rooms" className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Gestion des chambres</h2>
                  <div className="flex gap-2">
                    <AddRoomDialog onAddRoom={handleAddRoom} existingRooms={rooms} />
                    <PdfWorkflowDialog hotelId={currentHotelId} onWorkflowComplete={handlePdfProcessed} />
                    <Button onClick={() => openManualAssignment()} variant="outline" disabled={housekeeperNames.length === 0}>
                      <Plus className="mr-2 h-4 w-4" />Assignation manuelle
                    </Button>
                  </div>
                </div>

                {rooms.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Aucune chambre importée</h3>
                      <p className="text-muted-foreground text-center mb-4">Importez un fichier PDF ou ajoutez des chambres manuellement</p>
                      <div className="flex gap-2 justify-center">
                        <AddRoomDialog onAddRoom={handleAddRoom} existingRooms={rooms} />
                        <PdfWorkflowDialog hotelId={currentHotelId} onWorkflowComplete={handlePdfProcessed} />
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <Card>
                      <CardHeader><CardTitle>Filtres et options</CardTitle></CardHeader>
                      <CardContent>
                        <RoomFilters rooms={rooms} onFiltersChange={(filtered) => setFilteredRooms(filtered)} />
                      </CardContent>
                    </Card>
                    <RoomsTable
                      rooms={filteredRooms || rooms}
                      housekeeperNames={housekeeperNames}
                      onRoomUpdate={handleRoomUpdate}
                      onRoomUnassign={handleRoomUnassign}
                      onRoomReassign={handleRoomReassign}
                      onOpenLinkDialog={(room) => { setSelectedRoom(room); setShowLinkDialog(true); }}
                      onOpenDeleteDialog={(room) => { setSelectedRoom(room); setShowDeleteDialog(true); }}
                    />
                  </>
                )}
              </TabsContent>

              <TabsContent value="assignment" className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Affectation des chambres</h2>
                  <div className="flex gap-2">
                    <Button onClick={() => openManualAssignment()} disabled={!isDistributed} variant="outline">
                      <UserIcon className="mr-2 h-4 w-4" />Assignation manuelle
                    </Button>
                    <Button onClick={() => setIsRedistributionDialogOpen(true)} disabled={!isDistributed} variant="outline">
                      <Calendar className="mr-2 h-4 w-4" />Redistribuer
                    </Button>
                    <Button onClick={handleGenerateAllReports} disabled={!isDistributed}>
                      <FileDown className="mr-2 h-4 w-4" />Générer tous les rapports
                    </Button>
                  </div>
                </div>

                {!isDistributed ? (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Distribution requise</AlertTitle>
                    <AlertDescription>Distribuez d'abord les chambres pour les affecter.</AlertDescription>
                  </Alert>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    <UnassignedRoomsColumn
                      rooms={getUnassignedRooms()}
                      housekeeperNames={housekeeperNames}
                      onRoomUpdate={handleRoomUpdate}
                      onDirectAssign={handleDirectRoomAssignment}
                      hotelId={currentHotelId}
                    />
                    {housekeeperNames.map((name) => (
                      <HousekeeperCard
                        key={name}
                        name={name}
                        rooms={getHousekeeperRooms(name)}
                        cleaningConfig={cleaningConfig}
                        onRoomUpdate={handleRoomUpdate}
                        onRoomUnassign={handleRoomUnassign}
                        onReassign={handleRoomReassign}
                        onGenerateReport={() => handleGenerateReport(name, getHousekeeperRooms(name))}
                        unassignedRooms={getUnassignedRooms()}
                        housekeeperNames={housekeeperNames}
                        accessCode={housekeepers.find(h => h.name === name)?.access_code}
                        availableFloors={availableFloors}
                        onFloorPreferenceChange={() => {}}
                        preferredFloors={[]}
                        hotelId={currentHotelId}
                      />
                    ))}
                    <CleanRoomsSection rooms={getCleanRooms()} onRoomUpdate={handleRoomUpdate} hotelId={currentHotelId} />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="access-codes" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" />Gestion des codes d'accès</CardTitle>
                    <CardDescription>Codes d'accès des femmes de chambre et demandes en attente</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="requests" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="requests" className="relative">
                          Demandes d'accès
                          <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs animate-pulse">!</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="codes">Codes existants</TabsTrigger>
                      </TabsList>
                      <TabsContent value="requests" className="space-y-4">
                        <Alert className="bg-blue-50 border-blue-200">
                          <Bell className="h-4 w-4 text-blue-600" />
                          <AlertDescription className="text-blue-800">
                            <strong>📋 Comment ça marche ?</strong> Les femmes de chambre s'inscrivent avec votre code d'hôtel. Validez ou suspendez leur accès ici.
                          </AlertDescription>
                        </Alert>
                        <HousekeeperAccessRequests />
                      </TabsContent>
                      <TabsContent value="codes" className="space-y-4">
                        <p className="text-muted-foreground">Codes d'accès des femmes de chambre validées.</p>
                        <HousekeeperManagement />
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="linen" className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">🧺 Inventaire du linge</h2>
                    <p className="text-muted-foreground">Gérer les types de linge et les tâches</p>
                  </div>
                </div>
                <Tabs defaultValue="types" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="types">Types de linge</TabsTrigger>
                    <TabsTrigger value="inventory">Saisie & Validation</TabsTrigger>
                    <TabsTrigger value="tasks">Attribution des tâches</TabsTrigger>
                    <TabsTrigger value="training">Entraînement IA</TabsTrigger>
                  </TabsList>
                  <TabsContent value="types">{currentHotelId ? <LinenTypeManager hotelId={currentHotelId} /> : <Alert><AlertDescription>Aucun hôtel sélectionné</AlertDescription></Alert>}</TabsContent>
                  <TabsContent value="inventory">{currentHotelId ? <AdminLinenInventory hotelId={currentHotelId} /> : <Alert><AlertDescription>Aucun hôtel sélectionné</AlertDescription></Alert>}</TabsContent>
                  <TabsContent value="tasks">{currentHotelId ? <LinenTaskAssignment hotelId={currentHotelId} /> : <Alert><AlertDescription>Aucun hôtel sélectionné</AlertDescription></Alert>}</TabsContent>
                  <TabsContent value="training">{currentHotelId ? <LinenTrainingManager hotelId={currentHotelId} /> : <Alert><AlertDescription>Aucun hôtel sélectionné</AlertDescription></Alert>}</TabsContent>
                </Tabs>
              </TabsContent>

              <TabsContent value="incidents" className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">Gestion des incidents</h2>
                    <p className="text-muted-foreground">Gérer les incidents et le personnel</p>
                  </div>
                  {currentHotelId && <IncidentReportDialogSimple hotelId={currentHotelId} userType="admin" />}
                </div>
                <Tabs defaultValue="dashboard" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="dashboard">Tableau de bord</TabsTrigger>
                    <TabsTrigger value="incidents">Liste des incidents</TabsTrigger>
                    <TabsTrigger value="staff">Personnel</TabsTrigger>
                    <TabsTrigger value="inventory">Inventaire</TabsTrigger>
                    <TabsTrigger value="permissions">Permissions</TabsTrigger>
                    <TabsTrigger value="print">Imprimer rapport</TabsTrigger>
                  </TabsList>
                  <TabsContent value="dashboard">{currentHotelId ? <IncidentDashboard hotelId={currentHotelId} /> : <Alert><AlertDescription>Aucun hôtel sélectionné</AlertDescription></Alert>}</TabsContent>
                  <TabsContent value="incidents">{currentHotelId ? <IncidentList hotelId={currentHotelId} /> : <Alert><AlertDescription>Aucun hôtel sélectionné</AlertDescription></Alert>}</TabsContent>
                  <TabsContent value="staff">{currentHotelId ? <StaffManagement hotelId={currentHotelId} /> : <Alert><AlertDescription>Aucun hôtel sélectionné</AlertDescription></Alert>}</TabsContent>
                  <TabsContent value="inventory">{currentHotelId ? <IncidentInventoryManager hotelId={currentHotelId} /> : <Alert><AlertDescription>Aucun hôtel sélectionné</AlertDescription></Alert>}</TabsContent>
                  <TabsContent value="permissions">{currentHotelId ? <RolePermissionsManager hotelId={currentHotelId} /> : <Alert><AlertDescription>Aucun hôtel sélectionné</AlertDescription></Alert>}</TabsContent>
                  <TabsContent value="print">{currentHotelId ? <IncidentReportPrint hotelId={currentHotelId} /> : <Alert><AlertDescription>Aucun hôtel sélectionné</AlertDescription></Alert>}</TabsContent>
                </Tabs>
              </TabsContent>

              <TabsContent value="reports" className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Rapports</h2>
                  <Button onClick={handleGenerateAllReports} disabled={!isDistributed || housekeeperNames.filter(name => getHousekeeperRooms(name).length > 0).length === 0}>
                    <FileDown className="mr-2 h-4 w-4" />Générer tous les rapports
                  </Button>
                </div>

                {!isDistributed ? (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Distribution requise</AlertTitle>
                    <AlertDescription>Distribuez d'abord les chambres pour générer des rapports.</AlertDescription>
                  </Alert>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {housekeeperNames.map((name) => {
                      const hkRooms = getHousekeeperRooms(name);
                      if (hkRooms.length === 0) return null;
                      return (
                        <Card key={name}>
                          <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                              <span>{name}</span>
                              <Badge variant="secondary">{hkRooms.length} chambres</Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 mb-4">
                              <div className="text-sm"><span className="font-medium">Nettoyage complet:</span> {hkRooms.filter(r => r.cleaningType === 'full' || r.cleaningType === 'a_blanc').length}</div>
                              <div className="text-sm"><span className="font-medium">Recouches:</span> {hkRooms.filter(r => r.cleaningType === 'quick' || r.cleaningType === 'recouche').length}</div>
                              <div className="text-sm"><span className="font-medium">Temps estimé:</span> {Math.round(calculateHousekeeperLoad(hkRooms, cleaningConfig) / 60)}h</div>
                            </div>
                            <Button onClick={() => handleGenerateReport(name, hkRooms)} className="w-full" size="sm">
                              <FileDown className="mr-2 h-4 w-4" />Générer rapport
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>

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
      />

      <DailyActionLogPanel
        isOpen={showActionLogPanel}
        onClose={() => setShowActionLogPanel(false)}
        hotelId={currentHotelId || ''}
      />
    </div>
  );
};

export default Index;
