import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserIcon, FileText, Calendar, Layers, AlertTriangle, Bed, Building, Key, Brain, Archive, Mail, ClipboardCheck } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import UserMenu from "@/components/UserMenu";
import { useSessionTracking } from "@/hooks/use-session-tracking";
import { Room, CleaningConfig, getDefaultCleaningConfig } from "@/services/pdfService";
import { Badge } from "@/components/ui/badge";
import { generateReport, generateCombinedReport } from "@/services/reportService";
import { toast } from "@/hooks/use-toast";
import { ManualAssignmentDialog } from "@/components/ManualAssignmentDialog";
import { supabase } from "@/integrations/supabase/client";
import { useReportEmail } from "@/hooks/use-report-email";
import EmailReportDialog from "@/components/EmailReportDialog";
import { RedistributionDialog, RedistributionMethod } from "@/components/RedistributionDialog";
import { ReportFields as CustomReportFields } from "@/components/ReportCustomFields";
import { useHousekeeping } from "@/contexts/HousekeepingContext";
import { NotificationBell } from "@/components/NotificationBell";
import { DailyReportCloseButton } from "@/components/DailyReportCloseButton";
import { DailyActionLogPanel } from "@/components/DailyActionLogPanel";
import { NotificationSound } from "@/components/NotificationSound";
import { DeleteRoomDialog } from "@/components/DeleteRoomDialog";
import { LinkRoomsDialog } from "@/components/LinkRoomsDialog";
import { useAutoSetup } from "@/hooks/use-auto-setup";
import { cleanupInvalidHotelIds, generateHotelId } from "@/lib/utils";
import { redistributeRooms } from "@/utils/redistributionUtils";
import { UpgradeButton } from "@/components/UpgradeButton";
import { storageService } from "@/services/storageService";
import { PremiumLimitGuard } from "@/components/PremiumLimitGuard";
import { useSubscription } from "@/hooks/useSubscription";
import { HeroHeader } from "@/components/HeroHeader";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { FirstTimeSetupWizard, useFirstTimeSetup } from "@/components/FirstTimeSetupWizard";
import { useRoomManagement } from "@/hooks/use-room-management";
import { useHousekeeperManagement } from "@/hooks/use-housekeeper-management";
import { useDashboardDialogs } from "@/hooks/use-dashboard-dialogs";
import { SupabaseService } from "@/services/supabaseService";
import { AssignmentService } from "@/services/assignmentService";
import { GuidedDistributionWizard } from "@/components/GuidedDistributionWizard";

// Dashboard tab components
import { OverviewTab } from "@/components/dashboard/OverviewTab";
import { RoomManagementTab } from "@/components/dashboard/RoomManagementTab";
import { AssignmentTab } from "@/components/dashboard/AssignmentTab";
import { AccessCodesTab } from "@/components/dashboard/AccessCodesTab";
import { LinenTab } from "@/components/dashboard/LinenTab";
import { IncidentsTab } from "@/components/dashboard/IncidentsTab";
import { ReportsTab } from "@/components/dashboard/ReportsTab";
import { TrainingTab } from "@/components/dashboard/TrainingTab";
import { ArchivesTab } from "@/components/dashboard/ArchivesTab";
import { StaffInvitationsTab } from "@/components/dashboard/StaffInvitationsTab";
import { HotelSelectionDialog } from "@/components/dashboard/HotelSelectionDialog";
import { GovernessInspectionInterface } from "@/components/governess/GovernessInspectionInterface";
import { useRoomStats, useRoomHelpers } from "@/hooks/use-room-stats";
import { useAssignmentHandlers } from "@/hooks/use-assignment-handlers";

const Index = () => {
  const [searchParams] = useSearchParams();
  const { isAuthenticated, loading } = useAuth();
  const isGuestMode = searchParams.get('mode') === 'guest';
  const navigate = useNavigate();
  
  const { isPremium, isFree, loading: subscriptionLoading } = useSubscription();
  
  useSessionTracking();
  
  const [activeTab, setActiveTab] = useState(() => storageService.getAdminTab());
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
  
  const [availableFloors, setAvailableFloors] = useState<number[]>([]);
  const { email, setEmail } = useReportEmail();
  const [reportCustomFields, setReportCustomFields] = useState<CustomReportFields>({ toDoItems: [], toKnowItems: [] });
  const [availableHotels, setAvailableHotels] = useState<any[]>([]);
  const [selectedHotel, setSelectedHotel] = useState<any | null>(null);
  const [hotelCode, setHotelCode] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [filteredRooms, setFilteredRooms] = useState<Room[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  
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
      // Ne pas recharger si une opération est en cours
      if (!currentHotelId || isImporting || isAssigning) return;
      
      try {
        const { data: roomsData, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('hotel_id', currentHotelId);

        if (error || !roomsData) return;

        // Récupérer les assignations actives
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
    // Augmenter l'intervalle pour éviter les conflits
    const interval = setInterval(loadRoomsFromDatabase, 180000);
    return () => clearInterval(interval);
  }, [currentHotelId, isImporting, isAssigning, setRooms, setIsDistributed]);

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

      storageService.saveHotel({ id: hotel.id, name: hotel.name || `Hôtel ${hotelCode}`, code: hotelCode });
      
      setSelectedHotel(hotel);
      await handleRedistribute('random');
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Erreur de configuration" });
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
            <GuidedDistributionWizard 
              onStartWorkflow={() => setActiveTab('overview')} 
            />
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
                <TabsTrigger value="training" className="w-full justify-start gap-3 px-4 py-3 text-left data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg transition-all">
                  <Brain className="h-5 w-5" /><span>Entraînement IA</span>
                </TabsTrigger>
                <TabsTrigger value="archives" className="w-full justify-start gap-3 px-4 py-3 text-left data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg transition-all">
                  <Archive className="h-5 w-5" /><span>Archives</span>
                </TabsTrigger>
                <TabsTrigger value="invitations" className="w-full justify-start gap-3 px-4 py-3 text-left data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg transition-all">
                  <Mail className="h-5 w-5" /><span>Invitations</span>
                </TabsTrigger>
                <TabsTrigger value="inspections" className="w-full justify-start gap-3 px-4 py-3 text-left data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg transition-all">
                  <ClipboardCheck className="h-5 w-5" /><span>Inspection</span>
                </TabsTrigger>
              </TabsList>
            </div>
            
            {/* Main Content */}
            <div className="flex-1 min-w-0">
              <TabsContent value="overview" className="space-y-6 mt-0">
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
              </TabsContent>

              <TabsContent value="rooms" className="space-y-6">
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
              </TabsContent>

              <TabsContent value="assignment" className="space-y-6">
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
                  setActiveTab={setActiveTab}
                />
              </TabsContent>

              <TabsContent value="access-codes" className="space-y-6">
                <PremiumLimitGuard 
                  feature="access_codes" 
                  title="Codes d'accès"
                  description="Gérez les codes d'accès de vos femmes de chambre avec la version Premium."
                >
                  <AccessCodesTab currentHotelId={currentHotelId} />
                </PremiumLimitGuard>
              </TabsContent>

              <TabsContent value="linen" className="space-y-6">
                <PremiumLimitGuard 
                  feature="linen_inventory" 
                  title="Inventaire du linge"
                  description="Gérez l'inventaire du linge de votre établissement avec la version Premium."
                >
                  <LinenTab currentHotelId={currentHotelId} />
                </PremiumLimitGuard>
              </TabsContent>

              <TabsContent value="incidents" className="space-y-6">
                <PremiumLimitGuard 
                  feature="incidents" 
                  title="Gestion des incidents"
                  description="Suivez et gérez les incidents de votre établissement avec la version Premium."
                >
                  <IncidentsTab currentHotelId={currentHotelId} />
                </PremiumLimitGuard>
              </TabsContent>

              <TabsContent value="reports" className="space-y-6">
                <ReportsTab
                  rooms={rooms}
                  housekeeperNames={housekeeperNames}
                  cleaningConfig={cleaningConfig}
                  isDistributed={isDistributed}
                  onGenerateReport={handleGenerateReport}
                  onGenerateAllReports={handleGenerateAllReports}
                />
              </TabsContent>

              <TabsContent value="training" className="space-y-6">
                <TrainingTab currentHotelId={currentHotelId} />
              </TabsContent>

              <TabsContent value="archives" className="space-y-6">
                <ArchivesTab currentHotelId={currentHotelId} />
              </TabsContent>

              <TabsContent value="invitations" className="space-y-6">
                <PremiumLimitGuard 
                  feature="invitations" 
                  title="Invitations du personnel"
                  description="Gérez les invitations de votre personnel avec un abonnement payant."
                >
                  <StaffInvitationsTab currentHotelId={currentHotelId} hotelName={hotel?.name} />
                </PremiumLimitGuard>
              </TabsContent>

              <TabsContent value="inspections" className="space-y-6">
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
        hotelId={selectedHotel?.id || undefined}
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
          // Navigate to access codes tab to add a housekeeper
          setActiveTab('access-codes');
        }}
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
