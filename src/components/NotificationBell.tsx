import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff } from 'lucide-react';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { ActionLogPanel } from './ActionLogPanel';
import { useNotificationSound } from '@/hooks/use-notification-sound';

interface NotificationBellProps {
  className?: string;
}

export const NotificationBell = ({ className }: NotificationBellProps) => {
  const [isActionLogOpen, setIsActionLogOpen] = useState(false);
  const { notifications, hasUnread, markAsRead, markAllAsRead, clearNotifications } = useNotificationContext();
  const { playInfo } = useNotificationSound();

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleOpenNotifications = () => {
    if (hasUnread) {
      playInfo(); // Play sound when opening notifications with unread items
    }
    setIsActionLogOpen(true);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpenNotifications}
        className={`relative hover-scale ${className}`}
      >
        {notifications.length > 0 && hasUnread ? (
          <Bell className="h-4 w-4" />
        ) : (
          <BellOff className="h-4 w-4" />
        )}
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs animate-pulse"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      <ActionLogPanel
        isOpen={isActionLogOpen}
        onClose={() => setIsActionLogOpen(false)}
        notifications={notifications}
        hasUnread={hasUnread}
        markAsRead={markAsRead}
        markAllAsRead={markAllAsRead}
        clearNotifications={clearNotifications}
      />
    </>
  );
};