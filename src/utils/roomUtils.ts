
import { Room } from "@/services/pdfService";

/**
 * Determines the floor of a room based on its number
 * Enhanced to handle different room number formats
 */
export const getRoomFloor = (roomNumber: string): number => {
  // Remove any non-numeric prefix if it exists
  const numericPart = roomNumber.replace(/^[^\d]+/, '');
  
  // Ignore years like 2025, 2026, 2027, 2028
  if (/^20(2[5-8])$/.test(numericPart)) {
    return 0; // Consider as ground floor
  }
  
  // If it's just a digit (like 1, 2, 3) or two digits (like 12, 24), it's ground floor
  if (/^\d{1,2}$/.test(numericPart)) {
    return 0;
  }
  
  // For longer numbers, the first digit typically indicates the floor
  const firstDigit = parseInt(numericPart.charAt(0));
  return isNaN(firstDigit) ? 0 : firstDigit;
};

/**
 * Groups rooms by floor
 */
export const groupRoomsByFloor = (rooms: Room[]): Record<number, Room[]> => {
  const roomsByFloor: Record<number, Room[]> = {};
  
  rooms.forEach(room => {
    const floor = getRoomFloor(room.number);
    if (!roomsByFloor[floor]) roomsByFloor[floor] = [];
    roomsByFloor[floor].push(room);
  });
  
  // Sort rooms within each floor
  Object.values(roomsByFloor).forEach(floorRooms => {
    floorRooms.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  });
  
  return roomsByFloor;
};

/**
 * Gets all available floors from a list of rooms
 */
export const getAvailableFloors = (rooms: Room[]): number[] => {
  return Array.from(
    new Set(rooms.map(room => getRoomFloor(room.number)))
  ).sort((a, b) => a - b);
};

/**
 * Filters rooms based on search criteria
 */
export const filterRooms = (
  rooms: Room[],
  searchTerm: string,
  filterFloor: string,
  filterStatus: string,
  excludeTwin: boolean,
  selectedFloors: number[]
): Room[] => {
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
  
  return result;
};
