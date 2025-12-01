import React, { useEffect } from 'react';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { useNotificationSound } from '@/hooks/use-notification-sound';

export const NotificationSound: React.FC = () => {
  const { notifications, hasUnread } = useNotificationContext();
  const { playInfo, playWarning } = useNotificationSound();

  // Play sound when new notifications arrive
  useEffect(() => {
    if (hasUnread && notifications.length > 0) {
      // Get the most recent notification
      const recentNotification = notifications
        .filter(n => !n.is_read)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      
      if (recentNotification) {
        // Play different sounds based on notification type
        switch (recentNotification.type) {
          case 'room_completed':
          case 'assignment_completed':
            playInfo();
            break;
          case 'room_urgent':
          case 'housekeeper_request':
            playWarning();
            break;
          default:
            playInfo();
        }
      }
    }
  }, [notifications, hasUnread, playInfo, playWarning]);

  // This component doesn't render anything visible
  return null;
};