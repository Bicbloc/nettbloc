import { useCallback } from 'react';

// Notification sounds disabled
export const useNotificationSound = () => {
  const noOp = useCallback(() => {
    // Sons désactivés
  }, []);

  return {
    playNotificationSound: noOp,
    playSuccess: noOp,
    playWarning: noOp,
    playError: noOp,
    playInfo: noOp
  };
};
