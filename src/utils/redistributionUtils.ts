import { Room } from '@/services/pdfService';

export type RedistributionMethod = 'random' | 'floor' | 'cleaning-type';

// Mélanger un tableau de façon aléatoire
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Distribution aléatoire équitable
function distributeRandomly(rooms: Room[], housekeeperNames: string[]): Room[] {
  if (housekeeperNames.length === 0) return rooms;
  
  const shuffledRooms = shuffleArray(rooms);
  const result = [...shuffledRooms];
  
  shuffledRooms.forEach((room, index) => {
    if (room.cleaningType !== 'none' && room.status !== 'maintenance') {
      const housekeeperIndex = index % housekeeperNames.length;
      const assignedRoom = result.find(r => r.number === room.number);
      if (assignedRoom) {
        assignedRoom.assignedTo = housekeeperNames[housekeeperIndex];
      }
    }
  });
  
  return result;
}

// Distribution par étage - donner toutes les chambres d'étages proches à la même femme de chambre
function distributeByFloor(rooms: Room[], housekeeperNames: string[]): Room[] {
  if (housekeeperNames.length === 0) return rooms;
  
  const result = [...rooms];
  
  // Grouper par étage et trier
  const roomsByFloor: Record<number, Room[]> = {};
  rooms.forEach(room => {
    if (room.cleaningType !== 'none' && room.status !== 'maintenance') {
      const floor = parseInt(room.number[0]) || 0;
      if (!roomsByFloor[floor]) roomsByFloor[floor] = [];
      roomsByFloor[floor].push(room);
    }
  });
  
  // Trier les étages par ordre croissant
  const floors = Object.keys(roomsByFloor).sort((a, b) => parseInt(a) - parseInt(b));
  const totalRooms = Object.values(roomsByFloor).reduce((sum, rooms) => sum + rooms.length, 0);
  const roomsPerHousekeeper = Math.ceil(totalRooms / housekeeperNames.length);
  
  let currentHousekeeperIndex = 0;
  let roomsAssignedToCurrentHousekeeper = 0;
  
  floors.forEach(floorKey => {
    const floorRooms = roomsByFloor[parseInt(floorKey)];
    
    floorRooms.forEach(room => {
      // Si la femme de chambre actuelle a déjà assez de chambres, passer à la suivante
      if (roomsAssignedToCurrentHousekeeper >= roomsPerHousekeeper && currentHousekeeperIndex < housekeeperNames.length - 1) {
        currentHousekeeperIndex++;
        roomsAssignedToCurrentHousekeeper = 0;
      }
      
      const assignedRoom = result.find(r => r.number === room.number);
      if (assignedRoom) {
        assignedRoom.assignedTo = housekeeperNames[currentHousekeeperIndex];
        roomsAssignedToCurrentHousekeeper++;
      }
    });
  });
  
  return result;
}

// Distribution par type de nettoyage - séparer rouge/blanc entre femmes de chambre
function distributeByCleaningType(rooms: Room[], housekeeperNames: string[]): Room[] {
  if (housekeeperNames.length === 0) return rooms;
  
  const result = [...rooms];
  
  // Séparer par type de nettoyage
  const fullCleaningRooms = rooms.filter(r => 
    r.cleaningType === 'full' && r.status !== 'maintenance'
  );
  const quickCleaningRooms = rooms.filter(r => 
    r.cleaningType === 'quick' && r.status !== 'maintenance'
  );
  
  // Calculer la répartition optimale
  const totalRooms = fullCleaningRooms.length + quickCleaningRooms.length;
  const halfHousekeepers = Math.ceil(housekeeperNames.length / 2);
  
  // Assigner les nettoyages complets (rouge) à la première moitié des femmes de chambre
  fullCleaningRooms.forEach((room, index) => {
    const housekeeperIndex = index % halfHousekeepers;
    const assignedRoom = result.find(r => r.number === room.number);
    if (assignedRoom) {
      assignedRoom.assignedTo = housekeeperNames[housekeeperIndex];
    }
  });
  
  // Assigner les recouches (blanc) à l'autre moitié des femmes de chambre
  const remainingHousekeepers = housekeeperNames.slice(halfHousekeepers);
  if (remainingHousekeepers.length > 0) {
    quickCleaningRooms.forEach((room, index) => {
      const housekeeperIndex = index % remainingHousekeepers.length;
      const assignedRoom = result.find(r => r.number === room.number);
      if (assignedRoom) {
        assignedRoom.assignedTo = remainingHousekeepers[housekeeperIndex];
      }
    });
  } else {
    // Si pas assez de femmes de chambre, mélanger avec les nettoyages complets
    quickCleaningRooms.forEach((room, index) => {
      const housekeeperIndex = index % housekeeperNames.length;
      const assignedRoom = result.find(r => r.number === room.number);
      if (assignedRoom) {
        assignedRoom.assignedTo = housekeeperNames[housekeeperIndex];
      }
    });
  }
  
  return result;
}

// Fonction principale de redistribution
export function redistributeRooms(
  rooms: Room[], 
  housekeeperNames: string[], 
  method: RedistributionMethod
): Room[] {
  console.log(`🔄 Redistribution ${method} pour ${rooms.length} chambres et ${housekeeperNames.length} femmes de chambre`);
  
  // D'abord, réinitialiser toutes les assignations
  const resetRooms = rooms.map(room => ({ ...room, assignedTo: undefined }));
  
  switch (method) {
    case 'random':
      return distributeRandomly(resetRooms, housekeeperNames);
    case 'floor':
      return distributeByFloor(resetRooms, housekeeperNames);
    case 'cleaning-type':
      return distributeByCleaningType(resetRooms, housekeeperNames);
    default:
      return distributeRandomly(resetRooms, housekeeperNames);
  }
}

// Calculer les statistiques de distribution
export function getDistributionStats(rooms: Room[], housekeeperNames: string[]) {
  const stats: Record<string, {
    total: number;
    full: number;
    quick: number;
    floors: Set<number>;
  }> = {};
  
  housekeeperNames.forEach(name => {
    stats[name] = {
      total: 0,
      full: 0,
      quick: 0,
      floors: new Set()
    };
  });
  
  rooms.forEach(room => {
    if (room.assignedTo && stats[room.assignedTo]) {
      stats[room.assignedTo].total++;
      
      if (room.cleaningType === 'full') {
        stats[room.assignedTo].full++;
      } else if (room.cleaningType === 'quick') {
        stats[room.assignedTo].quick++;
      }
      
      const floor = parseInt(room.number[0]) || 0;
      stats[room.assignedTo].floors.add(floor);
    }
  });
  
  return stats;
}