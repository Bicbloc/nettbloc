import { Room } from "@/services/pdfService";
import { toast } from "@/components/ui/use-toast";
import { getRoomFloor, groupRoomsByFloor } from "@/utils/roomUtils";

/**
 * Smart assignment function to select rooms based on floors
 */
export function smartAssignRooms(
  rooms: Room[],
  selectedHousekeeper: string,
  selectedFloors: number[],
  housekeeperPreferredFloors: Record<string, number[]>,
  excludeTwin: boolean,
  filterStatus: string
): Room[] {
  let roomsToSelect: Room[] = [];
  
  // If floors are selected, prioritize them
  if (selectedFloors.length > 0) {
    // Get all rooms from selected floors
    roomsToSelect = rooms.filter(room => {
      const roomFloor = getRoomFloor(room.number);
      return selectedFloors.includes(roomFloor);
    });
  } else {
    // Otherwise use housekeeper's preferred floors
    const preferredFloors = housekeeperPreferredFloors[selectedHousekeeper] || [];
    
    if (preferredFloors.length === 0) {
      toast({
        title: "Aucun étage préféré défini",
        description: "Veuillez sélectionner des étages ou définir des étages préférés pour l'assignation intelligente.",
        variant: "destructive"
      });
      return [];
    }

    // Get all rooms from preferred floors
    roomsToSelect = rooms.filter(room => {
      const roomFloor = getRoomFloor(room.number);
      return preferredFloors.includes(roomFloor);
    });
  }

  // Apply filters
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
    return [];
  }

  // Sort rooms by number for better organization
  roomsToSelect.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  
  toast({
    description: `${roomsToSelect.length} chambres sélectionnées automatiquement dans les étages choisis.`
  });
  
  return roomsToSelect;
}

/**
 * Distributes rooms to housekeepers by floor
 * Each housekeeper gets complete floors assigned to them
 */
export function distributeRoomsByFloor(
  rooms: Room[],
  housekeeperNames: string[],
  selectedFloors: number[],
  excludeTwin: boolean
): Record<string, Room[]> | null {
  if (housekeeperNames.length === 0) {
    toast({
      title: "Aucune femme de chambre disponible",
      description: "Veuillez ajouter au moins une femme de chambre avant de distribuer les chambres.",
      variant: "destructive"
    });
    return null;
  }

  // Get only the rooms that are not assigned and not in maintenance
  let availableRooms = rooms.filter(room => 
    !room.assignedTo && 
    room.cleaningType !== 'none' && 
    room.status !== 'maintenance'
  );
  
  // Apply exclusion filters
  if (excludeTwin) {
    availableRooms = availableRooms.filter(room => !room.isTwin);
  }
  
  // Only use selected floors if any are selected
  if (selectedFloors.length > 0) {
    availableRooms = availableRooms.filter(room => {
      const roomFloor = getRoomFloor(room.number);
      return selectedFloors.includes(roomFloor);
    });
  }
  
  if (availableRooms.length === 0) {
    toast({
      title: "Aucune chambre à distribuer",
      description: "Il n'y a pas de chambres non assignées à distribuer.",
      variant: "destructive"
    });
    return null;
  }

  console.log(`Distributing ${availableRooms.length} unassigned rooms`);
  
  // Group rooms by floor
  const roomsByFloor = groupRoomsByFloor(availableRooms);
  
  // Get available floors and sort them
  const availableFloors = Object.keys(roomsByFloor)
    .map(Number)
    .sort((a, b) => a - b);
  
  console.log("Available floors for distribution:", availableFloors);
  
  // Prepare assignments map
  const assignments: Record<string, Room[]> = {};
  housekeeperNames.forEach(name => {
    assignments[name] = [];
  });
  
  // Completely reworked distribution logic
  if (availableFloors.length > 0 && housekeeperNames.length > 0) {
    const numHousekeepers = housekeeperNames.length;
    
    // Assign each floor to just one housekeeper
    // First housekeeper gets floors 0, numHousekeepers, 2*numHousekeepers...
    // Second housekeeper gets floors 1, numHousekeepers+1, 2*numHousekeepers+1...
    // And so on
    for (let floorIndex = 0; floorIndex < availableFloors.length; floorIndex++) {
      const housekeeperIndex = floorIndex % numHousekeepers;
      const housekeeper = housekeeperNames[housekeeperIndex];
      const floor = availableFloors[floorIndex];
      
      console.log(`Assigning all rooms on floor ${floor} (index ${floorIndex}) to ${housekeeper} (index ${housekeeperIndex})`);
      
      if (roomsByFloor[floor] && roomsByFloor[floor].length > 0) {
        const roomsOnFloor = roomsByFloor[floor];
        assignments[housekeeper].push(...roomsOnFloor);
        
        console.log(`Added ${roomsOnFloor.length} rooms from floor ${floor} to ${housekeeper}`);
        console.log(`Room numbers: ${roomsOnFloor.map(r => r.number).join(', ')}`);
      }
    }
    
    // Log final assignments for debugging
    housekeeperNames.forEach(name => {
      console.log(`FINAL: ${name} is assigned ${assignments[name].length} rooms: ${assignments[name].map(r => r.number).join(', ')}`);
    });
    
    return assignments;
  }
  
  toast({
    title: "Pas d'étages disponibles",
    description: "Aucun étage avec des chambres non assignées n'a été trouvé.",
    variant: "destructive"
  });
  
  return null;
}
