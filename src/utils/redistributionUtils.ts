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
  
  // Exclure les chambres propres de l'assignation
  const roomsToAssign = rooms.filter(room => 
    room.cleaningType !== 'none' && room.status !== 'maintenance' && room.status !== 'clean'
  );
  
  const shuffledRooms = shuffleArray(roomsToAssign);
  const result = [...rooms];
  
  shuffledRooms.forEach((room, index) => {
    const housekeeperIndex = index % housekeeperNames.length;
    const assignedRoom = result.find(r => r.number === room.number);
    if (assignedRoom) {
      assignedRoom.assignedTo = housekeeperNames[housekeeperIndex];
    }
  });
  
  return result;
}

// Distribution par étage - donner toutes les chambres d'étages proches à la même femme de chambre
function distributeByFloor(rooms: Room[], housekeeperNames: string[]): Room[] {
  if (housekeeperNames.length === 0) return rooms;
  
  const result = [...rooms];
  
  // Grouper par étage et trier (exclure chambres propres)
  const roomsByFloor: Record<number, Room[]> = {};
  rooms.forEach(room => {
    if (room.cleaningType !== 'none' && room.status !== 'maintenance' && room.status !== 'clean') {
      const floor = parseInt(room.number[0]) || 0;
      if (!roomsByFloor[floor]) roomsByFloor[floor] = [];
      roomsByFloor[floor].push(room);
    }
  });
  
  // Trier les étages par ordre croissant
  const floors = Object.keys(roomsByFloor)
    .map(f => parseInt(f))
    .sort((a, b) => a - b);
  
  const totalRooms = Object.values(roomsByFloor).reduce((sum, rooms) => sum + rooms.length, 0);
  const roomsPerHousekeeper = Math.ceil(totalRooms / housekeeperNames.length);
  
  let currentHousekeeperIndex = 0;
  let roomsAssignedToCurrentHousekeeper = 0;
  
  
  floors.forEach(floor => {
    const floorRooms = roomsByFloor[floor];
    
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
  
  // Séparer par type de nettoyage (exclure chambres propres)
  const fullCleaningRooms = rooms.filter(r => 
    (r.cleaningType === 'full' || r.cleaningType === 'a_blanc') && r.status !== 'maintenance' && r.status !== 'clean'
  );
  const quickCleaningRooms = rooms.filter(r => 
    (r.cleaningType === 'quick' || r.cleaningType === 'recouche') && r.status !== 'maintenance' && r.status !== 'clean'
  );
  
  
  // Calculer la répartition optimale
  const halfHousekeepers = Math.ceil(housekeeperNames.length / 2);
  
  // Groupe 1: Femmes de chambre pour les chambres rouge (nettoyage complet)
  const redGroup = housekeeperNames.slice(0, halfHousekeepers);
  // Groupe 2: Femmes de chambre pour les chambres blanc (recouche)  
  const whiteGroup = housekeeperNames.slice(halfHousekeepers);
  
  
  // Assigner les nettoyages complets (rouge) au premier groupe
  fullCleaningRooms.forEach((room, index) => {
    const housekeeperIndex = index % redGroup.length;
    const assignedRoom = result.find(r => r.number === room.number);
    if (assignedRoom) {
      assignedRoom.assignedTo = redGroup[housekeeperIndex];
    }
  });
  
  // Assigner les recouches (blanc) au deuxième groupe (ou au premier si pas assez de femmes de chambre)
  if (whiteGroup.length > 0) {
    quickCleaningRooms.forEach((room, index) => {
      const housekeeperIndex = index % whiteGroup.length;
      const assignedRoom = result.find(r => r.number === room.number);
      if (assignedRoom) {
        assignedRoom.assignedTo = whiteGroup[housekeeperIndex];
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