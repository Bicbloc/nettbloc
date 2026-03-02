import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff } from 'lucide-react';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { ActionLogPanel } from './ActionLogPanel';
import { useNotificationSound } from '@/hooks/use-notification-sound';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

interface NotificationBellProps {
  className?: string;
}

export const NotificationBell = ({ className }: NotificationBellProps) => {
  const { notifications, hasUnread, markAsRead, markAllAsRead, clearNotifications } = useNotificationContext();
  const { playInfo } = useNotificationSound();

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleOpenChange = (open: boolean) => {
    if (open && hasUnread) {
      playInfo();
    }
  };

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
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
      </PopoverTrigger>
      <PopoverContent 
        align="end" 
        sideOffset={8}
        className="w-[380px] p-0 max-h-[70vh] overflow-hidden"
      >
        <ActionLogPanel
          notifications={notifications}
          hasUnread={hasUnread}
          markAsRead={markAsRead}
          markAllAsRead={markAllAsRead}
          clearNotifications={clearNotifications}
        />
      </PopoverContent>
    </Popover>
  );
};
