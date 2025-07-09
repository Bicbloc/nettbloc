import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserIcon, FileText, Calendar, Layers, Plus, FileDown, AlertTriangle, Check, Bed, Smartphone, Building } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PdfWorkflowDialog } from "@/components/PdfWorkflowDialog";
import { ActiveUsersPanel } from "@/components/ActiveUsersPanel";
import { useSessionTracking } from "@/hooks/use-session-tracking";
import { ConfigDialog } from "@/components/ConfigDialog";
import { Room, CleaningConfig, defaultCleaningConfig } from "@/services/pdfService";
import { Badge } from "@/components/ui/badge";
import { RoomCard } from "@/components/RoomCard";
import { HousekeeperCard } from "@/components/HousekeeperCard";
import { UnassignedRoomsColumn } from "@/components/UnassignedRoomsColumn";
import { generateReport, generateCombinedReport } from "@/services/reportService";
import { toast } from "@/hooks/use-toast";
import { ManualAssignmentDialog } from "@/components/ManualAssignmentDialog";
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
import { ReportFields as CustomReportFields } from "@/components/ReportCustomFields";
import { useHousekeeping } from "@/contexts/HousekeepingContext";
import { NotificationPanel } from "@/components/NotificationPanel";
import { ActionLogPanel } from "@/components/ActionLogPanel";
import { RoomFilters } from "@/components/RoomFilters";
import { HousekeeperSetup } from "@/components/HousekeeperSetup";
import { SupabaseService } from "@/services/supabaseService";
import { saveEmailHotelAssociation, getHotelCodeForEmail } from "@/lib/supabase";
import { useNotifications } from "@/hooks/use-notifications";

const Index = () => {
  const navigate = useNavigate();
  useSessionTracking(); // Hook pour tracker les sessions
  const [activeTab, setActiveTab] = useState("overview");
  const [cleaningConfig, setCleaningConfig] = useState<CleaningConfig>(defaultCleaningConfig);
  const { 
    housekeeperNames, 
    setHousekeeperNames,
    rooms,
    setRooms,
    isDistributed,
    setIsDistributed,
    housekeeperAccessCodes,
    setHousekeeperAccessCodes
  } = useHousekeeping();
  
  console.log("Index - isDistributed:", isDistributed); // Debug log
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

  // États pour la gestion des hôtels
  const [availableHotels, setAvailableHotels] = useState<any[]>([]);
  const [selectedHotel, setSelectedHotel] = useState<any | null>(null);
  const [isHotelSelectionOpen, setIsHotelSelectionOpen] = useState(false);
  const [hotelCode, setHotelCode] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isActionLogOpen, setIsActionLogOpen] = useState(false);
  const [filteredRooms, setFilteredRooms] = useState<Room[] | null>(null);
  
  // Notifications pour l'admin
  const { notifications, hasUnread, addNotification, markAsRead, markAllAsRead, clearNotifications } = useNotifications(selectedHotel?.id);
  
  useEffect(() => {
    const initialPreferences: Record<string, number[]> = {};
    housekeeperNames.forEach((name) => {
      initialPreferences[name] = [];
    });
    setHousekeeperFloorPreferences(initialPreferences);
  }, [housekeeperNames]);

  // Charger les valeurs depuis localStorage et vérifier l'authentification
  useEffect(() => {
    const savedHotelCode = localStorage.getItem('selectedHotelCode');
    const savedUserEmail = localStorage.getItem('userEmail');
    
    if (savedHotelCode && savedUserEmail) {
      setHotelCode(savedHotelCode);
      setUserEmail(savedUserEmail);
      
      // Vérifier l'association email/code hôtel
      const storedCode = getHotelCodeForEmail(savedUserEmail);
      
      if (storedCode === savedHotelCode) {
        setIsAuthenticated(true);
      }
    }
  }, []);
  
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

  const handleDeleteHousekeeper = (housekeeperName: string) => {
    setHousekeeperNames(prev => prev.filter(name => name !== housekeeperName));
    
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
  
  const handlePdfProcessed = (data: Room[]) => {
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
    
    setRooms(sortedData);
    setActiveTab("rooms");
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
    
    if (email && isValid) {
      // Si l'email est déjà valide, ouvrir le dialog pour les champs personnalisés
      setIsReportDialogOpen(true);
    } else {
      // Sinon, ouvrir la boîte de dialogue pour entrer l'email
      setIsEmailDialogOpen(true);
    }
  };
  
  const handleGenerateAllReports = async () => {
    setReportAction("all");
    
    if (email && isValid) {
      // Si l'email est déjà valide, ouvrir le dialog pour les champs personnalisés
      setIsReportDialogOpen(true);
    } else {
      // Sinon, ouvrir la boîte de dialogue pour entrer l'email
      setIsEmailDialogOpen(true);
    }
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
  
  const doRedistribution = async () => {
    console.log("Début redistribution, rooms:", rooms.length, "housekeepers:", housekeeperNames.length);
    
    // Générer des codes d'accès simples pour chaque femme de chambre
    const accessCodes: Record<string, string> = {};
    for (const name of housekeeperNames) {
      accessCodes[name] = Math.floor(1000 + Math.random() * 9000).toString();
    }
    
    // Sauvegarder les codes dans le contexte
    console.log("Codes d'accès générés:", accessCodes);
    setHousekeeperAccessCodes(accessCodes);
    
    // Créer ou mettre à jour les femmes de chambre dans Supabase
    try {
      const selectedHotelData = selectedHotel || {
        id: localStorage.getItem('selectedHotelId') || hotelCode,
        name: hotelCode,
        hotel_code: hotelCode
      };
      
      if (selectedHotelData.id) {
        for (const name of housekeeperNames) {
          await SupabaseService.createOrUpdateHousekeeper(
            name,
            accessCodes[name],
            selectedHotelData.id
          );
        }
        console.log("Femmes de chambre mises à jour dans Supabase");
      }
    } catch (error) {
      console.error("Erreur lors de la création des femmes de chambre:", error);
    }
    
    // Effectuer la distribution automatique
    distributeRooms(rooms, housekeeperNames, housekeeperFloorPreferences, housekeeperMaxRoomsOverrides);
    
    // Mettre à jour l'état de distribution
    setIsDistributed(true);
    console.log("Distribution terminée, isDistributed mis à true");
    
    // Changer d'onglet vers la distribution
    setActiveTab("distribution");
    
    toast({
      title: "Distribution terminée",
      description: `Les chambres ont été automatiquement réparties entre ${housekeeperNames.length} femme(s) de chambre.`
    });
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

    // Créer ou récupérer l'hôtel
    try {
      let hotel = await SupabaseService.getHotelByCode(hotelCode);
      
      if (!hotel) {
        // Créer l'hôtel s'il n'existe pas
        hotel = await SupabaseService.createHotel(
          hotelCode,  // name
          userEmail,  // email
          hotelCode   // hotelCode
        );
        console.log("Hôtel créé:", hotel);
      }
      
      if (!hotel) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de créer ou récupérer l'hôtel."
        });
        return;
      }

      // Sauvegarder les informations dans localStorage
      localStorage.setItem('selectedHotelCode', hotelCode);
      localStorage.setItem('userEmail', userEmail);
      
      console.log("Début redistribution avec hôtel:", hotel);
      setSelectedHotel(hotel);
      await doRedistribution();
    } catch (error) {
      console.error("Erreur lors de la création/récupération de l'hôtel:", error);
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
      doRedistribution();
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
        await generateReport(reportHousekeeper, housekeeperRooms, cleaningConfig, confirmedEmail, customFields);
        
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
          confirmedEmail, 
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
  
  // Interface de connexion si pas encore authentifié
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">NettoBloc</CardTitle>
            <CardDescription>
              Veuillez vous identifier pour accéder à l'interface
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="votre@email.com"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hotelCode">Code de l'hôtel</Label>
              <Input
                id="hotelCode"
                type="text"
                placeholder="CODE123"
                value={hotelCode}
                onChange={(e) => setHotelCode(e.target.value)}
              />
            </div>
            <Button 
              onClick={() => {
                setEmail(userEmail);
                setIsAuthenticated(true);
              }}
              className="w-full"
            >
              Confirmer
            </Button>
            <div className="text-center pt-4">
              <Button 
                variant="outline" 
                onClick={() => navigate("/housekeeper-login")}
              >
                Accès Femme de Chambre
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <div className="container mx-auto py-6">
        <div className="flex flex-col items-center mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-center mb-4">NettoBloc</h1>
          
          {/* Configuration de l'hôtel - Entrée directe du code */}
          <div className="w-full max-w-2xl mb-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-blue-600" />
                  Configuration Hôtel
                </CardTitle>
                <CardDescription>
                  Entrez le code de votre hôtel et votre email pour commencer
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="hotel-code" className="text-sm font-medium">
                      Code Hôtel
                    </label>
                    <Input
                      id="hotel-code"
                      placeholder="Ex: HOTEL2024"
                      value={hotelCode}
                      onChange={(e) => setHotelCode(e.target.value.toUpperCase())}
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="user-email" className="text-sm font-medium">
                      Votre Email
                    </label>
                    <Input
                      id="user-email"
                      type="email"
                      placeholder="votre@email.com"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                    />
                  </div>
                </div>
                {hotelCode && userEmail && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-700">
                        Configuration prête - Hôtel: <strong>{hotelCode}</strong>
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Panneau de notifications global */}
        <div className="fixed top-4 right-4 z-50">
          <NotificationPanel 
            notifications={notifications}
            hasUnread={hasUnread}
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Vue d'ensemble
            </TabsTrigger>
            <TabsTrigger value="rooms" className="flex items-center gap-2">
              <Bed className="h-4 w-4" />
              Chambres
            </TabsTrigger>
            <TabsTrigger value="housekeepers" className="flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              Femmes de chambre
            </TabsTrigger>
            <TabsTrigger value="distribution" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Distribution
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

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Chambres</CardTitle>
                  <Bed className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalRooms}</div>
                  <p className="text-xs text-muted-foreground">
                    {roomsToClean} à nettoyer
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Femmes de chambre</CardTitle>
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{housekeeperNames.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {recommendedHousekeepers} recommandées
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Nettoyage complet</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{fullCleaningRooms}</div>
                  <p className="text-xs text-muted-foreground">
                    {quickCleaningRooms} recouches
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Priorité élevée</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{priorityRooms}</div>
                  <p className="text-xs text-muted-foreground">
                    {cleanRooms} déjà propres
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Actions rapides</CardTitle>
                  <CardDescription>
                    Gérez votre planning de nettoyage
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <PdfWorkflowDialog 
                    onWorkflowComplete={(data, housekeepers) => {
                      handlePdfProcessed(data);
                      setHousekeeperNames(housekeepers);
                    }}
                    currentHousekeepers={housekeeperNames}
                  />
                  <ConfigDialog 
                    config={cleaningConfig} 
                    onConfigChange={handleConfigChange}
                    housekeeperNames={housekeeperNames}
                    onHousekeeperNamesChange={handleHousekeeperNamesChange}
                  />
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

              <Card>
                <CardHeader>
                  <CardTitle>Résumé du planning</CardTitle>
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
          </TabsContent>

          <TabsContent value="rooms" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Gestion des chambres</h2>
              <div className="flex gap-2">
                <PdfWorkflowDialog 
                  onWorkflowComplete={(data, housekeepers) => {
                    handlePdfProcessed(data);
                    setHousekeeperNames(housekeepers);
                  }}
                  currentHousekeepers={housekeeperNames}
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
                    Importez un fichier PDF pour commencer à gérer vos chambres
                  </p>
                  <PdfWorkflowDialog 
                    onWorkflowComplete={(data, housekeepers) => {
                      handlePdfProcessed(data);
                      setHousekeeperNames(housekeepers);
                    }}
                    currentHousekeepers={housekeeperNames}
                  />
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
                        <TableHead>Jumelle</TableHead>
                        <TableHead>Actions</TableHead>
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
                            <RoomCard
                              room={room}
                              onUpdate={handleRoomUpdate}
                              onUnassign={handleRoomUnassign}
                              compact={true}
                              showActions={true}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="housekeepers" className="space-y-6">
            <HousekeeperSetup />
          </TabsContent>

          <TabsContent value="distribution" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Distribution des chambres</h2>
              <div className="flex gap-2">
                <Button
                  onClick={handleDistributeWithValidation}
                  disabled={housekeeperNames.length === 0 || rooms.length === 0}
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
              <div className="grid gap-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {housekeeperNames.map((name) => {
                    const housekeeperRooms = getHousekeeperRooms(name);
                    return (
                      <HousekeeperCard
                        key={name}
                        name={name}
                        rooms={housekeeperRooms}
                        cleaningConfig={cleaningConfig}
                        onGenerateReport={handleGenerateReport}
                        onRoomUpdate={handleRoomUpdate}
                        onRoomUnassign={handleRoomUnassign}
                        availableFloors={availableFloors}
                        onFloorPreferenceChange={handleFloorPreferenceChange}
                        preferredFloors={housekeeperFloorPreferences[name] || []}
                        onDelete={handleDeleteHousekeeper}
                        maxRoomsOverride={housekeeperMaxRoomsOverrides[name]}
                        onMaxRoomsOverrideChange={handleMaxRoomsOverrideChange}
                        onRename={(newName: string) => handleRenameHousekeeper(name, newName)}
                        accessCode={housekeeperAccessCodes[name] || ''}
                      />
                    );
                  })}
                  <UnassignedRoomsColumn
                    rooms={getUnassignedRooms()}
                    onRoomUpdate={handleRoomUpdate}
                  />
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

          <TabsContent value="mobile" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Accès mobile</h2>
            </div>

            {!isDistributed ? (
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
                  <Button
                    variant="outline"
                    onClick={() => setIsActionLogOpen(true)}
                    className="ml-2"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Journal des Actions
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {housekeeperNames.map((name) => {
                    const housekeeperRooms = getHousekeeperRooms(name);
                    const accessCode = housekeeperAccessCodes[name] || '';
                    
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
                          <div className="space-y-4 flex-1">
                            <div className="text-center">
                              <div className="text-sm text-muted-foreground mb-2">
                                Code d'accès mobile
                              </div>
                              <div className="text-2xl font-mono font-bold bg-slate-100 rounded-lg py-3 px-4 min-h-[60px] flex items-center justify-center">
                                {accessCode}
                              </div>
                            </div>
                            <div className="text-center mt-auto">
                              <Button
                                onClick={() => window.open(`/housekeeper?code=${accessCode}`, '_blank')}
                                className="w-full hover-scale"
                                size="sm"
                              >
                                <Smartphone className="mr-2 h-4 w-4" />
                                Ouvrir interface mobile
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
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

      {/* Panneau Journal des Actions */}
      <ActionLogPanel 
        hotelId={selectedHotel?.id}
        isOpen={isActionLogOpen}
        onClose={() => setIsActionLogOpen(false)}
      />
    </div>
  );
};

export default Index;
