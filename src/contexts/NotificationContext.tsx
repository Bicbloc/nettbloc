import React, { createContext, useContext, ReactNode } from 'react';
import { useNotifications, type Notification } from '@/hooks/use-notifications';

interface NotificationContextValue {
  notifications: Notification[];
  loading: boolean;
  hasUnread: boolean;
  addNotification: (notification: Omit<Notification, 'id' | 'created_at' | 'is_read' | 'hotel_id'>) => Promise<Notification | null>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  // UN SEUL appel au hook useNotifications - toute l'app utilisera cette instance
  // Le hook récupère automatiquement le hotelId depuis localStorage/sessionStorage
  const notificationState = useNotifications();

  return (
    <NotificationContext.Provider value={notificationState}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
};
