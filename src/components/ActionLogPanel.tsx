import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, BellOff, Trash2, Check, Clock, AlertCircle, User, Bed } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { type Notification } from '@/hooks/use-notifications';

interface ActionLogPanelProps {
  notifications: Notification[];
  hasUnread: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;
}

export const ActionLogPanel: React.FC<ActionLogPanelProps> = ({ 
  notifications, 
  hasUnread, 
  markAsRead, 
  markAllAsRead, 
  clearNotifications 
}) => {

  const getNotificationIcon = (type: Notification['type']) => {
    const iconClasses = "h-4 w-4";
    switch (type) {
      case 'room-status':
        return <Bed className={iconClasses} />;
      case 'remark':
        return <AlertCircle className={iconClasses} />;
      case 'assignment':
        return <User className={iconClasses} />;
      case 'cleaning-start':
        return <Clock className={iconClasses} />;
      case 'cleaning-end':
        return <Check className={iconClasses} />;
      default:
        return <Bell className={iconClasses} />;
    }
  };

  const getTypeLabel = (type: Notification['type']) => {
    switch (type) {
      case 'room-status':
        return 'Statut chambre';
      case 'remark':
        return 'Remarque';
      case 'assignment':
        return 'Assignation';
      case 'cleaning-start':
        return 'Début nettoyage';
      case 'cleaning-end':
        return 'Fin nettoyage';
      default:
        return 'Action';
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'HH:mm:ss dd/MM', { locale: fr });
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-3 border-b">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          <span className="font-semibold text-sm">Journal des Actions</span>
          {hasUnread && (
            <Badge variant="destructive" className="text-xs">
              {notifications.filter(n => !n.is_read).length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-7 px-2 text-xs"
            >
              <Check className="h-3 w-3 mr-1" />
              Lus
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearNotifications}
            className="h-7 px-2 text-xs"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Effacer
          </Button>
        </div>
      </div>
      
      {/* Content */}
      <ScrollArea className="max-h-[calc(70vh-60px)]">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center p-4">
            <BellOff className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm">Aucune action enregistrée</p>
            <p className="text-xs text-muted-foreground mt-1">
              Les actions des femmes de chambre apparaîtront ici
            </p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`flex items-start gap-2 p-2 rounded-md border transition-all duration-200 cursor-pointer hover:bg-accent/50 ${
                  !notification.is_read ? 'bg-accent/20 border-accent/40' : 'bg-background border-border'
                }`}
                onClick={() => markAsRead(notification.id)}
              >
                <div className={`p-1.5 rounded-full shrink-0 ${
                  notification.type === 'remark' ? 'bg-warning/10 text-warning' :
                  notification.type === 'room-status' ? 'bg-success/10 text-success' :
                  notification.type === 'assignment' ? 'bg-primary/10 text-primary' :
                  'bg-muted/10 text-muted-foreground'
                }`}>
                  {getNotificationIcon(notification.type)}
                </div>
                
                <div className="flex-1 space-y-0.5 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-medium text-xs truncate">
                      {notification.title}
                    </h4>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(notification.created_at)}
                      </span>
                      {!notification.is_read && (
                        <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                      )}
                    </div>
                  </div>
                  
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {notification.description}
                  </p>
                  
                  <div className="flex items-center gap-1 flex-wrap">
                    {notification.housekeeper_name && (
                      <Badge variant="outline" className="text-[10px] h-5 px-1">
                        <User className="h-2.5 w-2.5 mr-0.5" />
                        {notification.housekeeper_name}
                      </Badge>
                    )}
                    {notification.room_number && (
                      <Badge variant="outline" className="text-[10px] h-5 px-1">
                        <Bed className="h-2.5 w-2.5 mr-0.5" />
                        CH {notification.room_number}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px] h-5 px-1">
                      {getTypeLabel(notification.type)}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
