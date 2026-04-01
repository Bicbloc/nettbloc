import { useState, useEffect, useCallback } from 'react';
import { X, ChevronUp, ChevronDown, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StaffNotification {
  id: string;
  title: string;
  description: string;
  timestamp: number;
}

interface StaffNotificationBannerProps {
  hotelId?: string;
}

/**
 * Compact, dismissible notification banner for staff interfaces.
 * Notifications slide in from the top, can be collapsed to a small badge,
 * and auto-dismiss after 10 seconds.
 */
export function StaffNotificationBanner({ hotelId }: StaffNotificationBannerProps) {
  const [notifications, setNotifications] = useState<StaffNotification[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const addNotification = useCallback((title: string, description: string) => {
    const notif: StaffNotification = {
      id: `${Date.now()}-${Math.random()}`,
      title,
      description,
      timestamp: Date.now(),
    };
    setNotifications(prev => [notif, ...prev].slice(0, 5));
    setIsDismissed(false);
    setIsCollapsed(false);
  }, []);

  // Expose addNotification globally for realtime handlers
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      addNotification(e.detail.title, e.detail.description);
    };
    window.addEventListener('staff-notification', handler as EventListener);
    return () => window.removeEventListener('staff-notification', handler as EventListener);
  }, [addNotification]);

  // Auto-collapse after 8 seconds
  useEffect(() => {
    if (notifications.length > 0 && !isCollapsed && !isDismissed) {
      const timer = setTimeout(() => setIsCollapsed(true), 8000);
      return () => clearTimeout(timer);
    }
  }, [notifications, isCollapsed, isDismissed]);

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const dismissAll = () => {
    setNotifications([]);
    setIsDismissed(true);
  };

  if (notifications.length === 0) return null;

  // Collapsed mode: small floating badge
  if (isCollapsed) {
    return (
      <div className="fixed top-16 right-4 z-50 animate-in slide-in-from-top-2">
        <Button
          size="sm"
          variant="secondary"
          className="rounded-full shadow-lg gap-2 px-3 h-8"
          onClick={() => setIsCollapsed(false)}
        >
          <Bell className="h-3.5 w-3.5" />
          <Badge className="bg-destructive text-destructive-foreground h-5 min-w-5 text-[10px] px-1">
            {notifications.length}
          </Badge>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed top-14 left-2 right-2 z-50 animate-in slide-in-from-top-3 duration-300 max-w-md mx-auto">
      <div className="bg-card border border-border/80 rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">
              {notifications.length} notification{notifications.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsCollapsed(true)}
            >
              <ChevronUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={dismissAll}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Notifications list */}
        <div className="max-h-[200px] overflow-y-auto">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className="flex items-start gap-2 px-3 py-2 border-b border-border/30 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight truncate">{notif.title}</p>
                <p className="text-xs text-muted-foreground truncate">{notif.description}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0 text-muted-foreground"
                onClick={() => dismissNotification(notif.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Helper to dispatch a staff notification from anywhere.
 * Use instead of toast() in staff contexts.
 */
export function dispatchStaffNotification(title: string, description: string) {
  window.dispatchEvent(
    new CustomEvent('staff-notification', { detail: { title, description } })
  );
}
