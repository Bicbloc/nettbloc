
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
  
  // Add check to not include already assigned rooms
  roomsToSelect = roomsToSelect.filter(room => !room.assignedTo);

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
 * 
 * Assignment Logic:
 * - First housekeeper gets first floor, second gets second floor, etc.
 * - If there are more floors than housekeepers, the assignment wraps around
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
  
  // Prepare assignments map
  const assignments: Record<string, Room[]> = {};
  housekeeperNames.forEach(name => {
    assignments[name] = [];
  });

  // Nouvelle logique: organiser les chambres par premier chiffre du numéro de chambre
  const roomsByFirstDigit: Record<string, Room[]> = {};
  
  availableRooms.forEach(room => {
    // Obtenir le premier chiffre du numéro de chambre
    const firstDigit = room.number.replace(/^\D+/, '').charAt(0);
    if (!roomsByFirstDigit[firstDigit]) {
      roomsByFirstDigit[firstDigit] = [];
    }
    roomsByFirstDigit[firstDigit].push(room);
  });
  
  console.log("Rooms grouped by first digit:", Object.keys(roomsByFirstDigit));
  
  // Obtenir tous les premiers chiffres disponibles et les trier
  const availableFirstDigits = Object.keys(roomsByFirstDigit).sort();
  
  if (availableFirstDigits.length > 0 && housekeeperNames.length > 0) {
    const numHousekeepers = housekeeperNames.length;
    
    // Distribuer les chambres par premier chiffre
    for (let digitIndex = 0; digitIndex < availableFirstDigits.length; digitIndex++) {
      const housekeeperIndex = digitIndex % numHousekeepers;
      const housekeeper = housekeeperNames[housekeeperIndex];
      const firstDigit = availableFirstDigits[digitIndex];
      
      console.log(`Assigning all rooms starting with digit ${firstDigit} to ${housekeeper} (index ${housekeeperIndex})`);
      
      if (roomsByFirstDigit[firstDigit] && roomsByFirstDigit[firstDigit].length > 0) {
        const roomsWithDigit = roomsByFirstDigit[firstDigit];
        // Trier les chambres par numéro avant de les ajouter
        roomsWithDigit.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
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
