import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserIcon, FileText, Calendar, Layers, Plus, FileDown, AlertTriangle, Check, Bed, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UploadDialog } from "@/components/UploadDialog";
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
import EmailReportDialog from "@/components/EmailReportDialog";
import { autoDistributeRooms } from "@/components/assignment/RoomDistribution";
import { ReportFields as CustomReportFields } from "@/components/ReportCustomFields";
import { useHousekeeping } from "@/contexts/HousekeepingContext";
import { NotificationPanel } from "@/components/NotificationPanel";
import { HotelSetup } from "@/components/HotelSetup";
import { HousekeeperSetup } from "@/components/HousekeeperSetup";
import { SupabaseService } from "@/services/supabaseService";

const Index = () => {
  const navigate = useNavigate();
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
  
  useEffect(() => {
    const initialPreferences: Record<string, number[]> = {};
    housekeeperNames.forEach((name) => {
      initialPreferences[name] = [];
    });
    setHousekeeperFloorPreferences(initialPreferences);
  }, [housekeeperNames]);
  
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
        return <Badge variant="outline" className="bg-purple-100 text-purple-800">À Blanc</Badge>;
      case 'quick':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Recouche</Badge>;
      case 'none':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Aucun</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };
  
  const redistributeRooms = async () => {
    console.log("Début redistribution, rooms:", rooms.length, "housekeepers:", housekeeperNames.length);
    
    // Générer des codes d'accès simples pour chaque femme de chambre
    const accessCodes: Record<string, string> = {};
    for (const name of housekeeperNames) {
      accessCodes[name] = Math.floor(1000 + Math.random() * 9000).toString();
    }
    
    // Sauvegarder les codes dans le contexte
    setHousekeeperAccessCodes(accessCodes);
    
    // Utiliser autoDistributeRooms pour la distribution
    const assignments = autoDistributeRooms(rooms, housekeeperNames, false);
    
    if (assignments) {
      // Mettre à jour toutes les chambres avec leurs assignations
      const updatedRooms = [...rooms];
      
      for (const housekeeper of housekeeperNames) {
        for (const room of assignments[housekeeper]) {
          const index = updatedRooms.findIndex(r => r.number === room.number);
          if (index !== -1) {
            updatedRooms[index] = { ...updatedRooms[index], assignedTo: housekeeper };
          }
        }
      }
      
      setRooms(updatedRooms);
      setIsDistributed(true);
      
      // Afficher les codes d'accès dans le toast
      const codesMessage = Object.entries(accessCodes)
        .map(([name, code]) => `${name}: ${code}`)
        .join(' | ');
      
      toast({
        title: "Chambres redistribuées !",
        description: `Codes d'accès générés: ${codesMessage}`,
        duration: 15000, // 15 secondes pour laisser le temps de noter les codes
      });
    } else {
      toast({
        variant: "destructive",
        title: "Erreur de redistribution",
        description: "Impossible de redistribuer les chambres automatiquement.",
      });
    }
  };
  
  const openManualAssignment = (housekeeperName?: string) => {
    setSelectedHousekeeper(housekeeperName || "");
    setIsManualAssignmentOpen(true);
  };
  
  const handleManualAssign = (housekeeperName: string, selectedRooms: Room[]) => {
    const updatedRooms = [...rooms];
    
    for (const room of selectedRooms) {
      const index = updatedRooms.findIndex(r => r.number === room.number);
      if (index !== -1) {
        updatedRooms[index] = { ...updatedRooms[index], assignedTo: housekeeperName };
      }
    }
    
    setRooms(updatedRooms);
  };
  
  const roomsByFloor = rooms.reduce((acc, room) => {
    const floor = room.floor !== undefined ? room.floor : parseInt(room.number[0]) || 0;
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(room);
    return acc;
  }, {} as Record<number, Room[]>);
  
  Object.keys(roomsByFloor).forEach(floor => {
    roomsByFloor[parseInt(floor)].sort((a, b) => 
      a.number.localeCompare(b.number, undefined, { numeric: true })
    );
  });

  const unassignedRooms = getUnassignedRooms();
  
  const handleEmailConfirm = async (emailAddress: string) => {
    // After email is confirmed, open the report dialog for custom fields
    setIsEmailDialogOpen(false);
    setIsReportDialogOpen(true);
  };
  
  const handleReportConfirm = async (emailAddress: string, customFields?: CustomReportFields) => {
    try {
      if (reportAction === "single" && reportHousekeeper) {
        // Générer le rapport pour une seule femme de chambre
        await generateReport(
          reportHousekeeper, 
          getHousekeeperRooms(reportHousekeeper), 
          cleaningConfig, 
          emailAddress,
          customFields
        );
        
        toast({
          title: "Rapport généré",
          description: `Le rapport pour ${reportHousekeeper} a été créé et envoyé à ${emailAddress}.`,
        });
      } else if (reportAction === "all") {
        // Générer uniquement les rapports pour les femmes de chambre qui ont des chambres assignées
        const housekeepersWithRooms = housekeeperNames
          .filter(name => getHousekeeperRooms(name).length > 0)
          .map(name => ({
            name,
            rooms: getHousekeeperRooms(name)
          }));
        
        // Ajouter les chambres non assignées si elles existent
        const unassignedRooms = rooms.filter(room => !room.assignedTo && room.cleaningType !== 'none');
        if (unassignedRooms.length > 0) {
          housekeepersWithRooms.push({
            name: "Chambres non assignées",
            rooms: unassignedRooms
          });
        }
        
        if (housekeepersWithRooms.length === 0) {
          toast({
            variant: "destructive",
            title: "Aucun rapport à générer",
            description: "Aucune femme de chambre n'a de chambres assignées.",
          });
          return;
        }
        
        // Utiliser la fonction pour générer un PDF combiné
        await generateCombinedReport(
          housekeepersWithRooms, 
          cleaningConfig, 
          emailAddress, 
          customFields
        );
        
        toast({
          title: "Rapport combiné généré",
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
  
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <div className="container mx-auto py-6">
        <div className="flex flex-col items-center mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-center mb-4">NettoBloc</h1>
          
          <div className="w-full max-w-md mb-4">
            <div className="flex items-center space-x-2">
              <Input 
                type="email" 
                placeholder="Email pour les rapports" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
              />
              {isValid ? (
                <Badge variant="outline" className="bg-green-100 text-green-800">
                  Valide
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-red-100 text-red-800">
                  Invalide
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex justify-between items-center w-full">
            <div />
            <div className="flex gap-2 items-center">
              <NotificationPanel />
              <Button
                variant="outline"
                onClick={() => window.open('/housekeeper', '_blank')}
                className="btn-modern bg-gradient-accent hover:bg-gradient-accent/90"
              >
                <Smartphone className="h-4 w-4 mr-2" />
                Interface Mobile
              </Button>
              <ConfigDialog 
                config={cleaningConfig} 
                onConfigChange={handleConfigChange}
                housekeeperNames={housekeeperNames}
                onHousekeeperNamesChange={handleHousekeeperNamesChange}
              />
              <UploadDialog onPdfProcessed={handlePdfProcessed} />
            </div>
          </div>
        </div>
        
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="w-full flex overflow-auto">
            <TabsTrigger value="overview" className="flex-1">Tableau de Bord</TabsTrigger>
            <TabsTrigger value="housekeeping" className="flex-1">Femmes de Chambre</TabsTrigger>
            <TabsTrigger value="rooms" className="flex-1">Toutes les Chambres</TabsTrigger>
            <TabsTrigger value="clean-rooms" className="flex-1">Chambres Propres</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Chambres</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalRooms}</div>
                  <p className="text-xs text-muted-foreground">Chambres dans le rapport</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Femmes de Chambre</CardTitle>
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{housekeeperNames.length}</div>
                  <p className="text-xs text-muted-foreground">Disponibles aujourd'hui</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">À Nettoyer</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{roomsToClean}</div>
                  <div className="text-xs text-muted-foreground flex flex-col">
                    <span>{fullCleaningRooms} à blanc / {quickCleaningRooms} recouches</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Étages</CardTitle>
                  <Layers className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{availableFloors.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {availableFloors.map(f => f === 0 ? 'RDC' : f).join(', ')}
                  </p>
                </CardContent>
              </Card>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Importer un Rapport</CardTitle>
                  <CardDescription>
                    Uploadez un rapport PDF de Mews pour analyser les statuts des chambres
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-md p-10 text-center">
                    <p className="text-gray-500 mb-2">Glissez-déposez votre rapport PDF Mews ici</p>
                    <p className="text-gray-400 text-sm mb-4">ou</p>
                    <UploadDialog onPdfProcessed={handlePdfProcessed} />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Statut du Nettoyage</CardTitle>
                  <CardDescription>
                    Progression actuelle du nettoyage des chambres
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <span className="text-sm font-medium flex-1">Chambres Propres</span>
                        <span className="text-sm text-gray-500">{cleanRooms}/{totalRooms}</span>
                      </div>
                      <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="absolute h-full bg-green-500" 
                          style={{ width: totalRooms > 0 ? `${(cleanRooms/totalRooms)*100}%` : '0%' }}
                        ></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <span className="text-sm font-medium flex-1">Chambres Prioritaires</span>
                        <span className="text-sm text-gray-500">
                          {priorityRooms > 0 ? 
                            `${rooms.filter(r => r.priority === 'high' && r.status === 'clean').length}/${priorityRooms}` : 
                            '0/0'}
                        </span>
                      </div>
                      <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="absolute h-full bg-red-500" 
                          style={{ 
                            width: priorityRooms > 0 ? 
                              `${(rooms.filter(r => r.priority === 'high' && r.status === 'clean').length/priorityRooms)*100}%` : 
                              '0%' 
                          }}
                        ></div>
                      </div>
                    </div>
                    
                    {recommendedHousekeepers > 0 && roomsToClean > 0 && (
                      <Alert className="mt-4 bg-indigo-50">
                        <AlertTriangle className="h-5 w-5 text-indigo-600" />
                        <AlertTitle className="text-indigo-700">Recommandation</AlertTitle>
                        <AlertDescription className="text-indigo-600">
                          Pour {roomsToClean} chambres à nettoyer, nous recommandons {recommendedHousekeepers} femmes de chambre.
                          {housekeeperNames.length < recommendedHousekeepers && (
                            <div className="mt-1 text-xs">
                              ⚠️ Vous avez actuellement {housekeeperNames.length} femmes de chambre configurées, 
                              ce qui est insuffisant pour nettoyer toutes les chambres dans un temps raisonnable.
                            </div>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <div className="mt-6 space-y-2">
                      <Button onClick={redistributeRooms} className="w-full">
                        Distribuer les Chambres
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => openManualAssignment()} 
                        className="w-full flex items-center justify-center gap-2"
                      >
                        <Plus className="h-4 w-4" /> Assigner Manuellement
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="housekeeping" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Attribution des Chambres</h2>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => openManualAssignment()}
                  className="flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" /> Assigner manuellement
                </Button>
                <Button
                  variant="outline"
                  onClick={handleGenerateAllReports}
                  className="flex items-center gap-1"
                  disabled={!isValid && rooms.length === 0}
                >
                  <FileDown className="h-4 w-4" /> Télécharger tous les rapports
                </Button>
                <Button 
                  onClick={redistributeRooms} 
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Distribuer les Chambres
                </Button>
              </div>
            </div>
            
            {/* Recommandation pour le nombre de femmes de chambre */}
            {recommendedHousekeepers > 0 && roomsToClean > 0 && (
              <Alert className="bg-indigo-50 mb-4">
                <AlertTriangle className="h-5 w-5 text-indigo-600" />
                <AlertTitle className="text-indigo-700">Recommandation de personnel</AlertTitle>
                <AlertDescription className="text-indigo-600">
                  Pour nettoyer {roomsToClean} chambres ({fullCleaningRooms} à blanc, {quickCleaningRooms} recouches), 
                  nous recommandons {recommendedHousekeepers} femmes de chambre.
                  {housekeeperNames.length < recommendedHousekeepers && (
                    <div className="mt-1 font-medium">
                      ⚠️ Vous avez actuellement {housekeeperNames.length} femmes de chambre configurées, 
                      ce qui est insuffisant pour la charge de travail actuelle.
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
            
            {unassignedRooms.length > 0 && (
              <div className="mb-6">
                <UnassignedRoomsColumn
                  rooms={unassignedRooms}
                  onRoomUpdate={handleRoomUpdate}
                  draggable={true}
                />
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className={`grid gap-4 md:col-span-4 grid-cols-1 md:grid-cols-2`}>
                {housekeeperNames.map((name) => (
                  <HousekeeperCard 
                    key={name}
                    name={name}
                    onRename={(newName) => handleRenameHousekeeper(name, newName)}
                    rooms={getHousekeeperRooms(name)}
                    onRoomUpdate={handleRoomUpdate}
                    onRoomUnassign={handleRoomUnassign}
                    onGenerateReport={handleGenerateReport}
                    cleaningConfig={cleaningConfig}
                    draggable={true}
                    availableFloors={availableFloors}
                    preferredFloors={housekeeperFloorPreferences[name] || []}
                    onFloorPreferenceChange={handleFloorPreferenceChange}
                    onManualAssign={() => openManualAssignment(name)}
                    unassignedRooms={rooms.filter(room => room.cleaningType !== 'none')} // Passer toutes les chambres, pas seulement les non-assignées
                    showUnassignedColumn={false} // On n'affiche plus les chambres non assignées dans la carte
                    onAssignRoom={(room) => handleRoomUpdate({...room, assignedTo: name})}
                    accessCode={housekeeperAccessCodes[name]}
                    onDelete={handleDeleteHousekeeper}
                    maxRoomsOverride={housekeeperMaxRoomsOverrides[name]}
                    onMaxRoomsOverrideChange={handleMaxRoomsOverrideChange}
                  />
                ))}
                
                {housekeeperNames.length === 0 && (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    <p>Aucune femme de chambre configurée.</p>
                    <Button 
                      onClick={() => setActiveTab("overview")} 
                      variant="link" 
                      className="mt-2"
                    >
                      Configurer les femmes de chambre
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="rooms" className="space-y-4">
            <Card>
              <CardHeader className="flex justify-between items-start">
                <div>
                  <CardTitle>Toutes les Chambres</CardTitle>
                  <CardDescription>
                    Visualiser et gérer toutes les chambres de l'hôtel
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => openManualAssignment()}
                  className="flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" /> Assigner chambres
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {Object.entries(roomsByFloor)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([floor, floorRooms]) => (
                      <div key={floor} className="space-y-2">
                        <h3 className="font-semibold flex items-center gap-2">
                          <Layers className="h-4 w-4" /> 
                          Étage {floor === '0' ? 'RDC' : floor}
                          <Badge variant="outline" className="bg-gray-100 ml-2">
                            {floorRooms.length} chambres
                          </Badge>
                        </h3>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Chambre</TableHead>
                                <TableHead>Statut</TableHead>
                                <TableHead>Type Nettoyage</TableHead>
                                <TableHead>Twin</TableHead>
                                <TableHead>Priorité</TableHead>
                                <TableHead>Assignée À</TableHead>
                                <TableHead>Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {floorRooms.map((room) => (
                                <TableRow key={room.number} className="hover:bg-gray-50">
                                  <TableCell>{room.number}</TableCell>
                                  <TableCell>{getStatusBadge(room.status)}</TableCell>
                                  <TableCell>{getCleaningTypeBadge(room.cleaningType)}</TableCell>
                                  <TableCell>
                                    <Checkbox 
                                      checked={room.isTwin || false}
                                      onCheckedChange={(checked) => handleRoomUpdate({...room, isTwin: !!checked})}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex gap-2">
                                      <Checkbox 
                                        id={`urgent-table-${room.number}`}
                                        checked={room.isUrgent || false}
                                        onCheckedChange={(checked) => {
                                          handleRoomUpdate({
                                            ...room, 
                                            isUrgent: !!checked,
                                            notUrgent: false,
                                            priority: !!checked ? 'high' : 'medium'
                                          });
                                        }}
                                      />
                                      <label htmlFor={`urgent-table-${room.number}`} className="text-xs text-red-500">
                                        Urgent
                                      </label>
                                      
                                      <Checkbox 
                                        id={`noturgent-table-${room.number}`}
                                        checked={room.notUrgent || false}
                                        onCheckedChange={(checked) => {
                                          handleRoomUpdate({
                                            ...room, 
                                            notUrgent: !!checked,
                                            isUrgent: false,
                                            priority: !!checked ? 'low' : 'medium'
                                          });
                                        }}
                                      />
                                      <label htmlFor={`noturgent-table-${room.number}`} className="text-xs text-green-500">
                                        Pas urgent
                                      </label>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {room.assignedTo || 'Non assignée'}
                                  </TableCell>
                                  <TableCell>
                                    <select 
                                      className="border rounded px-2 py-1 text-sm"
                                      value={room.assignedTo || ''}
                                      onChange={(e) => {
                                        const newAssignee = e.target.value;
                                        if (newAssignee) {
                                          // Vérifier si l'housekeeper a atteint sa limite de chambres
                                          const currentRoomsCount = getHousekeeperRooms(newAssignee).length;
                                          const maxRooms = housekeeperMaxRoomsOverrides[newAssignee] || cleaningConfig.maxRoomsPerHousekeeper;
                                          
                                          if (currentRoomsCount >= maxRooms) {
                                            toast({
                                              variant: "destructive",
                                              title: "Limite atteinte",
                                              description: `${newAssignee} a déjà ${currentRoomsCount} chambres assignées (limite: ${maxRooms}).`,
                                            });
                                            return;
                                          }
                                        }
                                        
                                        handleRoomUpdate({...room, assignedTo: e.target.value || undefined})
                                      }}
                                    >
                                      <option value="">Non assignée</option>
                                      {housekeeperNames.map(name => (
                                        <option key={name} value={name}>{name}</option>
                                      ))}
                                    </select>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-4">
              {rooms.filter(room => room.cleaningType !== 'none' && !room.assignedTo).map(room => (
                <RoomCard 
                  key={room.number} 
                  room={room} 
                  onUpdate={handleRoomUpdate} 
                  draggable={true}
                />
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="clean-rooms" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Chambres Propres</CardTitle>
                  <CardDescription>
                    Liste des chambres propres disponibles
                  </CardDescription>
                </div>
                <Badge className="bg-green-100 text-green-800 hover:bg-green-200 text-base py-1 px-3">
                  {cleanRooms} Chambres
                </Badge>
              </CardHeader>
              <CardContent>
                {cleanRooms === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Check className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                    <p className="text-lg">Aucune chambre propre disponible</p>
                    <p className="text-sm mt-1">Toutes les chambres sont à nettoyer ou en maintenance</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(roomsByFloor)
                      .sort(([a], [b]) => parseInt(a) - parseInt(b))
                      .map(([floor, floorRooms]) => {
                        const cleanFloorRooms = floorRooms.filter(room => room.status === 'clean');
                        if (cleanFloorRooms.length === 0) return null;
                        
                        return (
                          <div key={floor} className="space-y-2">
                            <h3 className="font-semibold flex items-center gap-2">
                              <Layers className="h-4 w-4" /> 
                              Étage {floor === '0' ? 'RDC' : floor}
                              <Badge variant="outline" className="bg-green-100 ml-2">
                                {cleanFloorRooms.length} propres
                              </Badge>
                            </h3>
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Chambre</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Twin</TableHead>
                                    <TableHead>Priorité</TableHead>
                                    <TableHead>Action</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {cleanFloorRooms
                                    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
                                    .map((room) => (
                                      <TableRow key={room.number} className="hover:bg-gray-50">
                                        <TableCell className="font-medium">{room.number}</TableCell>
                                        <TableCell>{getStatusBadge(room.status)}</TableCell>
                                        <TableCell>
                                          <Checkbox 
                                            checked={room.isTwin || false}
                                            onCheckedChange={(checked) => handleRoomUpdate({...room, isTwin: !!checked})}
                                          />
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex gap-2">
                                            <Checkbox 
                                              id={`urgent-clean-${room.number}`}
                                              checked={room.isUrgent || false}
                                              onCheckedChange={(checked) => {
                                                handleRoomUpdate({
                                                  ...room, 
                                                  isUrgent: !!checked,
                                                  notUrgent: false,
                                                  priority: !!checked ? 'high' : 'medium'
                                                });
                                              }}
                                            />
                                            <label htmlFor={`urgent-clean-${room.number}`} className="text-xs text-red-500">
                                              Urgent
                                            </label>
                                            
                                            <Checkbox 
                                              id={`noturgent-clean-${room.number}`}
                                              checked={room.notUrgent || false}
                                              onCheckedChange={(checked) => {
                                                handleRoomUpdate({
                                                  ...room, 
                                                  notUrgent: !!checked,
                                                  isUrgent: false,
                                                  priority: !!checked ? 'low' : 'medium'
                                                });
                                              }}
                                            />
                                            <label htmlFor={`noturgent-clean-${room.number}`} className="text-xs text-green-500">
                                              Pas urgent
                                            </label>
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                          <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => handleRoomUpdate({
                                              ...room,
                                              status: 'needs-cleaning',
                                              cleaningType: 'full'
                                            })}
                                          >
                                            Marquer à nettoyer
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-4">
              {rooms.filter(room => room.status === 'clean').map(room => (
                <RoomCard 
                  key={room.number} 
                  room={room} 
                  onUpdate={handleRoomUpdate} 
                  draggable={true}
                />
              ))}
            </div>
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
    </div>
  );
};

export default Index;
