import React, { createContext, useContext, ReactNode } from 'react';
import { useNotifications, type Notification } from '@/hooks/use-notifications';
import { useActionJournal } from '@/hooks/use-action-journal';

interface NotificationContextValue {
  notifications: Notification[];
  loading: boolean;
  hasUnread: boolean;
  addNotification: (notification: Omit<Notification, 'id' | 'created_at' | 'is_read' | 'hotel_id'>) => Promise<Notification | null>;
  markAsRead: (notificationId: string) => Promise<void>;
  markManyAsRead: (ids: string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  // Journal des actions complet (table daily_action_logs) = source d'affichage
  // pour le bell/journal : chambres, affectations, incidents, nettoyage, etc.
  const journal = useActionJournal();

  // Hook historique conservé pour addNotification (écritures dans `notifications`)
  // toujours utilisées par certains composants (StaffNotificationBanner...).
  const legacy = useNotifications();

  const value: NotificationContextValue = {
    notifications: journal.notifications,
    loading: journal.loading,
    hasUnread: journal.hasUnread,
    addNotification: legacy.addNotification,
    markAsRead: journal.markAsRead,
    markManyAsRead: journal.markManyAsRead,
    markAllAsRead: journal.markAllAsRead,
    clearNotifications: journal.clearNotifications,
    refreshNotifications: journal.refreshNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
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
