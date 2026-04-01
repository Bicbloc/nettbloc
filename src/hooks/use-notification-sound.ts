import { useCallback } from 'react';
import { nativeNotificationService } from '@/services/nativeNotificationService';

export const useNotificationSound = () => {
  const playNotificationSound = useCallback(() => {
    nativeNotificationService.vibrate('medium');
  }, []);

  const playSuccess = useCallback(() => {
    nativeNotificationService.notificationHaptic('success');
  }, []);

  const playWarning = useCallback(() => {
    nativeNotificationService.notificationHaptic('warning');
  }, []);

  const playError = useCallback(() => {
    nativeNotificationService.notificationHaptic('error');
  }, []);

  const playInfo = useCallback(() => {
    nativeNotificationService.vibrate('light');
  }, []);

  return {
    playNotificationSound,
    playSuccess,
    playWarning,
    playError,
    playInfo
  };
};
