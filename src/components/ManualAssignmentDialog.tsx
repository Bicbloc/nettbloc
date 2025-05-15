
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Room } from "@/services/pdfService";
import { Button } from "@/components/ui/button";
import { RoomCard } from "@/components/RoomCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

interface ManualAssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: Room[];
  housekeeperNames: string[];
  onAssignRooms: (housekeeperName: string, rooms: Room[]) => void;
  housekeeperPreferredFloors: Record<string, number[]>;
}

export function ManualAssignmentDialog({
  isOpen,
  onClose,
  rooms,
  housekeeperNames,
  onAssignRooms,
  housekeeperPreferredFloors,
}: ManualAssignmentDialogProps) {
  const [selectedRooms, setSelectedRooms] = useState<Room[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);
  const [selectedHousekeeper, setSelectedHousekeeper] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterFloor, setFilterFloor] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [excludeTwin, setExcludeTwin] = useState<boolean>(true);
  const [useSmartAssignment, setUseSmartAssignment] = useState<boolean>(true);
  const [selectedFloors, setSelectedFloors] = useState<number[]>([]);
  
  // Reset selections when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedRooms([]);
      setSelectedHousekeeper(housekeeperNames.length > 0 ? housekeeperNames[0] : "");
      setSearchTerm("");
      setFilterFloor("all");
      setFilterStatus("all");
      setExcludeTwin(true);
      setUseSmartAssignment(true);
      setSelectedFloors([]);
    }
  }, [isOpen, housekeeperNames]);
  
  // Function to determine room floor from room number - updated for more accurate detection
  const getRoomFloor = (roomNumber: string): number => {
    // Ignore years like 2025, 2026, 2027, 2028
    if (/^20(2[5-8])$/.test(roomNumber)) {
      return 0; // Considérer comme RDC
    }
    
    // Si c'est juste un chiffre (comme 1, 2, 3) ou deux chiffres (comme 12, 24), c'est RDC
    if (/^\d{1,2}$/.test(roomNumber)) {
      return 0;
    }
    
    // Pour les numéros plus longs, le premier chiffre indique généralement l'étage
    const firstDigit = parseInt(roomNumber.charAt(0));
    return isNaN(firstDigit) ? 0 : firstDigit;
  };
  
  // Apply filters to rooms
  useEffect(() => {
    let result = [...rooms];
    
    // Apply search filter
    if (searchTerm) {
      result = result.filter(room => 
        room.number.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply floor filter
    if (filterFloor !== "all") {
      const floorNum = parseInt(filterFloor);
      result = result.filter(room => {
        const roomFloor = getRoomFloor(room.number);
        return roomFloor === floorNum;
      });
    }
    
    // Apply selected floors filter
    if (selectedFloors.length > 0) {
      result = result.filter(room => {
        const roomFloor = getRoomFloor(room.number);
        return selectedFloors.includes(roomFloor);
      });
    }
    
    // Apply status filter
    if (filterStatus !== "all") {
      result = result.filter(room => room.status === filterStatus);
    }
    
    // Exclude twin rooms if option is selected
    if (excludeTwin) {
      result = result.filter(room => !room.isTwin);
    }
    
    // Sort by room number
    result.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    
    setFilteredRooms(result);
  }, [rooms, searchTerm, filterFloor, filterStatus, excludeTwin, selectedFloors]);
  
  const handleRoomSelect = (room: Room) => {
    setSelectedRooms(prev => {
      const isSelected = prev.some(r => r.number === room.number);
      
      if (isSelected) {
        return prev.filter(r => r.number !== room.number);
      } else {
        return [...prev, room];
      }
    });
  };

  // Nouvelle implémentation de toggleFloor - corrigée pour bien sélectionner/désélectionner les étages
  const toggleFloor = (floor: number) => {
    console.log(`Toggling floor ${floor}`);
    
    // Vérifier si l'étage est déjà sélectionné
    const isAlreadySelected = selectedFloors.includes(floor);
    
    if (isAlreadySelected) {
      // Retirer l'étage des étages sélectionnés
      setSelectedFloors(prev => prev.filter(f => f !== floor));
      
      // Retirer aussi toutes les chambres de cet étage de la sélection
      setSelectedRooms(prev => 
        prev.filter(room => getRoomFloor(room.number) !== floor)
      );
      console.log(`Étage ${floor} désélectionné : toutes les chambres de cet étage ont été retirées`);
    } else {
      // Ajouter l'étage aux étages sélectionnés
      setSelectedFloors(prev => [...prev, floor]);
      
      // Trouver toutes les chambres de cet étage qui correspondent aux filtres actuels
      const floorRoomsToAdd = rooms.filter(room => {
        // Vérifier l'étage
        const roomFloor = getRoomFloor(room.number);
        if (roomFloor !== floor) return false;
        
        // Appliquer les filtres existants
        if (filterStatus !== "all" && room.status !== filterStatus) return false;
        if (excludeTwin && room.isTwin) return false;
        if (searchTerm && !room.number.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        
        return true;
      });
      
      console.log(`Étage ${floor} sélectionné : ${floorRoomsToAdd.length} chambres trouvées`);
      
      // Ajouter ces chambres à la sélection (sans doublons)
      if (floorRoomsToAdd.length > 0) {
        setSelectedRooms(prev => {
          const existingRoomNumbers = new Set(prev.map(r => r.number));
          const newRooms = [...prev];
          
          floorRoomsToAdd.forEach(room => {
            if (!existingRoomNumbers.has(room.number)) {
              newRooms.push(room);
            }
          });
          
          console.log(`${newRooms.length - prev.length} nouvelles chambres ajoutées à la sélection`);
          return newRooms;
        });
      }
    }
  };

  // Implémentation améliorée de smart assignment
  const handleSmartAssign = () => {
    if (!selectedHousekeeper) {
      toast({
        title: "Aucune femme de chambre sélectionnée",
        description: "Veuillez sélectionner une femme de chambre.",
        variant: "destructive"
      });
      return;
    }

    let roomsToSelect: Room[] = [];
    
    // Si des étages sont sélectionnés, les prioriser
    if (selectedFloors.length > 0) {
      console.log("Smart assignment basé sur les étages sélectionnés:", selectedFloors);
      
      // Récupérer toutes les chambres des étages sélectionnés
      roomsToSelect = rooms.filter(room => {
        const roomFloor = getRoomFloor(room.number);
        return selectedFloors.includes(roomFloor);
      });
    } else {
      // Sinon utiliser les étages préférés de la femme de chambre
      const preferredFloors = housekeeperPreferredFloors[selectedHousekeeper] || [];
      console.log("Smart assignment basé sur les étages préférés:", preferredFloors);
      
      if (preferredFloors.length === 0) {
        toast({
          title: "Aucun étage préféré défini",
          description: "Veuillez sélectionner des étages ou définir des étages préférés pour l'assignation intelligente.",
          variant: "destructive"
        });
        return;
      }

      // Récupérer toutes les chambres des étages préférés
      roomsToSelect = rooms.filter(room => {
        const roomFloor = getRoomFloor(room.number);
        return preferredFloors.includes(roomFloor);
      });
    }

    // Appliquer les filtres
    if (excludeTwin) {
      roomsToSelect = roomsToSelect.filter(room => !room.isTwin);
    }
    
    if (filterStatus !== "all") {
      roomsToSelect = roomsToSelect.filter(room => room.status === filterStatus);
    }

    if (roomsToSelect.length === 0) {
      toast({
        title: "Aucune chambre disponible",
        description: "Aucune chambre disponible dans les étages sélectionnés.",
        variant: "destructive"
      });
      return;
    }

    // Trier les chambres par numéro pour une meilleure organisation
    roomsToSelect.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    
    setSelectedRooms(roomsToSelect);
    toast({
      description: `${roomsToSelect.length} chambres sélectionnées automatiquement dans les étages choisis.`
    });
  };
  
  // Distribution des chambres par étage - COMPLÈTEMENT RÉÉCRITE
  const handleDistributeRooms = () => {
    if (housekeeperNames.length === 0) {
      toast({
        title: "Aucune femme de chambre disponible",
        description: "Veuillez ajouter au moins une femme de chambre avant de distribuer les chambres.",
        variant: "destructive"
      });
      return;
    }

    console.log("Démarrage du processus de distribution des chambres");
    
    // Récupérer toutes les chambres à nettoyer (pas en maintenance et pas déjà assignées)
    const unassignedRooms = [...rooms].filter(room => 
      !room.assignedTo && 
      room.cleaningType !== 'none' && 
      room.status !== 'maintenance'
    );
    
    if (unassignedRooms.length === 0) {
      toast({
        title: "Aucune chambre à distribuer",
        description: "Il n'y a pas de chambres non assignées à distribuer.",
        variant: "destructive"
      });
      return;
    }

    console.log(`Trouvé ${unassignedRooms.length} chambres non assignées à distribuer`);
    
    // Groupe les chambres par étage
    const roomsByFloor: Record<number, Room[]> = {};
    
    unassignedRooms.forEach(room => {
      const floor = getRoomFloor(room.number);
      if (!roomsByFloor[floor]) roomsByFloor[floor] = [];
      roomsByFloor[floor].push(room);
    });
    
    Object.keys(roomsByFloor).forEach(floorStr => {
      const floor = parseInt(floorStr);
      // Trier les chambres par numéro à l'intérieur de chaque étage
      roomsByFloor[floor].sort((a, b) => 
        a.number.localeCompare(b.number, undefined, { numeric: true })
      );
      console.log(`Étage ${floor}: ${roomsByFloor[floor].length} chambres`);
    });
    
    // Récupérer les étages disponibles et les trier
    const availableFloors = Object.keys(roomsByFloor)
      .map(Number)
      .sort((a, b) => a - b);
    
    console.log("Distribution - Étages disponibles:", availableFloors);
    
    // Nombre de femmes de chambre
    const numHousekeepers = housekeeperNames.length;
    
    // Préparer les assignations
    const assignments: Record<string, Room[]> = {};
    housekeeperNames.forEach(name => {
      assignments[name] = [];
    });
    
    // Distribuer les étages séquentiellement aux femmes de chambre
    if (availableFloors.length > 0) {
      // Calculer combien d'étages chaque femme de chambre devrait obtenir
      const floorsPerHousekeeper = Math.max(1, Math.ceil(availableFloors.length / numHousekeepers));
      console.log(`Étages par femme de chambre: ${floorsPerHousekeeper}`);
      
      // Assigner des étages entiers aux femmes de chambre séquentiellement
      housekeeperNames.forEach((housekeeper, index) => {
        // Calculer quels étages cette femme de chambre obtient
        const startFloorIndex = index * floorsPerHousekeeper;
        const endFloorIndex = Math.min((index + 1) * floorsPerHousekeeper, availableFloors.length);
        
        // Obtenir les étages pour cette femme de chambre
        const assignedFloors = availableFloors.slice(startFloorIndex, endFloorIndex);
        console.log(`${housekeeper} obtient les étages:`, assignedFloors);
        
        // Assigner toutes les chambres de ces étages
        assignedFloors.forEach(floor => {
          if (roomsByFloor[floor] && roomsByFloor[floor].length > 0) {
            assignments[housekeeper].push(...roomsByFloor[floor]);
            console.log(`${housekeeper} obtient ${roomsByFloor[floor].length} chambres de l'étage ${floor}`);
          }
        });
      });
      
      // Faire les assignations
      for (const housekeeper of housekeeperNames) {
        if (assignments[housekeeper] && assignments[housekeeper].length > 0) {
          console.log(`Assignation de ${assignments[housekeeper].length} chambres à ${housekeeper}`);
          onAssignRooms(housekeeper, assignments[housekeeper]);
        }
      }
      
      // Afficher un message de succès
      const totalAssigned = Object.values(assignments).reduce((sum, rooms) => sum + rooms.length, 0);
      toast({
        title: "Distribution réussie",
        description: `${totalAssigned} chambres ont été distribuées par étages complets.`,
      });
    } else {
      toast({
        title: "Pas d'étages disponibles",
        description: "Aucun étage avec des chambres non assignées n'a été trouvé.",
        variant: "destructive"
      });
    }
    
    onClose();
  };
  
  const handleAssign = () => {
    if (selectedRooms.length === 0) {
      toast({
        title: "Aucune chambre sélectionnée",
        description: "Veuillez sélectionner au moins une chambre à assigner.",
        variant: "destructive"
      });
      return;
    }
    
    if (!selectedHousekeeper) {
      toast({
        title: "Aucune femme de chambre sélectionnée",
        description: "Veuillez sélectionner une femme de chambre.",
        variant: "destructive"
      });
      return;
    }
    
    onAssignRooms(selectedHousekeeper, selectedRooms);
    toast({
      title: "Chambres assignées",
      description: `${selectedRooms.length} chambre(s) assignée(s) à ${selectedHousekeeper}`,
    });
    onClose();
  };
  
  // Get available floors from rooms
  const availableFloors = Array.from(
    new Set(
      rooms.map(room => getRoomFloor(room.number))
    )
  ).sort((a, b) => a - b);
  
  const selectAll = () => {
    setSelectedRooms(filteredRooms);
  };
  
  const clearSelection = () => {
    setSelectedRooms([]);
    setSelectedFloors([]);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Assigner manuellement des chambres</DialogTitle>
          <DialogDescription>
            Sélectionnez les chambres et assignez-les à une femme de chambre
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-12 gap-4">
          {/* Filters */}
          <div className="col-span-12 grid grid-cols-4 gap-2 mb-2">
            <div>
              <Label htmlFor="search">Recherche</Label>
              <Input
                id="search"
                placeholder="Numéro de chambre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="floor-filter">Étage</Label>
              <Select value={filterFloor} onValueChange={setFilterFloor}>
                <SelectTrigger id="floor-filter">
                  <SelectValue placeholder="Tous les étages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les étages</SelectItem>
                  {availableFloors.map(floor => (
                    <SelectItem key={floor} value={floor.toString()}>
                      {floor === 0 ? "RDC" : `Étage ${floor}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="status-filter">Statut</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="needs-cleaning">À nettoyer</SelectItem>
                  <SelectItem value="clean">Propre</SelectItem>
                  <SelectItem value="occupied">Occupé</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2 items-end">
              <Button variant="outline" className="flex-1" onClick={selectAll}>
                Tout sélectionner
              </Button>
              <Button variant="outline" className="flex-1" onClick={clearSelection}>
                Effacer
              </Button>
            </div>
          </div>
          
          {/* Options additionnelles */}
          <div className="col-span-12 mb-2">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="exclude-twin" 
                  checked={excludeTwin}
                  onCheckedChange={(checked) => setExcludeTwin(!!checked)}
                />
                <Label 
                  htmlFor="exclude-twin"
                  className="text-sm cursor-pointer"
                >
                  Exclure chambres twin
                </Label>
              </div>
              
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="smart-assignment" 
                  checked={useSmartAssignment}
                  onCheckedChange={(checked) => setUseSmartAssignment(!!checked)}
                />
                <Label 
                  htmlFor="smart-assignment"
                  className="text-sm cursor-pointer"
                >
                  Assignation intelligente par étage
                </Label>
              </div>

              {useSmartAssignment && (
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={handleSmartAssign}
                >
                  Sélection intelligente
                </Button>
              )}
              
              {/* Bouton de distribution équitable */}
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleDistributeRooms}
              >
                Distribuer équitablement
              </Button>
            </div>
          </div>
          
          {/* Sélection des étages */}
          <div className="col-span-12 mb-2">
            <Label className="mb-2 block">Sélectionner des étages spécifiques (sélectionne automatiquement toutes les chambres de l'étage)</Label>
            <div className="flex flex-wrap gap-2">
              {availableFloors.map(floor => (
                <Badge
                  key={floor}
                  className={`cursor-pointer ${selectedFloors.includes(floor) ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                  onClick={() => toggleFloor(floor)}
                >
                  {floor === 0 ? "RDC" : `Étage ${floor}`}
                </Badge>
              ))}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {selectedFloors.length > 0 ? 
                `${selectedFloors.length} étage(s) sélectionné(s)` : 
                "Aucun étage sélectionné - toutes les chambres seront affichées"}
            </div>
          </div>
          
          {/* Room Selection */}
          <div className="col-span-7">
            <Label className="mb-2 block">Chambres disponibles ({filteredRooms.length})</Label>
            <ScrollArea className="h-[400px] border rounded-md p-2">
              <div className="grid grid-cols-3 gap-2">
                {filteredRooms.map(room => (
                  <RoomCard
                    key={room.number}
                    room={room}
                    onUpdate={() => {}}
                    compact
                    selectable
                    isSelected={selectedRooms.some(r => r.number === room.number)}
                    onSelect={handleRoomSelect}
                  />
                ))}
                
                {filteredRooms.length === 0 && (
                  <div className="col-span-3 text-center py-8 text-gray-500">
                    Aucune chambre ne correspond aux critères de recherche
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
          
          {/* Assignment Section */}
          <div className="col-span-5">
            <div className="mb-4">
              <Label htmlFor="housekeeper-select" className="mb-2 block">
                Femme de chambre
              </Label>
              <Select value={selectedHousekeeper} onValueChange={setSelectedHousekeeper}>
                <SelectTrigger id="housekeeper-select">
                  <SelectValue placeholder="Sélectionner une femme de chambre" />
                </SelectTrigger>
                <SelectContent>
                  {housekeeperNames.map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Label className="mb-2 block">Chambres sélectionnées ({selectedRooms.length})</Label>
            <ScrollArea className="h-[300px] border rounded-md p-2">
              <div className="grid grid-cols-2 gap-2">
                {selectedRooms.map(room => (
                  <RoomCard
                    key={room.number}
                    room={room}
                    onUpdate={() => {}}
                    compact
                    selectable
                    isSelected={true}
                    onSelect={handleRoomSelect}
                  />
                ))}
                
                {selectedRooms.length === 0 && (
                  <div className="col-span-2 text-center py-8 text-gray-500">
                    Aucune chambre sélectionnée
                  </div>
                )}
              </div>
            </ScrollArea>
            
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button onClick={handleAssign}>
                Assigner {selectedRooms.length} chambre(s)
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
