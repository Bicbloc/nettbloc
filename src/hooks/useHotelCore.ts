import { useState, useEffect } from 'react';
import { hotelCoreEngine, type HotelState } from '@/services/HotelCoreEngine';
import { useAuth } from '@/contexts/AuthContext';

export const useHotelCore = () => {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<HotelState>(() => 
    hotelCoreEngine.getState()
  );

  useEffect(() => {
    // Subscribe to engine state changes
    const unsubscribe = hotelCoreEngine.subscribe(setState);

    // Initialize hotel if authenticated
    if (isAuthenticated && user?.id) {
      hotelCoreEngine.initializeHotel(user.id);
    } else if (!isAuthenticated) {
      hotelCoreEngine.reset();
    }

    return unsubscribe;
  }, [isAuthenticated, user?.id]);

  return {
    ...state,
    
    // Hotel management
    initializeHotel: (userId: string) => hotelCoreEngine.initializeHotel(userId),
    
    // Room management
    createRooms: (roomNumbers: string[]) => hotelCoreEngine.createRooms(roomNumbers),
    updateRoomStatus: (roomId: string, status: any, actorName?: string) => 
      hotelCoreEngine.updateRoomStatus(roomId, status, actorName),
    
    // Assignment management
    assignRooms: (assignments: { roomId: string; housekeeperName: string }[]) => 
      hotelCoreEngine.assignRooms(assignments),
    updateAssignmentStatus: (assignmentId: string, status: any, actorName?: string, notes?: string) => 
      hotelCoreEngine.updateAssignmentStatus(assignmentId, status, actorName, notes),
    autoAssignRooms: (housekeeperNames: string[]) => 
      hotelCoreEngine.autoAssignRooms(housekeeperNames),
    
    // Data processing
    processRoomData: (roomData: any[]) => hotelCoreEngine.processRoomData(roomData),
    
    // Mobile/housekeeper functions
    getHousekeeperAssignments: (housekeeperName: string) => 
      hotelCoreEngine.getHousekeeperAssignments(housekeeperName),
    
    // Utility
    reset: () => hotelCoreEngine.reset()
  };
};
