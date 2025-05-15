import { Room } from "@/services/pdfService";
import { toast } from "@/components/ui/use-toast";
import { getRoomFloor, groupRoomsByFloor } from "@/utils/roomUtils";
import { getFirstDigitFromRoomNumber } from "@/lib/utils";

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
    // Get all rooms from selected floors THAT ARE NOT ASSIGNED to other housekeepers
    roomsToSelect = rooms.filter(room => {
      const roomFloor = getRoomFloor(room.number);
      // Only include rooms that are either unassigned or already assigned to the current housekeeper
      return selectedFloors.includes(roomFloor) && 
             (!room.assignedTo || room.assignedTo === selectedHousekeeper);
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

    // Get all rooms from preferred floors THAT ARE NOT ASSIGNED to other housekeepers
    roomsToSelect = rooms.filter(room => {
      const roomFloor = getRoomFloor(room.number);
      // Only include rooms that are either unassigned or already assigned to the current housekeeper
      return preferredFloors.includes(roomFloor) && 
             (!room.assignedTo || room.assignedTo === selectedHousekeeper);
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
 * Distributes rooms to housekeepers by first digit of room number
 * Each housekeeper gets consecutive pairs of digits (1&2, 3&4, etc.)
 * 
 * Assignment Logic:
 * - First housekeeper gets rooms with first digits 1,2
 * - Second housekeeper gets rooms with first digits 3,4
 * - Third housekeeper gets rooms with first digits 5,6
 * - Fourth housekeeper gets rooms with first digits 7,8 etc.
 * - If there are more digits than housekeepers*2, distribution cycles
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
    // If specific floors are selected, get all rooms from those floors
    // even if they are already assigned
    availableRooms = rooms.filter(room => {
      const roomFloor = getRoomFloor(room.number);
      return selectedFloors.includes(roomFloor) &&
             room.cleaningType !== 'none' && 
             room.status !== 'maintenance';
    });
  } else {
    // Otherwise, only get unassigned rooms
    availableRooms = rooms.filter(room => 
      !room.assignedTo && 
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
        : "Il n'y a pas de chambres non assignées à distribuer.",
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

  // Group rooms by first digit of room number
  const roomsByFirstDigit: Record<string, Room[]> = {};
  
  availableRooms.forEach(room => {
    // Get first digit of room number
    const firstDigit = room.number.replace(/^\D+/, '').charAt(0);
    if (!roomsByFirstDigit[firstDigit]) {
      roomsByFirstDigit[firstDigit] = [];
    }
    roomsByFirstDigit[firstDigit].push(room);
  });
  
  console.log("Rooms grouped by first digit:", Object.keys(roomsByFirstDigit));
  
  // Get all available first digits and sort them
  const availableFirstDigits = Object.keys(roomsByFirstDigit).sort();
  
  if (availableFirstDigits.length > 0 && housekeeperNames.length > 0) {
    const numHousekeepers = housekeeperNames.length;
    
    // Distribute rooms by pairs of digits to each housekeeper (1&2 to first, 3&4 to second, etc.)
    // with wrap-around logic if needed
    for (let digitIndex = 0; digitIndex < availableFirstDigits.length; digitIndex++) {
      // Calculate which housekeeper gets this digit (with pair wrap-around)
      // Integer division by 2 to get pairs of digits
      const housekeeperIndex = Math.floor(digitIndex / 2) % numHousekeepers;
      const housekeeper = housekeeperNames[housekeeperIndex];
      const firstDigit = availableFirstDigits[digitIndex];
      
      console.log(`Assigning all rooms starting with digit ${firstDigit} to ${housekeeper} (index ${housekeeperIndex})`);
      
      if (roomsByFirstDigit[firstDigit] && roomsByFirstDigit[firstDigit].length > 0) {
        const roomsWithDigit = roomsByFirstDigit[firstDigit];
        // Sort rooms by floor and then by number before adding
        roomsWithDigit.sort((a, b) => {
          const floorA = getRoomFloor(a.number);
          const floorB = getRoomFloor(b.number);
          if (floorA !== floorB) return floorA - floorB;
          return a.number.localeCompare(b.number, undefined, { numeric: true });
        });
        assignments[housekeeper].push(...roomsWithDigit);
        
        console.log(`Added ${roomsWithDigit.length} rooms starting with ${firstDigit} to ${housekeeper}`);
        console.log(`Room numbers: ${roomsWithDigit.map(r => r.number).join(', ')}`);
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
    description: "Aucune chambre non assignée avec des numéros valides n'a été trouvée.",
    variant: "destructive"
  });
  
  return null;
}

// Add a new function that will be used for the automatic assignment button
/**
 * Automatically distribute rooms to housekeepers using the same logic as distributeRoomsByFloor
 * This function is used by the automatic assignment button
 */
export function autoDistributeRooms(
  rooms: Room[],
  housekeeperNames: string[],
  excludeTwin: boolean = false
): Record<string, Room[]> | null {
  return distributeRoomsByFloor(rooms, housekeeperNames, [], excludeTwin);
}

// Add a new function to generate a combined PDF report for all housekeepers
/**
 * Generates a single PDF containing reports for all housekeepers
 * This allows downloading one file instead of multiple files
 */
export function generateCombinedReport(
  housekeeperRooms: { name: string; rooms: Room[] }[],
  config: any,
  emailAddress: string,
  customFields?: any
): Promise<boolean> {
  // This function is just a placeholder - the actual implementation
  // will be added to reportService.ts
  return Promise.resolve(true);
}
