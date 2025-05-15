import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Room } from "@/services/pdfService";
import { toast } from "@/components/ui/use-toast";
import { filterRooms } from "@/utils/roomUtils";
import { FilterControls } from "@/components/assignment/FilterControls";
import { RoomSelection } from "@/components/assignment/RoomSelection";
import { AssignmentSection } from "@/components/assignment/AssignmentSection";
import { 
  smartAssignRooms, 
  distributeRoomsByFloor,
  autoDistributeRooms 
} from "@/components/assignment/RoomDistribution";

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
  
  // Apply filters to rooms
  useEffect(() => {
    const filtered = filterRooms(
      rooms, 
      searchTerm, 
      filterFloor, 
      filterStatus, 
      excludeTwin,
      selectedFloors
    );
    setFilteredRooms(filtered);
  }, [rooms, searchTerm, filterFloor, filterStatus, excludeTwin, selectedFloors]);
  
  const handleRoomSelect = (room: Room) => {
    setSelectedRooms(prev => {
      const isSelected = prev.some(r => r.number === room.number);
      
      if (isSelected) {
        return prev.filter(r => r.number !== room.number);
      } else {
        // Allow selecting even if room is assigned to other housekeepers
        return [...prev, room];
      }
    });
  };

  // Fonction modifiée pour réassigner les chambres lors de la sélection d'un étage
  const toggleFloor = (floor: number) => {
    // Vérifier d'abord si l'on a sélectionné une femme de chambre
    if (!selectedHousekeeper) {
      toast({
        title: "Aucune femme de chambre sélectionnée",
        description: "Veuillez d'abord sélectionner une femme de chambre.",
        variant: "destructive"
      });
      return;
    }
    
    // Vérifier si l'étage est déjà sélectionné
    if (selectedFloors.includes(floor)) {
      // Désélectionner l'étage
      setSelectedFloors(prev => prev.filter(f => f !== floor));
      
      // Retirer toutes les chambres de cet étage de la sélection
      setSelectedRooms(prev => 
        prev.filter(room => {
          const roomFloor = parseInt(room.number.charAt(0));
          return roomFloor !== floor;
        })
      );
    } else {
      // Ajouter l'étage aux étages sélectionnés
      setSelectedFloors(prev => [...prev, floor]);
      
      // Trouver toutes les chambres de cet étage, MÊME SI DÉJÀ ASSIGNÉES
      const roomsOnFloor = rooms.filter(room => {
        // La chambre doit être de l'étage sélectionné
        const roomFloor = parseInt(room.number.charAt(0));
        if (roomFloor !== floor) return false;
        
        // Appliquer les autres filtres actifs
        if (filterStatus !== "all" && room.status !== filterStatus) return false;
        if (excludeTwin && room.isTwin) return false;
        if (searchTerm && !room.number.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        
        // Inclure toutes les chambres, indépendamment de leur assignation actuelle
        return true;
      });
      
      // Trier les chambres par numéro avant de les ajouter
      roomsOnFloor.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
      
      // Message pour informer l'utilisateur du transfert des chambres
      const reassignedRooms = roomsOnFloor.filter(room => room.assignedTo && room.assignedTo !== selectedHousekeeper);
      if (reassignedRooms.length > 0) {
        toast({
          title: "Transfert de chambres",
          description: `${reassignedRooms.length} chambre(s) déjà assignée(s) à d'autres femmes de chambre vont être réassignées à ${selectedHousekeeper}.`,
        });
      }
      
      // Ajouter les chambres à la sélection (sans doublons)
      setSelectedRooms(prev => {
        const existingRoomNumbers = new Set(prev.map(r => r.number));
        const uniqueNewRooms = roomsOnFloor.filter(room => !existingRoomNumbers.has(room.number));
        return [...prev, ...uniqueNewRooms];
      });
    }
  };

  // Smart assignment implementation
  const handleSmartAssign = () => {
    if (!selectedHousekeeper) {
      toast({
        title: "Aucune femme de chambre sélectionnée",
        description: "Veuillez sélectionner une femme de chambre.",
        variant: "destructive"
      });
      return;
    }

    const roomsToSelect = smartAssignRooms(
      rooms,
      selectedHousekeeper,
      selectedFloors,
      housekeeperPreferredFloors,
      excludeTwin,
      filterStatus
    );
    
    if (roomsToSelect.length > 0) {
      setSelectedRooms(roomsToSelect);
    }
  };
  
  // Room distribution implementation - now uses our paired digit distribution logic
  const handleDistributeRooms = () => {
    // Use the distributeRoomsByFloor function with selected floors
    const assignments = distributeRoomsByFloor(
      rooms,
      housekeeperNames,
      selectedFloors,
      excludeTwin
    );
    
    if (!assignments) return;
    
    // Make the assignments
    let totalAssigned = 0;
    for (const housekeeper of housekeeperNames) {
      if (assignments[housekeeper].length > 0) {
        console.log(`Assigning ${assignments[housekeeper].length} rooms to ${housekeeper}`);
        onAssignRooms(housekeeper, assignments[housekeeper]);
        totalAssigned += assignments[housekeeper].length;
      }
    }
    
    // Success message
    toast({
      title: "Distribution réussie",
      description: `${totalAssigned} chambres ont été distribuées en paires de chiffres (1-2, 3-4, etc.) en respectant l'ordre des étages.`,
    });
    
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
          <FilterControls 
            rooms={rooms}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            filterFloor={filterFloor}
            setFilterFloor={setFilterFloor}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            excludeTwin={excludeTwin}
            setExcludeTwin={setExcludeTwin}
            useSmartAssignment={useSmartAssignment}
            setUseSmartAssignment={setUseSmartAssignment}
            selectedFloors={selectedFloors}
            setSelectedFloors={setSelectedFloors}
            onSelectAll={selectAll}
            onClearSelection={clearSelection}
            onSmartAssign={handleSmartAssign}
            onDistributeRooms={handleDistributeRooms}
            toggleFloor={toggleFloor}
          />
          
          {/* Room Selection */}
          <div className="col-span-7">
            <RoomSelection
              title="Chambres disponibles"
              rooms={filteredRooms}
              onSelect={handleRoomSelect}
              isSelected={(room) => selectedRooms.some(r => r.number === room.number)}
              emptyMessage="Aucune chambre ne correspond aux critères de recherche"
            />
          </div>
          
          {/* Assignment Section */}
          <AssignmentSection
            housekeeperNames={housekeeperNames}
            selectedHousekeeper={selectedHousekeeper}
            setSelectedHousekeeper={setSelectedHousekeeper}
            selectedRooms={selectedRooms}
            onRoomSelect={handleRoomSelect}
            onAssign={handleAssign}
            onClose={onClose}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
