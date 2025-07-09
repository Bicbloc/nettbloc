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
  const [filterCleaningType, setFilterCleaningType] = useState<string>("all");
  const [excludeTwin, setExcludeTwin] = useState<boolean>(true);
  const [useSmartAssignment, setUseSmartAssignment] = useState<boolean>(true);
  const [selectedFloors, setSelectedFloors] = useState<number[]>([]);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('none');
  
  // Reset selections when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedRooms([]);
      setSelectedHousekeeper(housekeeperNames.length > 0 ? housekeeperNames[0] : "");
      setSearchTerm("");
      setFilterFloor("all");
      setFilterStatus("all");
      setFilterCleaningType("all");
      setExcludeTwin(true);
      setUseSmartAssignment(true);
      setSelectedFloors([]);
      setSortOrder('none');
    }
  }, [isOpen, housekeeperNames]);
  
  // Apply filters to rooms
  useEffect(() => {
    // When filtering, we want to show all rooms, even if they're already assigned
    // This allows users to select rooms from any housekeeper
    let filtered = filterRooms(
      rooms, 
      searchTerm, 
      filterFloor, 
      filterStatus, 
      excludeTwin,
      selectedFloors
    );

    // Apply cleaning type filter
    if (filterCleaningType !== "all") {
      filtered = filtered.filter(room => room.cleaningType === filterCleaningType);
    }

    // Apply sorting
    if (sortOrder === 'asc') {
      filtered.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    } else if (sortOrder === 'desc') {
      filtered.sort((a, b) => b.number.localeCompare(a.number, undefined, { numeric: true }));
    }

    setFilteredRooms(filtered);
  }, [rooms, searchTerm, filterFloor, filterStatus, filterCleaningType, excludeTwin, selectedFloors, sortOrder]);
  
  const handleRoomSelect = (room: Room) => {
    setSelectedRooms(prev => {
      const isSelected = prev.some(r => r.number === room.number);
      
      if (isSelected) {
        // Remove from selection
        return prev.filter(r => r.number !== room.number);
      } else {
        // Add to selection - always allow, regardless of current assignment
        return [...prev, room];
      }
    });
  };

  // Floor selection implementation - MODIFIED to force reassign rooms from other housekeepers
  const toggleFloor = (floor: number) => {
    // Check if floor is already selected
    if (selectedFloors.includes(floor)) {
      // Remove floor from selected floors
      setSelectedFloors(prev => prev.filter(f => f !== floor));
      
      // Remove all rooms from this floor from selection
      setSelectedRooms(prev => 
        prev.filter(room => {
          const roomFloor = parseInt(room.number.charAt(0));
          return roomFloor !== floor;
        })
      );
    } else {
      // Add floor to selected floors
      setSelectedFloors(prev => [...prev, floor]);
      
      // Find all rooms from this floor that match current filters
      // Always include rooms assigned to other housekeepers
      const roomsOnFloor = rooms.filter(room => {
        // Room must be from the selected floor
        const roomFloor = parseInt(room.number.charAt(0));
        if (roomFloor !== floor) return false;
        
        // Apply other active filters
        if (filterStatus !== "all" && room.status !== filterStatus) return false;
        if (excludeTwin && room.isTwin) return false;
        if (searchTerm && !room.number.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        
        // Include all rooms regardless of assignment status
        return true;
      });
      
      // Sort rooms by number before adding
      roomsOnFloor.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
      
      // Add rooms to selection (without duplicates)
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
  
  // Room distribution implementation - MODIFIED to properly handle remaining unassigned rooms
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
      description: `${totalAssigned} chambres ont été distribuées en respectant l'ordre des étages.`,
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
    
    // Assign all selected rooms to the housekeeper, even if they're currently
    // assigned to someone else or on a floor not checked for this housekeeper
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
      <DialogContent className="max-w-[95vw] md:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto w-[95vw] mx-auto">
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
              filterCleaningType={filterCleaningType}
              setFilterCleaningType={setFilterCleaningType}
              excludeTwin={excludeTwin}
              setExcludeTwin={setExcludeTwin}
              useSmartAssignment={useSmartAssignment}
              setUseSmartAssignment={setUseSmartAssignment}
              selectedFloors={selectedFloors}
              setSelectedFloors={setSelectedFloors}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
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
