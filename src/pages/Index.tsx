import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserIcon, FileText, Calendar, Layers, Plus, FileDown, AlertTriangle, Check, Bed } from "lucide-react";
import { useEffect, useState } from "react";
import { UploadDialog } from "@/components/UploadDialog";
import { ConfigDialog } from "@/components/ConfigDialog";
import { Room, CleaningConfig, defaultCleaningConfig } from "@/services/pdfService";
import { Badge } from "@/components/ui/badge";
import { RoomCard } from "@/components/RoomCard";
import { HousekeeperCard } from "@/components/HousekeeperCard";
import { generateHousekeeperReport, generateAllHousekeeperReports } from "@/services/reportService";
import { toast } from "@/components/ui/use-toast";
import { ManualAssignmentDialog } from "@/components/ManualAssignmentDialog";
import { EmailDialog } from "@/components/EmailDialog";
import { useReportEmail } from "@/hooks/use-report-email";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

const Index = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [cleaningConfig, setCleaningConfig] = useState<CleaningConfig>(defaultCleaningConfig);
  const [housekeeperNames, setHousekeeperNames] = useState<string[]>([
    "Housekeeper 1", "Housekeeper 2", "Housekeeper 3", "Housekeeper 4"
  ]);
  const [housekeeperFloorPreferences, setHousekeeperFloorPreferences] = useState<Record<string, number[]>>({});
  const [availableFloors, setAvailableFloors] = useState<number[]>([]);
  const [isManualAssignmentOpen, setIsManualAssignmentOpen] = useState(false);
  const [selectedHousekeeper, setSelectedHousekeeper] = useState<string>("");
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [reportAction, setReportAction] = useState<"single" | "all">("single");
  const [reportHousekeeper, setReportHousekeeper] = useState<string>("");
  const { email, isValid } = useReportEmail();

  useEffect(() => {
    const initialPreferences: Record<string, number[]> = {};
    housekeeperNames.forEach((name) => {
      initialPreferences[name] = [];
    });
    setHousekeeperFloorPreferences(initialPreferences);
  }, [housekeeperNames]);
  
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

  const handleFloorPreferenceChange = (housekeeperName: string, floors: number[]) => {
    setHousekeeperFloorPreferences(prev => ({
      ...prev,
      [housekeeperName]: floors
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
    floorPreferences: Record<string, number[]> = {}
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
        const housekeepersForFloor = housekeepers.filter(name => 
          floorPreferences[name]?.includes(preferredFloor)
        );
        if (housekeepersForFloor.length > 0) {
          candidates = housekeepersForFloor;
        }
      }
      
      let minLoadHousekeeper = candidates[0];
      let minLoad = calculateHousekeeperLoad(assignments[minLoadHousekeeper], cleaningConfig);
      
      for (let i = 1; i < candidates.length; i++) {
        const currentLoad = calculateHousekeeperLoad(assignments[candidates[i]], cleaningConfig);
        if (currentLoad < minLoad) {
          minLoad = currentLoad;
          minLoadHousekeeper = candidates[i];
        }
      }
      
      return minLoadHousekeeper;
    };
    
    const assignedRooms = new Set<string>();
    
    for (const room of roomsToClean.filter(r => r.priority === 'high')) {
      const floor = room.floor !== undefined ? room.floor : parseInt(room.number[0]) || 0;
      const housekeeper = findMinLoadHousekeeper(floor);
      
      assignments[housekeeper].push({ ...room, assignedTo: housekeeper });
      assignedRooms.add(room.number);
    }
    
    Object.entries(roomsByFloor).forEach(([floor, floorRooms]) => {
      const floorNum = parseInt(floor);
      for (const room of floorRooms) {
        if (assignedRooms.has(room.number)) continue;
        
        const housekeeper = findMinLoadHousekeeper(floorNum);
        assignments[housekeeper].push({ ...room, assignedTo: housekeeper });
        assignedRooms.add(room.number);
      }
    });
    
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
    setIsEmailDialogOpen(true);
  };
  
  const handleGenerateAllReports = async () => {
    setReportAction("all");
    setIsEmailDialogOpen(true);
  };
  
  const handleEmailConfirm = async (confirmedEmail: string) => {
    setIsEmailDialogOpen(false);
    
    try {
      if (reportAction === "single") {
        const housekeeperRooms = getHousekeeperRooms(reportHousekeeper);
        await generateHousekeeperReport(reportHousekeeper, housekeeperRooms, cleaningConfig, confirmedEmail);
        toast({
          title: "Rapport généré",
          description: `Le rapport pour ${reportHousekeeper} a été créé avec succès.`,
        });
      } else {
        const housekeepersWithRooms = housekeeperNames.map(name => ({
          name,
          rooms: getHousekeeperRooms(name)
        }));
        
        const unassignedRooms = rooms.filter(room => !room.assignedTo && room.cleaningType !== 'none');
        if (unassignedRooms.length > 0) {
          housekeepersWithRooms.push({
            name: "Chambres non assignées",
            rooms: unassignedRooms
          });
        }
        
        await generateAllHousekeeperReports(housekeepersWithRooms, cleaningConfig, confirmedEmail);
        toast({
          title: "Rapports générés",
          description: `Tous les rapports ont été créés avec succès.`,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de générer le(s) rapport(s). Veuillez réessayer.",
      });
      console.error("Erreur lors de la génération du/des rapport(s):", error);
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
  
  const redistributeRooms = () => {
    distributeRooms(rooms, housekeeperNames, housekeeperFloorPreferences);
    toast({
      title: "Chambres redistribuées",
      description: "Les chambres ont été réparties entre les femmes de chambre.",
    });
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
  
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Gestion des Chambres</h1>
          <div className="flex gap-2">
            <ConfigDialog 
              config={cleaningConfig} 
              onConfigChange={handleConfigChange}
              housekeeperNames={housekeeperNames}
              onHousekeeperNamesChange={handleHousekeeperNamesChange}
            />
            <UploadDialog onPdfProcessed={handlePdfProcessed} />
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
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {unassignedRooms.length > 0 && (
                <Card className="border-red-300 bg-red-50 md:col-span-1 h-fit">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        <CardTitle className="text-red-700 text-lg">Chambres non assignées</CardTitle>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-red-100 text-red-800 w-fit mt-1">
                      {unassignedRooms.length} chambres
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => openManualAssignment()}
                        className="w-full bg-white border-red-300 text-red-700 hover:bg-red-100 mb-3"
                      >
                        Assigner ces chambres
                      </Button>
                      
                      <div className="max-h-[500px] overflow-y-auto space-y-2">
                        {unassignedRooms.map(room => (
                          <div key={room.number} className="border border-red-200 rounded p-2 bg-white">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-medium">{room.number} {room.isTwin && <Bed className="inline h-3 w-3 text-gray-500" />}</p>
                                <div className="flex gap-1 mt-1">
                                  {getCleaningTypeBadge(room.cleaningType)}
                                  {room.isUrgent && <Badge variant="outline" className="bg-red-100 text-red-800">Urgent</Badge>}
                                </div>
                              </div>
                              <select 
                                className="border rounded px-2 py-1 text-sm bg-white"
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleRoomUpdate({...room, assignedTo: e.target.value});
                                  }
                                }}
                                defaultValue=""
                              >
                                <option value="">Assigner</option>
                                {housekeeperNames.map(name => (
                                  <option key={name} value={name}>{name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              <div className={`grid gap-4 ${unassignedRooms.length > 0 ? 'md:col-span-3' : 'md:col-span-4'} grid-cols-1 md:grid-cols-2`}>
                {housekeeperNames.map((name) => (
                  <HousekeeperCard 
                    key={name}
                    name={name}
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
                                      onChange={(e) => handleRoomUpdate({...room, assignedTo: e.target.value || undefined})}
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
    </div>
  );
};

export default Index;
