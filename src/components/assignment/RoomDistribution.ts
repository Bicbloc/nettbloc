
import { Room } from "@/services/pdfService";
import { toast } from "@/components/ui/use-toast";
import { getRoomFloor, groupRoomsByFloor } from "@/utils/roomUtils";
import { getFirstDigitFromRoomNumber } from "@/lib/utils";
import { generateCombinedReport as generateCombinedReportService } from "@/services/reportService";

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
    // Get all rooms from selected floors EVEN IF ASSIGNED to other housekeepers
    roomsToSelect = rooms.filter(room => {
      const roomFloor = getRoomFloor(room.number);
      // Include all rooms from selected floors regardless of assignment
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

    // Get rooms from preferred floors, including those assigned to others
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

  // Sort rooms by floor and then by room number for better floor-based organization
  roomsToSelect.sort((a, b) => {
    const floorA = getRoomFloor(a.number);
    const floorB = getRoomFloor(b.number);
    if (floorA !== floorB) return floorA - floorB;
    return a.number.localeCompare(b.number, undefined, { numeric: true });
  });
  
  toast({
    description: `${roomsToSelect.length} chambres sélectionnées automatiquement dans les étages choisis.`
  });
  
  return roomsToSelect;
}

/**
 * Distributes rooms to housekeepers by continuous floors to maintain continuity
 * Each housekeeper gets consecutive floors to maintain flow
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

  // Filter rooms based on selected floors if any are selected
  let availableRooms: Room[];
  
  if (selectedFloors.length > 0) {
    // Get ALL rooms from selected floors, even if already assigned
    availableRooms = rooms.filter(room => {
      const roomFloor = getRoomFloor(room.number);
      return selectedFloors.includes(roomFloor) &&
             room.cleaningType !== 'none' && 
             room.status !== 'maintenance';
    });
  } else {
    // Otherwise, get all rooms with cleaningType not 'none' and not in maintenance
    availableRooms = rooms.filter(room => 
      room.cleaningType !== 'none' && 
      room.status !== 'maintenance'
    );
  }
  
  // Apply exclusion filters
  if (excludeTwin) {
    availableRooms = availableRooms.filter(room => !room.isTwin);
  }
  
  if (availableRooms.length === 0) {
    toast({
      title: "Aucune chambre à distribuer",
      description: selectedFloors.length > 0 
        ? "Il n'y a pas de chambres dans les étages sélectionnés."
        : "Il n'y a pas de chambres à distribuer.",
      variant: "destructive"
    });
    return null;
  }

  console.log(`Distributing ${availableRooms.length} rooms`);
  
  // Prepare assignments map
  const assignments: Record<string, Room[]> = {};
  housekeeperNames.forEach(name => {
    assignments[name] = [];
  });

  // Group rooms by floor
  const roomsByFloor: Record<number, Room[]> = {};
  availableRooms.forEach(room => {
    const floor = getRoomFloor(room.number);
    if (!roomsByFloor[floor]) {
      roomsByFloor[floor] = [];
    }
    roomsByFloor[floor].push(room);
  });
  
  // Get all available floors and sort them
  const availableFloors = Object.keys(roomsByFloor)
    .map(Number)
    .sort((a, b) => a - b);
  
  console.log("Available floors:", availableFloors);
  
  if (availableFloors.length > 0 && housekeeperNames.length > 0) {
    const numHousekeepers = housekeeperNames.length;
    
    // Distribute rooms by consecutive floors to ensure each housekeeper gets adjacent floors
    // This helps maintain continuity in their work
    for (let floorIndex = 0; floorIndex < availableFloors.length; floorIndex++) {
      // Calculate which housekeeper gets this floor by dividing floors evenly
      const housekeeperIndex = Math.floor(floorIndex / Math.ceil(availableFloors.length / numHousekeepers)) % numHousekeepers;
      const housekeeper = housekeeperNames[housekeeperIndex];
      const floor = availableFloors[floorIndex];
      
      console.log(`Assigning floor ${floor} to ${housekeeper} (index ${housekeeperIndex})`);
      
      if (roomsByFloor[floor] && roomsByFloor[floor].length > 0) {
        const roomsOnFloor = roomsByFloor[floor];
        
        // Sort rooms by number before adding
        roomsOnFloor.sort((a, b) => 
          a.number.localeCompare(b.number, undefined, { numeric: true })
        );
        
        // Check if adding these rooms would exceed the limit
        // If so, only add what can fit - remaining will be unassigned
        roomsOnFloor.forEach(room => {
          if (assignments[housekeeper].length < Math.ceil(availableRooms.length / numHousekeepers) + 5) { // Allow some flexibility
            assignments[housekeeper].push(room);
          } else {
            // Rooms that can't fit with current housekeeper will remain unassigned
            // and show up in the unassigned section
            console.log(`Room ${room.number} exceeds capacity for ${housekeeper}, leaving unassigned`);
          }
        });
        
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
    title: "Pas de chambres disponibles",
    description: "Aucune chambre avec des numéros valides n'a été trouvée.",
    variant: "destructive"
  });
  
  return null;
}

// Add a function for automatic distribution
export function autoDistributeRooms(
  rooms: Room[],
  housekeeperNames: string[],
  excludeTwin: boolean = false
): Record<string, Room[]> | null {
  return distributeRoomsByFloor(rooms, housekeeperNames, [], excludeTwin);
}

// Function for generating combined PDF report
export function generateCombinedReport(
  housekeeperRooms: { name: string; rooms: Room[] }[],
  config: any,
  customFields?: any
): Promise<boolean> {
  // Call the implementation in reportService.ts
  return generateCombinedReportService(housekeeperRooms, config, customFields);
}
