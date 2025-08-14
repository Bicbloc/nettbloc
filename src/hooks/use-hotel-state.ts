import { useState, useEffect } from 'react';
import { HotelStateManager, type HotelState } from '@/services/HotelStateManager';
import { useAuth } from '@/contexts/AuthContext';

export const useHotelState = () => {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<HotelState>(() => 
    HotelStateManager.getInstance().getState()
  );

  useEffect(() => {
    const manager = HotelStateManager.getInstance();
    
    // Subscribe to state changes
    const unsubscribe = manager.subscribe(setState);

    // Setup hotel if authenticated
    if (isAuthenticated && user?.id) {
      manager.setupHotel(user.id, user.email || undefined);
    } else if (!isAuthenticated) {
      // Reset state when not authenticated
      manager.forceReset();
    }

    return unsubscribe;
  }, [isAuthenticated, user?.id, user?.email]);

  const manager = HotelStateManager.getInstance();

  return {
    ...state,
    setDistributed: manager.setDistributed.bind(manager),
    setRooms: manager.setRooms.bind(manager),
    setHousekeeperNames: manager.setHousekeeperNames.bind(manager),
    generateAccessCode: manager.generateAccessCode.bind(manager),
    forceReset: manager.forceReset.bind(manager)
  };
};