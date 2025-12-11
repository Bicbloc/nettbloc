import { useMemo } from 'react';
import { Room, CleaningConfig } from '@/services/pdfService';

export const useRoomStats = (rooms: Room[], cleaningConfig: CleaningConfig) => {
  return useMemo(() => {
    const totalRooms = rooms.length;
    const roomsToClean = rooms.filter(r => r.status === 'needs-cleaning' || r.cleaningType !== 'none').length;
    const fullCleaningRooms = rooms.filter(r => r.cleaningType === 'full' || r.cleaningType === 'a_blanc').length;
    const quickCleaningRooms = rooms.filter(r => r.cleaningType === 'quick' || r.cleaningType === 'recouche').length;
    const priorityRooms = rooms.filter(r => r.priority === 'high').length;
    const cleanRooms = rooms.filter(r => r.status === 'clean').length;
    const twinRooms = rooms.filter(r => r.isTwin).length;
    
    // Calculate total time
    const totalTime = rooms.reduce((total, room) => {
      if (room.cleaningType === 'full' || room.cleaningType === 'a_blanc') {
        return total + cleaningConfig.fullCleaningTime;
      } else if (room.cleaningType === 'quick' || room.cleaningType === 'recouche') {
        return total + cleaningConfig.quickCleaningTime;
      }
      return total;
    }, 0);
    
    // Calculate recommended housekeepers
    const averageTimePerHousekeeper = 360; // 6 hours = 360 minutes
    const recommendedHousekeepers = Math.ceil(totalTime / averageTimePerHousekeeper);
    
    return {
      totalRooms,
      roomsToClean,
      fullCleaningRooms,
      quickCleaningRooms,
      priorityRooms,
      cleanRooms,
      twinRooms,
      totalTime,
      recommendedHousekeepers
    };
  }, [rooms, cleaningConfig]);
};

export const useRoomHelpers = (rooms: Room[]) => {
  const getHousekeeperRooms = (name: string) => {
    return rooms.filter(room => room.assignedTo === name);
  };
  
  const getUnassignedRooms = () => {
    return rooms.filter(room => 
      !room.assignedTo && 
      room.cleaningType !== 'none' && 
      room.status !== 'maintenance' &&
      room.status !== 'clean'
    );
  };

  const getCleanRooms = () => {
    return rooms.filter(room => 
      room.status === 'clean' &&
      room.cleaningType !== 'none'
    );
  };

  const calculateHousekeeperLoad = (assignedRooms: Room[], config: CleaningConfig): number => {
    return assignedRooms.reduce((total, room) => {
      if (room.cleaningType === 'full' || room.cleaningType === 'a_blanc') {
        return total + config.fullCleaningTime;
      } else if (room.cleaningType === 'quick' || room.cleaningType === 'recouche') {
        return total + config.quickCleaningTime;
      }
      return total;
    }, 0);
  };

  return {
    getHousekeeperRooms,
    getUnassignedRooms,
    getCleanRooms,
    calculateHousekeeperLoad
  };
};
