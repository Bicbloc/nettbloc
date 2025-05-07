
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserIcon, FileText, Calendar, Tag, Bed } from "lucide-react";
import { useEffect, useState } from "react";
import { UploadDialog } from "@/components/UploadDialog";
import { ConfigDialog } from "@/components/ConfigDialog";
import { Room, CleaningConfig, defaultCleaningConfig } from "@/services/pdfService";
import { Badge } from "@/components/ui/badge";
import { RoomCard } from "@/components/RoomCard";
import { HousekeeperCard } from "@/components/HousekeeperCard";
import { generateHousekeeperReport } from "@/services/reportService";
import { toast } from "@/components/ui/use-toast";
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
  
  // Fonction pour mettre à jour une chambre
  const handleRoomUpdate = (updatedRoom: Room) => {
    setRooms(prevRooms => 
      prevRooms.map(room => 
        room.number === updatedRoom.number ? updatedRoom : room
      )
    );
  };
  
  // Fonction pour désaffecter une chambre
  const handleRoomUnassign = (roomToUnassign: Room) => {
    const updatedRoom = { ...roomToUnassign };
    delete updatedRoom.assignedTo;
    handleRoomUpdate(updatedRoom);
  };
  
  const handlePdfProcessed = (data: Room[]) => {
    // Mettre à jour les chambres
    setRooms(data);
    
    // Auto-répartir les chambres entre les femmes de chambre
    distributeRooms(data, housekeeperNames);
    
    // Passer à l'onglet des chambres
    setActiveTab("rooms");
  };
  
  // Distribuer les chambres entre les femmes de chambre
  const distributeRooms = (roomsList: Room[], housekeepers: string[]) => {
    if (housekeepers.length === 0) return;
    
    // Trier les chambres par priorité
    const sortedRooms = [...roomsList].sort((a, b) => {
      // D'abord les prioritaires
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (b.priority === 'high' && a.priority !== 'high') return 1;
      
      // Ensuite par type de nettoyage (à blanc d'abord)
      if (a.cleaningType === 'full' && b.cleaningType !== 'full') return -1;
      if (b.cleaningType === 'full' && a.cleaningType !== 'full') return 1;
      
      // Puis par numéro de chambre
      return a.number.localeCompare(b.number);
    });
    
    // Filtrer uniquement les chambres qui ont besoin de nettoyage
    const roomsToClean = sortedRooms.filter(room => 
      room.cleaningType !== 'none' && room.status !== 'maintenance'
    );
    
    // Calculer le temps total et la répartition idéale
    const totalFullCleaning = roomsToClean.filter(r => r.cleaningType === 'full').length;
    const totalQuickCleaning = roomsToClean.filter(r => r.cleaningType === 'quick').length;
    
    const totalTimeRequired = 
      (totalFullCleaning * cleaningConfig.fullCleaningTime) + 
      (totalQuickCleaning * cleaningConfig.quickCleaningTime);
    
    const timePerHousekeeper = totalTimeRequired / housekeepers.length;
    
    // Distribuer les chambres en essayant d'équilibrer le temps
    const assignedRooms = new Set<string>();
    const assignments: Record<string, Room[]> = {};
    
    // Initialiser les listes d'assignation
    housekeepers.forEach(name => {
      assignments[name] = [];
    });
    
    // Première passe: assigner les chambres prioritaires
    for (const room of roomsToClean.filter(r => r.priority === 'high')) {
      let minLoadHousekeeper = housekeepers[0];
      let minLoad = calculateHousekeeperLoad(assignments[minLoadHousekeeper], cleaningConfig);
      
      for (let i = 1; i < housekeepers.length; i++) {
        const currentLoad = calculateHousekeeperLoad(assignments[housekeepers[i]], cleaningConfig);
        if (currentLoad < minLoad) {
          minLoad = currentLoad;
          minLoadHousekeeper = housekeepers[i];
        }
      }
      
      assignments[minLoadHousekeeper].push({ ...room, assignedTo: minLoadHousekeeper });
      assignedRooms.add(room.number);
    }
    
    // Deuxième passe: assigner les chambres restantes
    for (const room of roomsToClean) {
      if (assignedRooms.has(room.number)) continue;
      
      let minLoadHousekeeper = housekeepers[0];
      let minLoad = calculateHousekeeperLoad(assignments[minLoadHousekeeper], cleaningConfig);
      
      for (let i = 1; i < housekeepers.length; i++) {
        const currentLoad = calculateHousekeeperLoad(assignments[housekeepers[i]], cleaningConfig);
        if (currentLoad < minLoad) {
          minLoad = currentLoad;
          minLoadHousekeeper = housekeepers[i];
        }
      }
      
      assignments[minLoadHousekeeper].push({ ...room, assignedTo: minLoadHousekeeper });
      assignedRooms.add(room.number);
    }
    
    // Mettre à jour les chambres
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
  
  // Calculer la charge de travail d'une femme de chambre
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
  
  // Générer un rapport pour une femme de chambre
  const handleGenerateReport = async (housekeeperName: string, housekeeperRooms: Room[]) => {
    try {
      await generateHousekeeperReport(housekeeperName, housekeeperRooms, cleaningConfig);
      toast({
        title: "Rapport généré",
        description: `Le rapport pour ${housekeeperName} a été créé avec succès.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de générer le rapport. Veuillez réessayer.",
      });
      console.error("Erreur lors de la génération du rapport:", error);
    }
  };
  
  // Calculer les statistiques
  const totalRooms = rooms.length;
  const roomsToClean = rooms.filter(r => r.status === 'needs-cleaning' || r.cleaningType !== 'none').length;
  const fullCleaningRooms = rooms.filter(r => r.cleaningType === 'full').length;
  const quickCleaningRooms = rooms.filter(r => r.cleaningType === 'quick').length;
  const priorityRooms = rooms.filter(r => r.priority === 'high').length;
  const cleanedRooms = rooms.filter(r => r.status === 'clean').length;
  const twinRooms = rooms.filter(r => r.isTwin).length;
  
  // Obtenir les chambres assignées à chaque femme de chambre
  const getHousekeeperRooms = (name: string) => {
    return rooms.filter(room => room.assignedTo === name);
  };
  
  const handleConfigChange = (newConfig: CleaningConfig) => {
    setCleaningConfig(newConfig);
  };
  
  const handleHousekeeperNamesChange = (names: string[]) => {
    setHousekeeperNames(names);
    
    // Réaffecter les chambres si les noms changent
    if (rooms.length > 0) {
      distributeRooms(rooms, names);
    }
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
  
  // Fonction de redistribution des chambres
  const redistributeRooms = () => {
    distributeRooms(rooms, housekeeperNames);
    toast({
      title: "Chambres redistribuées",
      description: "Les chambres ont été réparties entre les femmes de chambre.",
    });
  };
  
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
          <TabsList>
            <TabsTrigger value="overview">Tableau de Bord</TabsTrigger>
            <TabsTrigger value="housekeeping">Femmes de Chambre</TabsTrigger>
            <TabsTrigger value="rooms">Toutes les Chambres</TabsTrigger>
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
                  <CardTitle className="text-sm font-medium">Chambres Twin</CardTitle>
                  <Bed className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{twinRooms}</div>
                  <p className="text-xs text-muted-foreground">Chambres avec lit jumeaux</p>
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
                        <span className="text-sm text-gray-500">{cleanedRooms}/{totalRooms}</span>
                      </div>
                      <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="absolute h-full bg-green-500" 
                          style={{ width: totalRooms > 0 ? `${(cleanedRooms/totalRooms)*100}%` : '0%' }}
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
                    
                    {roomsToClean > 0 && housekeeperNames.length > 0 && (
                      <div className="mt-6">
                        <Button onClick={redistributeRooms} className="w-full">
                          Redistribuer les Chambres
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="housekeeping" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Attribution des Chambres</h2>
              <Button onClick={redistributeRooms}>Redistribuer les Chambres</Button>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
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
                />
              ))}
              
              {housekeeperNames.length === 0 && (
                <div className="col-span-2 text-center py-8 text-gray-500">
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
          </TabsContent>
          
          <TabsContent value="rooms" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Toutes les Chambres</CardTitle>
                <CardDescription>
                  Visualiser et gérer toutes les chambres de l'hôtel
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                      {rooms.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-6 text-center text-gray-500">
                            Aucune chambre disponible. Veuillez uploader un rapport Mews.
                          </TableCell>
                        </TableRow>
                      ) : (
                        rooms.map((room) => {
                          return (
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
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
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
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
