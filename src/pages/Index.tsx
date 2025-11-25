import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserIcon, FileText, Calendar, Layers, Plus, FileDown, AlertTriangle, Check, Bed, Smartphone, Building, Key, LogIn, Archive, Link, Trash2, Lock, Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import UserMenu from "@/components/UserMenu";
import { PdfWorkflowDialog } from "@/components/PdfWorkflowDialog";
import { ActiveUsersPanel } from "@/components/ActiveUsersPanel";
import { useSessionTracking } from "@/hooks/use-session-tracking";
import { ConfigDialog } from "@/components/ConfigDialog";
import { Room, CleaningConfig, getDefaultCleaningConfig } from "@/services/pdfService";
import { Badge } from "@/components/ui/badge";
import { RoomCard } from "@/components/RoomCard";
import { HousekeeperCard } from "@/components/HousekeeperCard";
import { UnassignedRoomsColumn } from "@/components/UnassignedRoomsColumn";
import { generateReport, generateCombinedReport } from "@/services/reportService";
import { toast } from "@/hooks/use-toast";
import { ManualAssignmentDialog } from "@/components/ManualAssignmentDialog";
import { supabase } from "@/integrations/supabase/client";
import { EmailDialog } from "@/components/EmailDialog";
import { useReportEmail } from "@/hooks/use-report-email";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import EmailReportDialog from "@/components/EmailReportDialog";
import { autoDistributeRooms } from "@/components/assignment/RoomDistribution";
import { QuickAddHousekeeperButton } from "@/components/QuickAddHousekeeperButton";
import { SyncHousekeepersButton } from "@/components/SyncHousekeepersButton";
import { RedistributionDialog, RedistributionMethod } from "@/components/RedistributionDialog";
import { ReportFields as CustomReportFields } from "@/components/ReportCustomFields";
import { useHousekeeping } from "@/contexts/HousekeepingContext";
import { NotificationBell } from "@/components/NotificationBell";
import { DailyReportCloseButton } from "@/components/DailyReportCloseButton";
import { NotificationSound } from "@/components/NotificationSound";
import { RoomFilters } from "@/components/RoomFilters";
import { HousekeeperSetup } from "@/components/HousekeeperSetup";
import { HousekeeperManagement } from "@/components/HousekeeperManagement";
import { IncidentList } from "@/components/incident/IncidentList";
import { LinenTypeManager } from "@/components/linen/LinenTypeManager";
import { LinenTrainingManager } from "@/components/linen/LinenTrainingManager";
import { LinenTaskAssignment } from "@/components/linen/LinenTaskAssignment";
import { StaffManagement } from "@/components/incident/StaffManagement";
import { IncidentInventoryManager } from "@/components/incident/IncidentInventoryManager";
import { IncidentReportDialogSimple } from "@/components/incident/IncidentReportDialogSimple";
import { IncidentDashboard } from "@/components/incident/IncidentDashboard";
import { RolePermissionsManager } from "@/components/incident/RolePermissionsManager";
import { IncidentReportPrint } from "@/components/incident/IncidentReportPrint";


import { HousekeeperTeamManager } from "@/components/HousekeeperTeamManager";
import { HousekeeperStatusDashboard } from "@/components/HousekeeperStatusDashboard";
import { HousekeeperAccessRequests } from "@/components/HousekeeperAccessRequests";
import { SetupStatusSimple } from "@/components/SetupStatusSimple";
import { SupabaseService } from "@/services/supabaseService";
import { CodeGenerationService } from "@/services/codeGenerationService";
import { AddRoomDialog } from "@/components/AddRoomDialog";
import { DeleteRoomDialog } from "@/components/DeleteRoomDialog";
import { LinkRoomsDialog } from "@/components/LinkRoomsDialog";
import { saveEmailHotelAssociation, getHotelCodeForEmail } from "@/lib/supabase";
import { useNotifications } from "@/hooks/use-notifications";
import { useAutoSetup } from "@/hooks/use-auto-setup";
import { HotelSetupFix } from "@/components/HotelSetupFix";
import { generateHotelId, cleanupInvalidHotelIds, isValidUUID } from "@/lib/utils";
import { redistributeRooms, getDistributionStats } from "@/utils/redistributionUtils";
import { HousekeeperInviteDialog } from "@/components/HousekeeperInviteDialog";
import { UpgradeButton } from "@/components/UpgradeButton";
import { useSubscription } from "@/hooks/useSubscription";
import { HeroHeader } from "@/components/HeroHeader";
import { StatsOverview } from "@/components/StatsOverview";

const Index = () => {
  const [searchParams] = useSearchParams();
  const { isAuthenticated, loading } = useAuth();
  const isGuestMode = searchParams.get('mode') === 'guest';
  const navigate = useNavigate();
  const location = useLocation();
  
  // Hook pour la gestion de l'abonnement
  const { plan, isPremium, isFree, canAccessFeature, loading: subscriptionLoading } = useSubscription();
  
  // Mode invité : supprimer la plupart des restrictions
  const isGuestModeUnlocked = isGuestMode;

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  useSessionTracking(); // Hook pour tracker les sessions
  const [activeTab, setActiveTab] = useState("overview");
  const [cleaningConfig, setCleaningConfig] = useState<CleaningConfig>(getDefaultCleaningConfig(isPremium));
  const [showHousekeeperManagement, setShowHousekeeperManagement] = useState(false);
  
  // Vérifier que le contexte est disponible
  const housekeepingContext = useHousekeeping();
  
  if (!housekeepingContext) {
    return <div>Erreur de contexte HousekeepingProvider</div>;
  }
  
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
  
  // Auto-setup automatique de l'hôtel et génération des codes
  const { hotel, accessCode, isSetupComplete, loading: setupLoading } = useAutoSetup();
  
  // Utiliser l'hotel du hook useAutoSetup comme source unique de vérité
  const currentHotelId = hotel?.id || null;
  
  const [housekeeperFloorPreferences, setHousekeeperFloorPreferences] = useState<Record<string, number[]>>({});
  const [housekeeperMaxRoomsOverrides, setHousekeeperMaxRoomsOverrides] = useState<Record<string, number>>({});
  const [availableFloors, setAvailableFloors] = useState<number[]>([]);
  const [isManualAssignmentOpen, setIsManualAssignmentOpen] = useState(false);
  const [selectedHousekeeper, setSelectedHousekeeper] = useState<string>("");
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportAction, setReportAction] = useState<"single" | "all">("single");
  const [reportHousekeeper, setReportHousekeeper] = useState<string>("");
  const { email, setEmail, isValid } = useReportEmail();
  const [recommendedHousekeepers, setRecommendedHousekeepers] = useState<number>(0);
const [reportCustomFields, setReportCustomFields] = useState<CustomReportFields>({ 
    toDoItems: [], 
    toKnowItems: [] 
  });
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  
  // États pour la gestion des hôtels (conservés pour compatibilité)
  const [availableHotels, setAvailableHotels] = useState<any[]>([]);
  const [selectedHotel, setSelectedHotel] = useState<any | null>(null);
  const [isHotelSelectionOpen, setIsHotelSelectionOpen] = useState(false);

  // Mettre à jour la configuration selon le statut premium
  useEffect(() => {
    if (!subscriptionLoading) {
      setCleaningConfig(prevConfig => ({
        ...getDefaultCleaningConfig(isPremium),
        // Conserver les customisations utilisateur pour les temps si elles existent
        fullCleaningTime: prevConfig.fullCleaningTime,
        quickCleaningTime: prevConfig.quickCleaningTime
      }));
    }
  }, [isPremium, subscriptionLoading]);
  const [hotelCode, setHotelCode] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  
  const [filteredRooms, setFilteredRooms] = useState<Room[] | null>(null);
  const [isRedistributionDialogOpen, setIsRedistributionDialogOpen] = useState(false);
  
  // États pour les dialogs de gestion des chambres
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  
  const [existingHousekeepers, setExistingHousekeepers] = useState<string[]>([]);
  
  console.log("🏨 Hotel ID synchronisé:", {
    hotelId: currentHotelId,
    hotelName: hotel?.name,
    setupComplete: isSetupComplete
  });
  
  const { addNotification } = useNotifications(currentHotelId);

  // ALL useEffect hooks must be here too - before any conditional returns
  useEffect(() => {
    cleanupInvalidHotelIds();
  }, []);
  
  // Charger les femmes de chambre existantes
  useEffect(() => {
    const loadExistingHousekeepers = async () => {
      if (!currentHotelId) return;
      
      try {
        console.log("🔍 Chargement des femmes de chambre existantes pour l'hôtel:", currentHotelId);
        
        const { data: hkList, error: hkError } = await supabase
          .from('housekeepers')
          .select('id, name, is_active')
          .eq('hotel_id', currentHotelId)
          .eq('is_active', true);

        if (hkError) {
          console.error('Erreur lors du chargement des femmes de chambre:', hkError);
          return;
        }

        const hkById = new Map<string, string>();
        (hkList || []).forEach((h: any) => hkById.set(h.id, h.name));

        const { data: sessions, error: sessError } = await supabase
          .from('user_sessions')
          .select('housekeeper_id, user_name, last_activity')
          .eq('hotel_id', currentHotelId)
          .eq('user_type', 'housekeeper')
          .order('last_activity', { ascending: false });

        if (sessError) {
          console.warn('⚠️ Chargement sessions impossible, fallback ordre alphabétique');
        }

        const ordered: string[] = [];
        const seen = new Set<string>();

        (sessions || []).forEach((s: any) => {
          const name = (s.housekeeper_id && hkById.get(s.housekeeper_id)) || s.user_name;
          if (name && !seen.has(name)) { seen.add(name); ordered.push(name); }
        });

        (hkList || []).forEach((h: any) => {
          if (!seen.has(h.name)) { seen.add(h.name); ordered.push(h.name); }
        });

        console.log("✅ Femmes de chambre (priorisées):", ordered);
        setExistingHousekeepers(ordered);
      } catch (error) {
        console.error('Erreur lors du chargement des femmes de chambre:', error);
      }
    };

    loadExistingHousekeepers();
  }, [currentHotelId]);
  
  // Traiter les données de l'AnalysisWorkflow
  useEffect(() => {
    if (location.state) {
      const { rooms: analyzedRooms, housekeepers: analyzedHousekeepers, distributionMethod } = location.state as any;
      
      if (analyzedRooms && analyzedHousekeepers) {
        console.log('📊 Données reçues de l\'AnalysisWorkflow:', {
          rooms: analyzedRooms.length,
          housekeepers: analyzedHousekeepers.length,
          method: distributionMethod
        });
        
        // Appliquer les données analysées
        handlePdfProcessed(analyzedRooms, analyzedHousekeepers, distributionMethod);
        
        // Nettoyer l'état de navigation pour éviter les répétitions
        navigate('/', { replace: true });
      }
    }
  }, [location.state]);
  
  useEffect(() => {
    const initialPreferences: Record<string, number[]> = {};
    housekeeperNames.forEach((name) => {
      initialPreferences[name] = [];
    });
    setHousekeeperFloorPreferences(initialPreferences);
  }, [housekeeperNames]);

  // Synchroniser hotel code quand l'hotel est chargé
  useEffect(() => {
    if (hotel?.hotel_code) {
      setHotelCode(hotel.hotel_code);
      console.log('✅ Hotel code synchronisé:', hotel.hotel_code);
    }
  }, [hotel?.hotel_code]);
  
  // Calculer le nombre recommandé de femmes de chambre
  useEffect(() => {
    if (rooms.length === 0) return;
    
    const roomsToClean = rooms.filter(room => room.cleaningType !== 'none' && room.status !== 'maintenance');
    
    // Calculer le temps total estimé
    const totalTime = roomsToClean.reduce((total, room) => {
      if (room.cleaningType === 'full') {
        return total + cleaningConfig.fullCleaningTime;
      } else if (room.cleaningType === 'quick') {
        return total + cleaningConfig.quickCleaningTime;
      }
      return total;
    }, 0);
    
    // Calculer le temps moyen par femme de chambre (en minutes)
    const averageTimePerHousekeeper = 360; // 6 heures = 360 minutes
    
    // Calculer le nombre recommandé de femmes de chambre
    const recommended = Math.ceil(totalTime / averageTimePerHousekeeper);
    setRecommendedHousekeepers(recommended);
    
  }, [rooms, cleaningConfig]);

  // Redirect to auth if not authenticated and not in guest mode - AFTER ALL HOOKS
  if (!loading && !isAuthenticated && !isGuestMode) {
    return <Navigate to="/auth" replace />;
  }
  
  console.log("Index - isDistributed:", isDistributed); // Debug log
  
  const handleRoomUpdate = (updatedRoom: Room) => {
    setRooms(prevRooms => 
      prevRooms.map(room => 
        room.number === updatedRoom.number ? updatedRoom : room
      )
    );
  };
  
  const handleRoomUnassign = (roomToUnassign: Room) => {
    const updatedRoom = { ...roomToUnassign };
    delete updatedRoom.assignedTo;
    handleRoomUpdate(updatedRoom);
  };

  const handleRoomReassign = (room: Room, newHousekeeper: string | null) => {
    const updatedRoom = { 
      ...room, 
      assignedTo: newHousekeeper || undefined 
    };
    handleRoomUpdate(updatedRoom);
    
    toast({
      description: newHousekeeper 
        ? `Chambre ${room.number} réassignée à ${newHousekeeper}`
        : `Chambre ${room.number} désassignée`
    });
  };

  const handleDeleteHousekeeper = async (housekeeperName: string) => {
    setHousekeeperNames(prev => prev.filter(name => name !== housekeeperName));
    
    // Désactiver en base de données
    const housekeeper = housekeepers.find(h => h.name === housekeeperName);
    if (housekeeper) {
      try {
        const { SupabaseService } = await import('@/services/supabaseService');
        await SupabaseService.deactivateHousekeeper(housekeeper.id);
        refreshHousekeepers();
        console.log('✅ Femme de chambre désactivée en base:', housekeeperName);
      } catch (error) {
        console.error('❌ Erreur désactivation femme de chambre:', error);
      }
    }
    
    // Also remove from floor preferences and max rooms overrides
    setHousekeeperFloorPreferences(prev => {
      const updated = { ...prev };
      delete updated[housekeeperName];
      return updated;
    });
    
    setHousekeeperMaxRoomsOverrides(prev => {
      const updated = { ...prev };
      delete updated[housekeeperName];
      return updated;
    });
  };
  
  // Handle changing housekeeper name directly in the assignment section
  const handleRenameHousekeeper = (oldName: string, newName: string) => {
    // Don't rename if the new name is empty or already exists
    if (!newName.trim() || (oldName !== newName && housekeeperNames.includes(newName))) {
      toast({
        variant: "destructive",
        title: "Nom invalide",
        description: "Le nom ne peut pas être vide ou déjà existant."
      });
      return;
    }
    
    // Update housekeeperNames array
    setHousekeeperNames(prev => prev.map(name => name === oldName ? newName : name));
    
    // Update floor preferences
    setHousekeeperFloorPreferences(prev => {
      const updated = { ...prev };
      if (updated[oldName]) {
        updated[newName] = updated[oldName];
        delete updated[oldName];
      }
      return updated;
    });
    
    // Update max rooms overrides
    setHousekeeperMaxRoomsOverrides(prev => {
      const updated = { ...prev };
      if (updated[oldName]) {
        updated[newName] = updated[oldName];
        delete updated[oldName];
      }
      return updated;
    });
    
    // Update room assignments
    setRooms(prevRooms => 
      prevRooms.map(room => 
        room.assignedTo === oldName ? { ...room, assignedTo: newName } : room
      )
    );
    
    toast({
      title: "Nom modifié",
      description: `"${oldName}" a été renommé en "${newName}".`
    });
  };

  // Nouvelle fonction pour générer un code d'accès pour une femme de chambre
  const handleGenerateAccessCode = async (housekeeperName: string) => {
    if (!hotel?.id) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Aucun hôtel sélectionné pour générer le code d'accès."
      });
      return;
    }

    try {
      const { data: codeData, error } = await supabase
        .rpc('generate_and_insert_access_code', {
          p_hotel_id: hotel.id,
          p_housekeeper_name: housekeeperName
        });

      if (error) throw error;

      // Rafraîchir la liste des femmes de chambre
      refreshHousekeepers();

      // Copier automatiquement le code dans le presse-papiers
      try {
        await navigator.clipboard.writeText(codeData);
        toast({
          title: "Code généré et copié",
          description: `Code d'accès généré pour ${housekeeperName} et copié: ${codeData}`
        });
      } catch (clipboardError) {
        toast({
          title: "Code généré",
          description: `Code d'accès généré pour ${housekeeperName}: ${codeData} (impossible de copier automatiquement)`
        });
      }

      return codeData;
    } catch (error) {
      console.error('Erreur génération code:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de générer le code d'accès."
      });
    }
  };
  
  const handleFloorPreferenceChange = (housekeeperName: string, floors: number[]) => {
    setHousekeeperFloorPreferences(prev => ({
      ...prev,
      [housekeeperName]: floors
    }));
  };
  
  const handleMaxRoomsOverrideChange = (housekeeperName: string, maxRooms: number) => {
    setHousekeeperMaxRoomsOverrides(prev => ({
      ...prev,
      [housekeeperName]: maxRooms
    }));
  };

  const handleAddRoom = async (newRoom: Room) => {
    const updatedRooms = [...rooms, newRoom];
    setRooms(updatedRooms);
    
    // Sauvegarder dans la session pour persistance
    try {
      const { HotelSessionService } = await import('@/services/hotelSessionService');
      await HotelSessionService.updateRoomData(updatedRooms);
      console.log('✅ Chambre ajoutée et sauvegardée:', newRoom.number);
      
      // Afficher un toast de confirmation
      toast({
        title: "Chambre ajoutée",
        description: `La chambre ${newRoom.number} a été ajoutée avec succès`,
      });
    } catch (error) {
      console.error('❌ Erreur sauvegarde chambre:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de l'ajout de la chambre",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRoom = async (roomNumber: string) => {
    const roomToDelete = rooms.find(r => r.number === roomNumber);
    if (!roomToDelete) return;

    // Supprimer les liaisons bidirectionnelles
    const updatedRooms = rooms
      .filter(r => r.number !== roomNumber) // Supprimer la chambre
      .map(room => ({
        ...room,
        linkedRooms: room.linkedRooms?.filter(linkedRoom => linkedRoom !== roomNumber) || []
      }));

    setRooms(updatedRooms);
    
    // Sauvegarder dans la session
    try {
      const { HotelSessionService } = await import('@/services/hotelSessionService');
      await HotelSessionService.updateRoomData(updatedRooms);
      console.log('✅ Chambre supprimée et sauvegardée:', roomNumber);
      
      toast({
        title: "Chambre supprimée",
        description: `La chambre ${roomNumber} a été supprimée avec succès`,
      });
    } catch (error) {
      console.error('❌ Erreur suppression chambre:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la suppression de la chambre",
        variant: "destructive",
      });
    }
  };

  const handleLinkRooms = async (roomNumber: string, linkedRoomNumbers: string[]) => {
    const updatedRooms = rooms.map(room => {
      if (room.number === roomNumber) {
        return {
          ...room,
          linkedRooms: linkedRoomNumbers
        };
      }
      
      // Mettre à jour les liaisons bidirectionnelles
      const shouldBeLinked = linkedRoomNumbers.includes(room.number);
      const currentlyLinked = room.linkedRooms?.includes(roomNumber) || false;
      
      if (shouldBeLinked && !currentlyLinked) {
        // Ajouter la liaison
        return {
          ...room,
          linkedRooms: [...(room.linkedRooms || []), roomNumber]
        };
      } else if (!shouldBeLinked && currentlyLinked) {
        // Supprimer la liaison
        return {
          ...room,
          linkedRooms: room.linkedRooms?.filter(linked => linked !== roomNumber) || []
        };
      }
      
      return room;
    });

    setRooms(updatedRooms);
    
    // Sauvegarder dans la session
    try {
      const { HotelSessionService } = await import('@/services/hotelSessionService');
      await HotelSessionService.updateRoomData(updatedRooms);
      console.log('✅ Liaisons de chambres sauvegardées:', roomNumber, linkedRoomNumbers);
    } catch (error) {
      console.error('❌ Erreur sauvegarde liaisons:', error);
    }
  };
  
  const handlePdfProcessed = async (data: Room[], housekeepers?: string[], distributionMethod?: 'random' | 'floor' | 'cleaning-type') => {
    console.log("📋 Traitement PDF avec méthode:", distributionMethod || 'aucune', "et femmes de chambre:", housekeepers || []);
    
    try {
      const floors = new Set<number>();
      data.forEach(room => {
        const floor = room.number.length > 0 ? parseInt(room.number[0]) : 0;
        floors.add(floor);
        room.floor = floor;
        room.isTwin = false; 
      });
      const floorArray = Array.from(floors).sort((a, b) => a - b);
      setAvailableFloors(floorArray);
      
      const sortedData = [...data].sort((a, b) => 
        a.number.localeCompare(b.number, undefined, { numeric: true })
      );

      // Mettre à jour les noms des femmes de chambre si fournis
      if (housekeepers && housekeepers.length > 0) {
        setHousekeeperNames(housekeepers);
      }

      // Auto-distribute if method specified
      if (distributionMethod && housekeepers && housekeepers.length > 0) {
        console.log("🔄 Auto-distribution selon méthode:", distributionMethod);
        // Simuler une distribution simple pour l'instant
        const roomsPerHousekeeper = Math.ceil(sortedData.length / housekeepers.length);
        const updatedRooms = sortedData.map((room, index) => {
          const housekeeperIndex = Math.floor(index / roomsPerHousekeeper);
          const assignedHousekeeper = housekeepers[housekeeperIndex] || housekeepers[0];
          return { ...room, assignedTo: assignedHousekeeper };
        });
        setRooms(updatedRooms);
        setIsDistributed(true);
      } else {
        setRooms(sortedData);
        setIsDistributed(false);
      }
      
      toast({
        title: "PDF traité avec succès",
        description: `${data.length} chambres importées${distributionMethod ? ` et distribuées (${distributionMethod})` : ''}`
      });
      
    } catch (error) {
      console.error("❌ Erreur traitement PDF:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Erreur lors du traitement du PDF"
      });
    }
  };

  const distributeRooms = (
    roomsList: Room[], 
    housekeepers: string[], 
    floorPreferences: Record<string, number[]> = {},
    maxRoomsOverrides: Record<string, number> = {}
  ) => {
    if (housekeepers.length === 0) return;
    
    const sortedRooms = [...roomsList].sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (b.priority === 'high' && a.priority !== 'high') return 1;
      if (a.cleaningType === 'full' && b.cleaningType !== 'full') return -1;
      if (b.cleaningType === 'full' && a.cleaningType !== 'full') return 1;
      const floorA = a.floor !== undefined ? a.floor : (a.number ? parseInt(a.number[0]) : 0);
      const floorB = b.floor !== undefined ? b.floor : (b.number ? parseInt(b.number[0]) : 0);
      if (floorA !== floorB) return floorA - floorB;
      return a.number.localeCompare(b.number, undefined, { numeric: true });
    });
    
    const roomsToClean = sortedRooms.filter(room => 
      room.cleaningType !== 'none' && room.status !== 'maintenance'
    );
    
    const roomsByFloor: Record<number, Room[]> = {};
    for (const room of roomsToClean) {
      const floor = room.floor !== undefined ? room.floor : parseInt(room.number[0]) || 0;
      if (!roomsByFloor[floor]) roomsByFloor[floor] = [];
      roomsByFloor[floor].push(room);
    }
    
    const assignments: Record<string, Room[]> = {};
    housekeepers.forEach(name => {
      assignments[name] = [];
    });
    
    const findMinLoadHousekeeper = (preferredFloor?: number) => {
      let candidates = housekeepers;
      if (preferredFloor !== undefined) {
        // Only assign to housekeepers with this floor preference or no preference
        const housekeepersForFloor = housekeepers.filter(name => {
          const preferences = floorPreferences[name] || [];
          return preferences.length === 0 || preferences.includes(preferredFloor);
        });
        
        if (housekeepersForFloor.length > 0) {
          candidates = housekeepersForFloor;
        }
      }
      
      // Filter candidates that haven't reached their max rooms limit
      const availableCandidates = candidates.filter(name => {
        const maxRooms = maxRoomsOverrides[name] || cleaningConfig.maxRoomsPerHousekeeper;
        return assignments[name].length < maxRooms;
      });
      
      // If all candidates have reached their max, return null
      if (availableCandidates.length === 0) return null;
      
      let minLoadHousekeeper = availableCandidates[0];
      let minLoad = calculateHousekeeperLoad(assignments[minLoadHousekeeper], cleaningConfig);
      
      for (let i = 1; i < availableCandidates.length; i++) {
        const currentLoad = calculateHousekeeperLoad(assignments[availableCandidates[i]], cleaningConfig);
        if (currentLoad < minLoad) {
          minLoad = currentLoad;
          minLoadHousekeeper = availableCandidates[i];
        }
      }
      
      return minLoadHousekeeper;
    };
    
    const assignedRooms = new Set<string>();
    
    // First assign high priority rooms
    for (const room of roomsToClean.filter(r => r.priority === 'high')) {
      const floor = room.floor !== undefined ? room.floor : parseInt(room.number[0]) || 0;
      const housekeeper = findMinLoadHousekeeper(floor);
      
      if (!housekeeper) continue; // Skip if all housekeepers are at max capacity
      
      // Only assign if the housekeeper accepts this floor or has no preferences
      const preferences = floorPreferences[housekeeper] || [];
      if (preferences.length === 0 || preferences.includes(floor)) {
        assignments[housekeeper].push({ ...room, assignedTo: housekeeper });
        assignedRooms.add(room.number);
      }
    }
    
    // Then assign remaining rooms by floor
    Object.entries(roomsByFloor).forEach(([floor, floorRooms]) => {
      const floorNum = parseInt(floor);
      for (const room of floorRooms) {
        if (assignedRooms.has(room.number)) continue;
        
        const housekeeper = findMinLoadHousekeeper(floorNum);
        if (!housekeeper) continue; // Skip if all housekeepers are at max capacity
        
        // Only assign if the housekeeper accepts this floor or has no preferences
        const preferences = floorPreferences[housekeeper] || [];
        if (preferences.length === 0 || preferences.includes(floorNum)) {
          assignments[housekeeper].push({ ...room, assignedTo: housekeeper });
          assignedRooms.add(room.number);
        }
      }
    });
    
    // Update all rooms
    const updatedRooms = [...sortedRooms];
    for (const housekeeper of housekeepers) {
      for (const room of assignments[housekeeper]) {
        const index = updatedRooms.findIndex(r => r.number === room.number);
        if (index !== -1) {
          updatedRooms[index] = { ...updatedRooms[index], assignedTo: housekeeper };
        }
      }
    }
    
    setRooms(updatedRooms);
    
    // Notify user about unassigned rooms
    const unassignedRooms = getUnassignedRooms();
    if (unassignedRooms.length > 0) {
      toast({
        title: "Distribution terminée",
        description: `${unassignedRooms.length} chambres n'ont pas pu être assignées en raison des préférences d'étage ou des limites de chambres.`,
        variant: "default",
      });
    }
  };
  
  const calculateHousekeeperLoad = (assignedRooms: Room[], config: CleaningConfig): number => {
    return assignedRooms.reduce((total, room) => {
      if (room.cleaningType === 'full') {
        return total + config.fullCleaningTime;
      } else if (room.cleaningType === 'quick') {
        return total + config.quickCleaningTime;
      }
      return total;
    }, 0);
  };
  
  const handleGenerateReport = async (housekeeperName: string, housekeeperRooms: Room[]) => {
    setReportHousekeeper(housekeeperName);
    setReportAction("single");
    
    // Mode invité : seule restriction est les 50 chambres pour les rapports
    if (isGuestMode) {
      const roomsToClean = rooms.filter(room => 
        room.cleaningType !== 'none' && room.status !== 'maintenance'
      );
      
      if (roomsToClean.length > 50) {
        toast({
          variant: "destructive",
          title: "Limite atteinte en mode invité",
          description: "Passez au Premium pour générer des rapports de plus de 50 chambres."
        });
        return;
      }
    }

    // Pour les utilisateurs connectés, vérifier les limites selon le plan
    if (isAuthenticated && !isPremium) {
      const roomsToClean = rooms.filter(room => 
        room.cleaningType !== 'none' && room.status !== 'maintenance'
      );
      
      if (roomsToClean.length > 50) {
        toast({
          variant: "destructive",
          title: "Limite atteinte",
          description: "Le plan gratuit est limité à 50 chambres. Passez au Premium pour plus."
        });
        return;
      }
    }

    // Toujours demander l'email pour le téléchargement du rapport
    setIsEmailDialogOpen(true);
  };
  
  const handleGenerateAllReports = async () => {
    setReportAction("all");
    
    // Mode invité : seule restriction est les 50 chambres pour les rapports
    if (isGuestMode) {
      const roomsToClean = rooms.filter(room => 
        room.cleaningType !== 'none' && room.status !== 'maintenance'
      );
      
      if (roomsToClean.length > 50) {
        toast({
          variant: "destructive",
          title: "Limite atteinte en mode invité",
          description: "Passez au Premium pour générer des rapports de plus de 50 chambres."
        });
        return;
      }
    }

    // Pour les utilisateurs connectés, vérifier les limites selon le plan
    if (isAuthenticated && !isPremium) {
      const roomsToClean = rooms.filter(room => 
        room.cleaningType !== 'none' && room.status !== 'maintenance'
      );
      
      if (roomsToClean.length > 50) {
        toast({
          variant: "destructive",
          title: "Limite atteinte",
          description: "Le plan gratuit est limité à 50 chambres. Passez au Premium pour plus."
        });
        return;
      }
    }

    // Toujours demander l'email pour le téléchargement du rapport
    setIsEmailDialogOpen(true);
  };
  
  const totalRooms = rooms.length;
  const roomsToClean = rooms.filter(r => r.status === 'needs-cleaning' || r.cleaningType !== 'none').length;
  const fullCleaningRooms = rooms.filter(r => r.cleaningType === 'full').length;
  const quickCleaningRooms = rooms.filter(r => r.cleaningType === 'quick').length;
  const priorityRooms = rooms.filter(r => r.priority === 'high').length;
  const cleanRooms = rooms.filter(r => r.status === 'clean').length;
  const twinRooms = rooms.filter(r => r.isTwin).length;
  
  const getHousekeeperRooms = (name: string) => {
    return rooms.filter(room => room.assignedTo === name);
  };
  
  const getUnassignedRooms = () => {
    return rooms.filter(room => 
      !room.assignedTo && 
      room.cleaningType !== 'none' && 
      room.status !== 'maintenance'
    );
  };

  // Fonction pour gérer la redistribution des chambres
  const handleRedistribute = (method: RedistributionMethod) => {
    console.log(`🔄 Redistribution via ${method}`);
    
    if (housekeeperNames.length === 0) {
      toast({
        variant: "destructive",
        title: "Erreur de redistribution",
        description: "Aucune femme de chambre disponible pour la redistribution."
      });
      return;
    }

    const availableRooms = rooms.filter(room => 
      room.cleaningType !== 'none' && room.status !== 'maintenance'
    );

    if (availableRooms.length === 0) {
      toast({
        variant: "destructive",
        title: "Erreur de redistribution",
        description: "Aucune chambre disponible pour la redistribution."
      });
      return;
    }

    try {
      const redistributedRooms = redistributeRooms(rooms, housekeeperNames, method);
      setRooms(redistributedRooms);
      setIsDistributed(true);
      setIsRedistributionDialogOpen(false);

      const methodName = method === 'random' ? 'aléatoire' : 
                        method === 'floor' ? 'par étage' : 'par type de nettoyage';
      
      const assignedCount = redistributedRooms.filter(r => 
        r.assignedTo && r.cleaningType !== 'none' && r.status !== 'maintenance'
      ).length;

      toast({
        title: "Redistribution terminée",
        description: `${assignedCount} chambres redistribuées avec la méthode ${methodName}.`
      });

      // Ajouter une notification seulement si on a un hotel valide
      if (currentHotelId && isValidUUID(currentHotelId) && addNotification) {
        addNotification({
          type: 'assignment',
          title: 'Redistribution des chambres',
          description: `${assignedCount} chambres redistribuées (méthode: ${methodName})`,
          user_type: 'admin'
        });
      }

    } catch (error) {
      console.error('Erreur lors de la redistribution:', error);
      toast({
        variant: "destructive",
        title: "Erreur de redistribution", 
        description: "Une erreur s'est produite lors de la redistribution des chambres."
      });
    }
  };
  
  const handleConfigChange = (newConfig: CleaningConfig) => {
    setCleaningConfig(newConfig);
  };
  
  const handleHousekeeperNamesChange = (names: string[]) => {
    setHousekeeperNames(names);
    
    const updatedPreferences: Record<string, number[]> = {};
    names.forEach(name => {
      updatedPreferences[name] = housekeeperFloorPreferences[name] || [];
    });
    setHousekeeperFloorPreferences(updatedPreferences);
    
    // Mettre à jour les overrides
    const updatedOverrides: Record<string, number> = {};
    names.forEach(name => {
      if (housekeeperMaxRoomsOverrides[name]) {
        updatedOverrides[name] = housekeeperMaxRoomsOverrides[name];
      }
    });
    setHousekeeperMaxRoomsOverrides(updatedOverrides);
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'needs-cleaning':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">À Nettoyer</Badge>;
      case 'clean':
        return <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">Propre</Badge>;
      case 'occupied':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-100">Occupé</Badge>;
      case 'maintenance':
        return <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-100">Maintenance</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const getCleaningTypeBadge = (type: string) => {
    switch (type) {
      case 'full':
        return <Badge variant="outline" className="bg-red-100 text-red-800">À blanc</Badge>;
      case 'quick':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Recouche</Badge>;
      case 'none':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Aucun</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  // Auto-générer les codes d'accès pour la distribution
  const generateAccessCodesForDistribution = async () => {
    const hotelId = selectedHotel?.id || localStorage.getItem("selectedHotelId") || localStorage.getItem("hotelId");
    if (!hotelId) return;
    
    try {
      console.log('🔑 Génération automatique des codes pour:', housekeeperNames);
      
      for (const housekeeperName of housekeeperNames) {
        // Vérifier si la femme de chambre a déjà un code
        const { data: existingHousekeeper } = await supabase
          .from('housekeepers')
          .select('id, access_code')
          .eq('hotel_id', hotelId)
          .eq('name', housekeeperName)
          .eq('is_active', true)
          .maybeSingle();
        
        if (!existingHousekeeper?.access_code) {
          // Générer un nouveau code avec le nom
          const { data: newCodeData, error: codeError } = await supabase
            .rpc('generate_housekeeper_access_code_with_name', {
              p_hotel_id: hotelId,
              p_housekeeper_id: existingHousekeeper?.id || null,
              p_housekeeper_name: housekeeperName
            });
          
          if (codeError) {
            console.error('❌ Erreur génération code pour', housekeeperName, ':', codeError);
            continue;
          }
          
          console.log('✅ Code généré pour', housekeeperName, ':', newCodeData);
          
          // Mettre à jour la femme de chambre avec le nouveau code
          if (existingHousekeeper) {
            await supabase
              .from('housekeepers')
              .update({ access_code: newCodeData })
              .eq('id', existingHousekeeper.id);
          }
        }
      }
      
      // Rafraîchir les données
      if (refreshHousekeepers) {
        await refreshHousekeepers();
      }
      
    } catch (error) {
      console.error('❌ Erreur génération automatique codes:', error);
    }
  };
  
  // Nouvelle fonction de redistribution avec méthode
  const handleRedistributeWithMethod = async (method: RedistributionMethod) => {
    console.log(`🔄 Redistribution avec méthode: ${method}`);
    
    const redistributedRooms = redistributeRooms(rooms, housekeeperNames, method);
    setRooms(redistributedRooms);
    setIsDistributed(true);
    
    // Auto-générer les codes d'accès lors de la distribution
    await generateAccessCodesForDistribution();
    
    // Statistiques de distribution
    const stats = getDistributionStats(redistributedRooms, housekeeperNames);
    
    let methodName = '';
    switch (method) {
      case 'random': methodName = 'aléatoire'; break;
      case 'floor': methodName = 'par étage'; break;
      case 'cleaning-type': methodName = 'par type de nettoyage'; break;
    }
    
    toast({
      title: `Redistribution ${methodName} terminée`,
      description: `${redistributedRooms.filter(r => r.assignedTo).length} chambres redistribuées entre ${housekeeperNames.length} femmes de chambre`,
    });
    
    // Notification de redistribution avec ID déterministe
    const notificationHotelId = hotelCode ? generateHotelId(hotelCode) : 
      (selectedHotel?.id || localStorage.getItem("selectedHotelId") || localStorage.getItem("hotelId"));
    
    console.log("📨 Tentative création notification redistribution avec ID:", notificationHotelId);
    
    if (notificationHotelId && addNotification) {
      const notificationResult = await addNotification({
        title: "Redistribution effectuée",
        description: `Admin - Redistribution ${methodName} de ${redistributedRooms.filter(r => r.assignedTo).length} chambres`,
        type: 'assignment',
        user_type: 'admin'
      });
      
      if (notificationResult) {
        console.log("✅ Notification redistribution créée:", notificationResult.id);
      } else {
        console.log("❌ Échec création notification redistribution");
      }
    } else {
      console.log("❌ Pas d'ID hôtel valide pour notification:", { notificationHotelId, hasAddNotification: !!addNotification });
    }
    
    console.log('📊 Statistiques de distribution:', stats);
  };
  
  const handleDistributeWithValidation = async () => {
    console.log("handleDistributeWithValidation appelé");
    
    // Validation des données requises
    if (!hotelCode.trim() || !userEmail.trim()) {
      toast({
        variant: "destructive",
        title: "Informations manquantes",
        description: "Veuillez renseigner le code de l'hôtel et votre email."
      });
      return;
    }
    
    if (housekeeperNames.length === 0) {
      toast({
        variant: "destructive",
        title: "Aucune femme de chambre",
        description: "Veuillez ajouter au moins une femme de chambre."
      });
      return;
    }
    
    if (rooms.length === 0) {
      toast({
        variant: "destructive",
        title: "Aucune chambre",
        description: "Veuillez importer la liste des chambres."
      });
      return;
    }

    // Créer ou récupérer l'hôtel avec un ID déterministe
    try {
      console.log("🔍 Recherche hôtel avec code:", hotelCode);
      
      // Générer un ID déterministe pour cet hôtel
      const deterministicHotelId = generateHotelId(hotelCode);
      console.log("🆔 ID déterministe généré:", deterministicHotelId);
      
      let hotel = await SupabaseService.getHotelByCode(hotelCode);
      
      if (!hotel) {
        console.log("🏨 Création nouvel hôtel avec ID déterministe...");
        // Créer l'hôtel avec l'ID déterministe
        hotel = await SupabaseService.createHotelWithId(
          deterministicHotelId,     // id déterministe
          `Hôtel ${hotelCode}`,     // name
          userEmail,                // email
          hotelCode                 // hotelCode
        );
        console.log("✅ Hôtel créé avec ID déterministe:", hotel);
      } else {
        console.log("✅ Hôtel existant trouvé:", hotel);
        // Mettre à jour l'ID de l'hôtel existant si nécessaire (mais seulement si différent)
        if (hotel.id !== deterministicHotelId) {
          console.log("🔄 Mise à jour ID hôtel vers déterministe");
          hotel = await SupabaseService.updateHotelId(hotel.id, deterministicHotelId) || hotel;
        }
      }
      
      if (!hotel || !hotel.id) {
        console.error("❌ Hotel ou hotel.id manquant:", hotel);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de créer ou récupérer l'hôtel."
        });
        return;
      }

      // Sauvegarder toutes les informations importantes dans localStorage
      console.log("💾 Sauvegarde localStorage avec hotelId:", hotel.id);
      localStorage.setItem('selectedHotelCode', hotelCode);
      localStorage.setItem('userEmail', userEmail);
      localStorage.setItem('selectedHotelId', hotel.id);
      localStorage.setItem('hotelId', hotel.id);
      localStorage.setItem('hotelIdDeterministic', deterministicHotelId);
      
      // Vérifier que la sauvegarde a bien fonctionné
      const savedId = localStorage.getItem('hotelId');
      console.log("🔍 Vérification localStorage hotelId:", savedId);
      
      console.log("🏨 Hôtel configuré avec ID:", hotel.id);
      setSelectedHotel(hotel);
      
      toast({
        title: "Hôtel configuré",
        description: `Hôtel "${hotel.name}" configuré avec ID: ${hotel.id.slice(0, 8)}...`
      });
      
      await handleRedistributeWithMethod('random');
    } catch (error) {
      console.error("❌ Erreur lors de la création/récupération de l'hôtel:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de créer ou récupérer l'hôtel."
      });
      return;
    }
  };

  const handleHotelSelection = (hotel: any) => {
    setSelectedHotel(hotel);
    localStorage.setItem('selectedHotelId', hotel.id);
    setIsHotelSelectionOpen(false);
    
    toast({
      title: "Hôtel sélectionné",
      description: `Hôtel "${hotel.name}" (${hotel.hotel_code}) sélectionné pour cette session.`
    });
    
    // Maintenant on peut faire la redistribution
    setTimeout(() => {
      handleRedistributeWithMethod('random');
    }, 500);
  };
  
  const openManualAssignment = (housekeeperName?: string) => {
    setSelectedHousekeeper(housekeeperName || "");
    setIsManualAssignmentOpen(true);
  };
  
  const handleManualAssign = (housekeeperName: string, selectedRooms: Room[]) => {
    // Unassign rooms from other housekeepers first
    const updatedRooms = rooms.map(room => {
      if (selectedRooms.some(selectedRoom => selectedRoom.number === room.number)) {
        return { ...room, assignedTo: housekeeperName };
      }
      return room;
    });
    
    setRooms(updatedRooms);
    setIsManualAssignmentOpen(false);
    
    toast({
      title: "Assignation manuelle",
      description: `${selectedRooms.length} chambre(s) ont été assignées à ${housekeeperName}.`
    });
  };

  // Fonction pour l'assignation directe depuis les chambres non assignées
  const handleDirectRoomAssignment = (roomNumber: string, housekeeperName: string) => {
    const updatedRooms = rooms.map(room => {
      if (room.number === roomNumber) {
        return { ...room, assignedTo: housekeeperName };
      }
      return room;
    });
    
    setRooms(updatedRooms);
    
    toast({
      title: "Chambre assignée",
      description: `Chambre ${roomNumber} assignée à ${housekeeperName}.`
    });

    // Test de création de notification avec l'hotel ID déterministe
    const notificationHotelId = hotelCode ? generateHotelId(hotelCode) : 
      (selectedHotel?.id || localStorage.getItem("selectedHotelId") || localStorage.getItem("hotelId"));
    
    console.log('🧪 Test notification - Hotel ID:', {
      hotelCode,
      notificationHotelId,
      generatedId: hotelCode ? generateHotelId(hotelCode) : null,
      selectedHotel: selectedHotel?.id
    });
    
    if (notificationHotelId) {
      console.log('✅ Création notification assignation pour hotel:', notificationHotelId);
      addNotification({
        title: `Assignation chambre ${roomNumber}`,
        description: `Admin - CH ${roomNumber} assignée à ${housekeeperName}`,
        type: 'assignment',
        housekeeper_name: housekeeperName,
        room_number: roomNumber,
        user_type: 'admin'
      });
    } else {
      console.warn('❌ Hotel ID invalide pour notification:', currentHotelId);
      toast({
        variant: "destructive",
        title: "Erreur notification",
        description: "ID hôtel non valide - vérifiez la configuration"
      });
    }
  };
  
  const handleEmailConfirm = (confirmedEmail: string) => {
    setEmail(confirmedEmail);
    setIsEmailDialogOpen(false);
    
    // Ouvrir le dialog pour les champs personnalisés
    setIsReportDialogOpen(true);
  };
  
  const handleReportConfirm = async (
    confirmedEmail: string,
    customFields: CustomReportFields
  ) => {
    setEmail(confirmedEmail);
    setReportCustomFields(customFields);
    setIsReportDialogOpen(false);
    
    try {
      if (reportAction === "single") {
        const housekeeperRooms = getHousekeeperRooms(reportHousekeeper);
        await generateReport(reportHousekeeper, housekeeperRooms, cleaningConfig, customFields);
        
        toast({
          title: "Rapport envoyé",
          description: `Le rapport pour ${reportHousekeeper} a été envoyé à ${confirmedEmail}.`,
        });
      } else {
        // Generate reports for all housekeepers with rooms
        const housekeepersWithRooms = housekeeperNames.filter(name => getHousekeeperRooms(name).length > 0);
        
        if (housekeepersWithRooms.length === 0) {
          toast({
            variant: "destructive",
            title: "Aucune chambre assignée",
            description: "Aucune femme de chambre n'a de chambres assignées.",
          });
          return;
        }
        
        // Generate combined report
        await generateCombinedReport(
          housekeepersWithRooms.map(name => ({ name, rooms: getHousekeeperRooms(name) })), 
          cleaningConfig,
          customFields
        );
        
        toast({
          title: "Rapports envoyés",
          description: `Un rapport combiné pour ${housekeepersWithRooms.length} femme(s) de chambre a été créé.`,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de générer le(s) rapport(s). Veuillez réessayer.",
      });
    }
  };
  
  // Interface de connexion si pas encore authentifié - redirection automatique
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">NettoBloc</CardTitle>
            <CardDescription>
              Accès nécessaire pour continuer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              Vous devez être connecté pour accéder à l'interface de gestion.
            </p>
            <div className="space-y-2">
              <Button 
                onClick={() => navigate("/auth")}
                className="w-full"
              >
                Se connecter / S'inscrire
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate("/housekeeper-login")}
                className="w-full"
              >
                Accès Femme de Chambre
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Si setup en cours, afficher directement le dashboard avec un indicateur discret
  // Plus de blocage complet de l'interface

  return (
    <>
      <div className="flex min-h-screen flex-col bg-background">
      <div className="container mx-auto py-6 px-4 md:px-6">
         {/* Modern Header */}
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
                   {isGuestMode && (
                     <Badge variant="outline" className="text-xs">Mode Invité</Badge>
                   )}
                   {!subscriptionLoading && isAuthenticated && (
                     <Badge 
                       variant="secondary"
                       className={isPremium 
                         ? "bg-gradient-premium text-premium-foreground text-xs border-0" 
                         : "bg-gradient-freemium text-freemium-foreground text-xs border-0"
                       }
                     >
                       {isPremium ? "Premium" : "Freemium"}
                     </Badge>
                   )}
                   {hotel && (
                     <span className="text-xs text-muted-foreground">
                       {hotel.name} • {hotel.hotel_code}
                     </span>
                   )}
                 </div>
               </div>
             </div>
             {isFree && isAuthenticated && (
               <UpgradeButton 
                 variant="outline" 
                 size="sm"
                 className="h-8 px-4 text-xs" 
               />
             )}
           </div>
          
           <div className="flex items-center space-x-4">
             {!isAuthenticated && !isGuestMode && (
               <>
                  <Button asChild variant="outline">
                    <a href="/housekeeper-login">
                      <Smartphone className="mr-2 h-4 w-4" />
                      Accès Femme de Chambre (Code Hôtel)
                  </a>
                </Button>
                <Button asChild>
                  <a href="/housekeeper/login">
                    <UserIcon className="mr-2 h-4 w-4" />
                    Espace Personnel Femme de Chambre
                  </a>
                  </Button>
                 <Button asChild>
                   <a href="/auth">
                     <LogIn className="mr-2 h-4 w-4" />
                     Se connecter
                   </a>
                 </Button>
               </>
             )}
            {isAuthenticated && (
              <>
                 <Button asChild>
                   <a href="/housekeeper/login">
                     <UserIcon className="mr-2 h-4 w-4" />
                     Espace Personnel Femme de Chambre
                   </a>
                   </Button>
                  <DailyReportCloseButton 
                    hotelId={currentHotelId || hotel?.id || ''} 
                    onReportClosed={() => {
                      console.log('Rapport clôturé, rafraîchissement...');
                      window.location.reload();
                    }}
                  />
                  <NotificationBell hotelId={hotel?.id} />
                 <UserMenu />
               </>
             )}
          </div>
        </div>

        {/* Notification Sound Component - silent background component */}
        <NotificationSound hotelId={hotel?.id} />


        {/* Panneau de notifications global */}
        <div className="fixed top-4 right-4 z-50">
                <NotificationBell 
                  hotelId={currentHotelId && isValidUUID(currentHotelId) ? currentHotelId : undefined}
                  className="ml-2"
                />
        </div>

        {/* Hero Header */}
        <HeroHeader hotelName={hotel?.name} isPremium={isPremium} />
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex items-center justify-between mb-6">
            <TabsList className="grid w-full grid-cols-8 max-w-fit bg-card/50 backdrop-blur-sm border border-border/50">
              <TabsTrigger value="overview" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Layers className="h-4 w-4" />
                Vue d'ensemble
              </TabsTrigger>
              <TabsTrigger value="rooms" className="flex items-center gap-2">
                <Bed className="h-4 w-4" />
                Chambres
              </TabsTrigger>
              <TabsTrigger value="assignment" className="flex items-center gap-2">
                <UserIcon className="h-4 w-4" />
                Affectation
              </TabsTrigger>
              <TabsTrigger value="access-codes" className="flex items-center gap-2 relative">
                <Key className="h-4 w-4" />
                Codes d'accès
                <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs animate-pulse">
                  !
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="linen" className="flex items-center gap-2">
                🧺
                Inventaire Linge
              </TabsTrigger>
              <TabsTrigger value="incidents" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Incidents
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Rapports
              </TabsTrigger>
              <TabsTrigger value="mobile" className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Mobile
              </TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <Button
                variant="outline" 
                size="sm"
                onClick={() => navigate('/reports')}
                className="flex items-center gap-2"
              >
                <Archive className="h-4 w-4" />
                Archives
              </Button>
            </div>
          </div>

          <TabsContent value="overview" className="space-y-6 animate-fade-in">
            {/* Stats Overview Component */}
            <StatsOverview rooms={rooms} housekeeperCount={housekeeperNames.length} />

            <div className="grid gap-6 md:grid-cols-3">
              <Card className="border-border/50 hover:shadow-modern-lg transition-all duration-300">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Actions rapides</CardTitle>
                  <CardDescription>
                    Gérez votre planning de nettoyage
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <PdfWorkflowDialog 
                    hotelId={currentHotelId}
                    onWorkflowComplete={(data, housekeepers, distributionMethod) => {
                      handlePdfProcessed(data, housekeepers, distributionMethod);
                    }}
                  />
                  <ConfigDialog 
                    config={cleaningConfig} 
                    onConfigChange={handleConfigChange}
                    housekeeperNames={housekeeperNames}
                    onHousekeeperNamesChange={handleHousekeeperNamesChange}
                    isPremium={isPremium}
                  />
                  <Button 
                    onClick={() => {
                      // Test notification
                      const currentHotelId = selectedHotel?.id || localStorage.getItem("selectedHotelId") || localStorage.getItem("hotelId");
                      if (currentHotelId && isValidUUID(currentHotelId)) {
                        addNotification({
                          title: "Test notification",
                          description: "Ceci est un test de notification système",
                          type: 'assignment',
                          user_type: 'admin'
                        });
                        toast({ title: "Test envoyé", description: "Notification de test créée" });
                      } else {
                        toast({ 
                          variant: "destructive", 
                          title: "Erreur", 
                          description: "Aucun hôtel configuré pour les notifications" 
                        });
                      }
                    }}
                    className="w-full mb-2"
                    variant="outline"
                  >
                    🧪 Tester les notifications
                  </Button>
                  <Button 
                    onClick={handleDistributeWithValidation}
                    className="w-full"
                    disabled={housekeeperNames.length === 0 || rooms.length === 0}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    Distribuer
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/50 hover:shadow-modern-lg transition-all duration-300">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Résumé du planning</CardTitle>
                  <CardDescription>
                    Aperçu des chambres et nettoyages
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Chambres doubles:</span>
                      <span className="text-sm font-medium">{twinRooms}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Temps total estimé:</span>
                      <span className="text-sm font-medium">
                        {Math.round(
                          (fullCleaningRooms * cleaningConfig.fullCleaningTime + 
                           quickCleaningRooms * cleaningConfig.quickCleaningTime) / 60
                        )}h
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Temps moyen/personne:</span>
                      <span className="text-sm font-medium">
                        {housekeeperNames.length > 0 ? 
                          Math.round(
                            (fullCleaningRooms * cleaningConfig.fullCleaningTime + 
                             quickCleaningRooms * cleaningConfig.quickCleaningTime) / 
                            (60 * housekeeperNames.length)
                          ) : 0
                        }h
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <ActiveUsersPanel />
            </div>
            
            {/* Section Gestion des femmes de chambre - Simplifiée */}
            <Card>
              <CardHeader>
                <CardTitle>Personnel</CardTitle>
                <CardDescription>
                  Gérez vos femmes de chambre et leurs codes d'accès
                </CardDescription>
              </CardHeader>
              <CardContent>
                <HousekeeperManagement />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rooms" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Gestion des chambres</h2>
              <div className="flex gap-2">
                <AddRoomDialog 
                  onAddRoom={handleAddRoom} 
                  existingRooms={rooms} 
                />
                    <PdfWorkflowDialog 
                      hotelId={currentHotelId}
                      onWorkflowComplete={(data, housekeepers, distributionMethod) => {
                        handlePdfProcessed(data, housekeepers, distributionMethod);
                      }}
                    />
                <Button
                  onClick={() => openManualAssignment()}
                  variant="outline"
                  disabled={housekeeperNames.length === 0}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Assignation manuelle
                </Button>
              </div>
            </div>

            {rooms.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Aucune chambre importée</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Importez un fichier PDF pour commencer à gérer vos chambres ou ajoutez des chambres manuellement
                  </p>
                  <div className="flex gap-2 justify-center">
                    <AddRoomDialog 
                      onAddRoom={handleAddRoom} 
                      existingRooms={rooms} 
                    />
                <PdfWorkflowDialog 
                  hotelId={currentHotelId}
                  onWorkflowComplete={(data, housekeepers, distributionMethod) => {
                    handlePdfProcessed(data, housekeepers, distributionMethod);
                  }}
                />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Filtres et options</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RoomFilters 
                      rooms={rooms}
                      onFiltersChange={(filteredRooms) => setFilteredRooms(filteredRooms)}
                    />
                  </CardContent>
                </Card>
                
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N° Chambre</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Type de nettoyage</TableHead>
                        <TableHead>Priorité</TableHead>
                        <TableHead>Assignée à</TableHead>
                        <TableHead>Twin</TableHead>
                        <TableHead>Chambres liées</TableHead>
                        <TableHead>Actions rapides</TableHead>
                        <TableHead>Gestion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(filteredRooms || rooms).map((room) => (
                        <TableRow key={room.number}>
                          <TableCell className="font-medium">{room.number}</TableCell>
                          <TableCell>{getStatusBadge(room.status)}</TableCell>
                          <TableCell>{getCleaningTypeBadge(room.cleaningType)}</TableCell>
                          <TableCell>
                            {room.priority === 'high' ? (
                              <Badge variant="destructive">Élevée</Badge>
                            ) : (
                              <Badge variant="secondary">Normale</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {room.assignedTo ? (
                              <Badge variant="outline">{room.assignedTo}</Badge>
                            ) : (
                              <span className="text-muted-foreground">Non assignée</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Checkbox
                              checked={room.isTwin || false}
                              onCheckedChange={(checked) => {
                                handleRoomUpdate({ ...room, isTwin: checked as boolean });
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            {room.linkedRooms && room.linkedRooms.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {room.linkedRooms.map(linkedRoom => (
                                  <Badge key={linkedRoom} variant="secondary" className="text-xs">
                                    {linkedRoom}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">Aucune</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <RoomCard
                              room={room}
                              onUpdate={handleRoomUpdate}
                              onUnassign={handleRoomUnassign}
                              onReassign={handleRoomReassign}
                              allRooms={rooms}
                              housekeeperNames={housekeeperNames}
                              compact={true}
                              showActions={true}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedRoom(room);
                                  setShowLinkDialog(true);
                                }}
                                className="flex items-center gap-1"
                                title="Lier avec d'autres chambres"
                              >
                                <Link className="h-3 w-3" />
                                Lier
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedRoom(room);
                                  setShowDeleteDialog(true);
                                }}
                                className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Supprimer la chambre"
                              >
                                <Trash2 className="h-3 w-3" />
                                Supprimer
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </TabsContent>



          <TabsContent value="distribution" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Distribution des chambres</h2>
              <div className="flex gap-2">
                <QuickAddHousekeeperButton />
                <SyncHousekeepersButton />
                <Button
                  onClick={() => setIsRedistributionDialogOpen(true)}
                  disabled={housekeeperNames.length === 0 || rooms.length === 0}
                  className="hover-scale"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Redistribuer
                </Button>
                <Button
                  onClick={() => openManualAssignment()}
                  variant="outline"
                  disabled={housekeeperNames.length === 0}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Assignation manuelle
                </Button>
              </div>
            </div>

            {/* Message informatif si pas de femmes de chambre */}
            {housekeeperNames.length === 0 ? (
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <UserIcon className="h-16 w-16 text-orange-500 mb-4" />
                  <h3 className="text-xl font-semibold text-orange-800 mb-2">
                    Aucune femme de chambre configurée
                  </h3>
                  <p className="text-orange-700 text-center mb-6 max-w-md">
                    Pour voir les colonnes de distribution avec les codes d'accès mobile, 
                    vous devez d'abord créer des femmes de chambre.
                  </p>
                  <div className="flex flex-col gap-3 items-center">
                    <Button 
                      onClick={() => setActiveTab('access-codes')}
                      className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2"
                    >
                      <UserIcon className="mr-2 h-4 w-4" />
                      Créer des femmes de chambre
                    </Button>
                    <p className="text-sm text-orange-600">
                      Les codes d'accès mobile s'afficheront ici une fois créées
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="assignment" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Affectation des chambres</h2>
              <div className="flex gap-2">
                <Button
                  onClick={() => openManualAssignment()}
                  disabled={!isDistributed}
                  variant="outline"
                >
                  <UserIcon className="mr-2 h-4 w-4" />
                  Assignation manuelle
                </Button>
                <Button
                  onClick={() => setIsRedistributionDialogOpen(true)}
                  disabled={!isDistributed}
                  variant="outline"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Redistribuer
                </Button>
              </div>
            </div>

            {!isDistributed ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Distribution non effectuée</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Cliquez sur "Distribuer" pour répartir automatiquement les chambres
                  </p>
                  <Button
                    onClick={handleDistributeWithValidation}
                    disabled={housekeeperNames.length === 0 || rooms.length === 0}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    Distribuer maintenant
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <div className="space-y-6">
                  {/* Disponibilités du jour et recommandations */}
                  {(recommendedHousekeepers > housekeeperNames.length || getUnassignedRooms().length > 0) && (
                    <Card>
                      <CardContent className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-semibold">Disponibilités du jour</h3>
                            <p className="text-sm text-muted-foreground">
                              {recommendedHousekeepers > housekeeperNames.length
                                ? `Recommandation: ${recommendedHousekeepers} femmes de chambre pour aujourd'hui.`
                                : `${getUnassignedRooms().length} chambre(s) restent non assignées.`}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={() => setShowInviteDialog(true)}>
                              Inviter / Ajouter
                            </Button>
                            <Button variant="outline" onClick={() => setActiveTab('access-codes')}>
                              Gérer l'équipe
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Chambres non assignées en haut - toujours visible */}
                  <div className="w-full">
                    <UnassignedRoomsColumn
                      rooms={getUnassignedRooms()}
                      onRoomUpdate={handleRoomUpdate}
                      allRooms={rooms}
                      forceHide={false}
                      housekeeperNames={housekeeperNames}
                      onDirectAssign={handleDirectRoomAssignment}
                    />

                    <HousekeeperInviteDialog
                      open={showInviteDialog}
                      onOpenChange={setShowInviteDialog}
                      hotelId={(hotel?.id as string) || (currentHotelId as string) || ''}
                    />
                  </div>
                  </div>
                  
                  {/* Grid responsive pour 2 sections en largeur avec codes d'accès */}
                  {housekeeperNames.length > 0 && (
                    <div className="mb-4">
                      <Alert className="bg-blue-50 border-blue-200">
                        <Key className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-blue-800">
                          <strong>Codes d'accès mobile :</strong> Chaque colonne affiche le code d'accès 
                          spécifique à chaque femme de chambre pour l'interface mobile.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                  
                  <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-2">
                    {housekeeperNames.map((name) => {
                      const housekeeperRooms = getHousekeeperRooms(name);
                      const housekeeper = housekeepers.find(h => h.name === name);
                      return (
                        <div key={name} className="min-w-0 w-full">
                          <HousekeeperCard
                            name={name}
                            rooms={housekeeperRooms}
                            cleaningConfig={cleaningConfig}
                            onGenerateReport={handleGenerateReport}
                            onRoomUpdate={handleRoomUpdate}
                            onRoomUnassign={handleRoomUnassign}
                            onReassign={handleRoomReassign}
                            availableFloors={availableFloors}
                            onFloorPreferenceChange={handleFloorPreferenceChange}
                            preferredFloors={housekeeperFloorPreferences[name] || []}
                            onDelete={handleDeleteHousekeeper}
                            maxRoomsOverride={housekeeperMaxRoomsOverrides[name]}
                            onMaxRoomsOverrideChange={handleMaxRoomsOverrideChange}
                            onRename={(newName: string) => handleRenameHousekeeper(name, newName)}
                            accessCode={housekeeper?.access_code || ''}
                            housekeeperNames={housekeeperNames}
                            onGenerateAccessCode={handleGenerateAccessCode}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Rapports</h2>
              <Button
                onClick={handleGenerateAllReports}
                disabled={!isDistributed || housekeeperNames.filter(name => getHousekeeperRooms(name).length > 0).length === 0}
              >
                <FileDown className="mr-2 h-4 w-4" />
                Générer tous les rapports
              </Button>
            </div>

            {!isDistributed ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Distribution requise</AlertTitle>
                <AlertDescription>
                  Vous devez d'abord distribuer les chambres pour générer des rapports.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {housekeeperNames.map((name) => {
                  const housekeeperRooms = getHousekeeperRooms(name);
                  if (housekeeperRooms.length === 0) return null;
                  
                  return (
                    <Card key={name}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span>{name}</span>
                          <Badge variant="secondary">
                            {housekeeperRooms.length} chambres
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 mb-4">
                          <div className="text-sm">
                            <span className="font-medium">Nettoyage complet:</span>{" "}
                            {housekeeperRooms.filter(r => r.cleaningType === 'full').length}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Recouches:</span>{" "}
                            {housekeeperRooms.filter(r => r.cleaningType === 'quick').length}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Temps estimé:</span>{" "}
                            {Math.round(calculateHousekeeperLoad(housekeeperRooms, cleaningConfig) / 60)}h
                          </div>
                        </div>
                        <Button
                          onClick={() => handleGenerateReport(name, housekeeperRooms)}
                          className="w-full"
                          size="sm"
                        >
                          <FileDown className="mr-2 h-4 w-4" />
                          Générer rapport
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="access-codes" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Gestion des codes d'accès
                </CardTitle>
                <CardDescription>
                  Codes d'accès des femmes de chambre et demandes en attente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="requests" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="requests" className="relative">
                      Demandes d'accès
                      <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs animate-pulse">
                        !
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="codes">
                      Codes existants
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="requests" className="space-y-4">
                    <Alert className="bg-blue-50 border-blue-200">
                      <Bell className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800">
                        <strong>📋 Comment ça marche ?</strong> Les femmes de chambre s'inscrivent et soumettent une demande avec votre code d'hôtel. 
                        Vous recevez une notification ici et pouvez <strong>valider</strong> ou <strong>suspendre</strong> leur accès.
                      </AlertDescription>
                    </Alert>
                    
                    <HousekeeperAccessRequests />
                  </TabsContent>
                  
                  <TabsContent value="codes" className="space-y-4">
                    <p className="text-muted-foreground">
                      Codes d'accès des femmes de chambre déjà validées. 
                      Gérez le personnel complet depuis l'onglet "Vue d'ensemble".
                    </p>
                    <div className="mt-4">
                      <HousekeeperManagement />
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mobile" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Accès mobile</h2>
            </div>

            {!canAccessFeature('mobile_access') ? (
              <Alert className="border-premium">
                <Lock className="h-4 w-4" />
                <AlertTitle>Fonctionnalité Premium</AlertTitle>
                <AlertDescription className="flex flex-col gap-4">
                  <p>L'accès mobile aux codes d'accès pour les femmes de chambre est réservé aux utilisateurs Premium.</p>
                  <UpgradeButton />
                </AlertDescription>
              </Alert>
            ) : !isDistributed ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Distribution requise</AlertTitle>
                <AlertDescription>
                  Vous devez d'abord distribuer les chambres pour générer les codes d'accès mobile.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <NotificationBell hotelId={currentHotelId} />
                  <Badge variant="premium" className="gap-1">
                    <Smartphone className="h-3 w-3" />
                    Accès Mobile Premium
                  </Badge>
                </div>
                
                {/* Affichage des femmes de chambre avec leurs codes d'accès */}
                {housekeeperNames.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-4">Accès femmes de chambre</h3>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {housekeeperNames.map((name) => {
                        const housekeeperRooms = getHousekeeperRooms(name);
                        const housekeeper = housekeepers.find(h => h.name === name);
                        
                        return (
                          <Card key={name}>
                            <CardHeader>
                              <CardTitle className="flex items-center justify-between">
                                <span>{name}</span>
                                <Badge variant="secondary">
                                  {housekeeperRooms.length} chambres
                                </Badge>
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-4">
                                {/* Code d'accès affiché en premier */}
                                {housekeeper?.access_code && (
                                  <div className="text-center">
                                    <div className="bg-primary/10 px-3 py-2 rounded-lg border">
                                      <div className="text-xs text-muted-foreground mb-1">Code d'accès</div>
                                      <div className="font-mono font-bold text-lg text-primary">
                                        {housekeeper.access_code}
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                <div className="text-sm text-muted-foreground">
                                  Chambres assignées: {housekeeperRooms.map(r => r.number).join(', ')}
                                </div>
                                
                                <div className="text-center">
                                  <Button
                                    onClick={() => window.open(`/housekeeper/login`, '_blank')}
                                    className="w-full"
                                    size="sm"
                                  >
                                    <Smartphone className="mr-2 h-4 w-4" />
                                    Ouvrir interface femme de chambre
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="linen" className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">🧺 Inventaire du linge</h2>
                <p className="text-muted-foreground">Gérer les types de linge, entraîner l'IA et assigner les tâches</p>
              </div>
            </div>

            <Tabs defaultValue="types" className="space-y-4">
              <TabsList>
                <TabsTrigger value="types">Types de linge</TabsTrigger>
                <TabsTrigger value="training">Entraînement IA</TabsTrigger>
                <TabsTrigger value="tasks">Attribution des tâches</TabsTrigger>
              </TabsList>

              <TabsContent value="types" className="space-y-4">
                {currentHotelId ? (
                  <LinenTypeManager hotelId={currentHotelId} />
                ) : (
                  <Alert>
                    <AlertDescription>Aucun hôtel sélectionné</AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              <TabsContent value="training" className="space-y-4">
                {currentHotelId ? (
                  <LinenTrainingManager hotelId={currentHotelId} />
                ) : (
                  <Alert>
                    <AlertDescription>Aucun hôtel sélectionné</AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              <TabsContent value="tasks" className="space-y-4">
                {currentHotelId ? (
                  <LinenTaskAssignment hotelId={currentHotelId} />
                ) : (
                  <Alert>
                    <AlertDescription>Aucun hôtel sélectionné</AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="incidents" className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">Gestion des incidents</h2>
                <p className="text-muted-foreground">Gérer les incidents, le personnel et l'inventaire</p>
              </div>
              {currentHotelId && (
                <IncidentReportDialogSimple hotelId={currentHotelId} userType="admin" />
              )}
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

              <TabsContent value="dashboard" className="space-y-4">
                {currentHotelId ? (
                  <IncidentDashboard hotelId={currentHotelId} />
                ) : (
                  <Alert>
                    <AlertDescription>Aucun hôtel sélectionné pour afficher le tableau de bord</AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              <TabsContent value="incidents" className="space-y-4">
                {currentHotelId ? (
                  <IncidentList hotelId={currentHotelId} />
                ) : (
                  <Alert>
                    <AlertDescription>Aucun hôtel sélectionné pour gérer les incidents</AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              <TabsContent value="staff" className="space-y-4">
                {currentHotelId ? (
                  <StaffManagement hotelId={currentHotelId} />
                ) : (
                  <Alert>
                    <AlertDescription>Aucun hôtel sélectionné pour gérer le personnel</AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              <TabsContent value="inventory" className="space-y-4">
                {currentHotelId ? (
                  <IncidentInventoryManager hotelId={currentHotelId} />
                ) : (
                  <Alert>
                    <AlertDescription>Aucun hôtel sélectionné pour gérer l'inventaire</AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              <TabsContent value="permissions" className="space-y-4">
                {currentHotelId ? (
                  <RolePermissionsManager hotelId={currentHotelId} />
                ) : (
                  <Alert>
                    <AlertDescription>Aucun hôtel sélectionné pour gérer les permissions</AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              <TabsContent value="print" className="space-y-4">
                {currentHotelId ? (
                  <IncidentReportPrint hotelId={currentHotelId} />
                ) : (
                  <Alert>
                    <AlertDescription>Aucun hôtel sélectionné pour imprimer les rapports</AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>

      <ManualAssignmentDialog
        isOpen={isManualAssignmentOpen}
        onClose={() => setIsManualAssignmentOpen(false)}
        rooms={rooms}
        housekeeperNames={housekeeperNames}
        onAssignRooms={handleManualAssign}
        housekeeperPreferredFloors={housekeeperFloorPreferences}
      />
      
      <EmailDialog
        isOpen={isEmailDialogOpen}
        onClose={() => setIsEmailDialogOpen(false)}
        onConfirm={handleEmailConfirm}
      />
      
      <EmailReportDialog
        isOpen={isReportDialogOpen}
        onClose={() => setIsReportDialogOpen(false)}
        onConfirm={handleReportConfirm}
        initialEmail={email}
        housekeeperName={reportAction === "single" ? reportHousekeeper : undefined}
        allHousekeepers={housekeeperNames.filter(name => getHousekeeperRooms(name).length > 0)}
      />
      
      {/* Dialogs de gestion des chambres */}
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
      
      {/* Dialogue de sélection d'hôtel */}
      <Dialog open={isHotelSelectionOpen} onOpenChange={setIsHotelSelectionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sélectionner un hôtel</DialogTitle>
            <DialogDescription>
              Vous devez sélectionner un hôtel avant de distribuer les chambres.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {availableHotels.length === 0 ? (
              <div className="text-center py-4">
                <Building className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Aucun hôtel configuré</p>
                <p className="text-sm text-muted-foreground">
                  Créez d'abord un hôtel dans la section Configuration
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {availableHotels.map((hotel) => (
                  <div 
                    key={hotel.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleHotelSelection(hotel)}
                  >
                    <div className="flex items-center gap-3">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{hotel.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Code: {hotel.hotel_code}
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Sélectionner
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHotelSelectionOpen(false)}>
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de redistribution */}
      <RedistributionDialog
        isOpen={isRedistributionDialogOpen}
        onClose={() => setIsRedistributionDialogOpen(false)}
        onRedistribute={handleRedistribute}
        housekeeperCount={housekeeperNames.length}
        roomCount={rooms.filter(r => r.cleaningType !== 'none' && r.status !== 'maintenance').length}
      />
      </div>
    </>
  );
};

export default Index;
