import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff } from 'lucide-react';
import { useNotifications } from '@/hooks/use-notifications';
import { ActionLogPanel } from './ActionLogPanel';

interface NotificationBellProps {
  hotelId?: string;
  className?: string;
}

export const NotificationBell = ({ hotelId, className }: NotificationBellProps) => {
  const [isActionLogOpen, setIsActionLogOpen] = useState(false);
  const { notifications, hasUnread } = useNotifications(hotelId);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsActionLogOpen(true)}
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
        hotelId={hotelId}
        isOpen={isActionLogOpen}
        onClose={() => setIsActionLogOpen(false)}
      />
    </>
  );
};