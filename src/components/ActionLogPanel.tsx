import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, BellOff, Trash2, Check, Clock, AlertCircle, User, Bed, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNotifications, Notification } from '@/hooks/use-notifications';

interface ActionLogPanelProps {
  hotelId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ActionLogPanel: React.FC<ActionLogPanelProps> = ({ hotelId, isOpen, onClose }) => {
  const { notifications, hasUnread, markAsRead, markAllAsRead, clearNotifications } = useNotifications(hotelId);

  if (!isOpen) return null;

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
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <Card className="w-full max-w-2xl max-h-[80vh] bg-card border shadow-lg animate-scale-in">
        <CardHeader className="space-y-1 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Journal des Actions
              {hasUnread && (
                <Badge variant="destructive" className="ml-2">
                  {notifications.filter(n => !n.is_read).length} nouveau(x)
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {hasUnread && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-sm hover-scale"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Tout marquer
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={clearNotifications}
                className="text-sm hover-scale"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Effacer
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="hover-scale"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <ScrollArea className="h-[500px] w-full">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center p-4">
                <BellOff className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Aucune action enregistrée</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Les actions des femmes de chambre apparaîtront ici
                </p>
              </div>
            ) : (
              <div className="space-y-1 p-4">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all duration-200 cursor-pointer hover:bg-accent/50 hover-scale ${
                      !notification.is_read ? 'bg-accent/20 border-accent/40 shadow-sm' : 'bg-background border-border'
                    }`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className={`p-2 rounded-full shrink-0 ${
                      notification.type === 'remark' ? 'bg-warning/10 text-warning' :
                      notification.type === 'room-status' ? 'bg-success/10 text-success' :
                      notification.type === 'assignment' ? 'bg-primary/10 text-primary' :
                      'bg-muted/10 text-muted-foreground'
                    }`}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-medium text-sm truncate">
                          {notification.title}
                        </h4>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {formatTime(notification.created_at)}
                          </span>
                          {!notification.is_read && (
                            <div className="w-2 h-2 bg-primary rounded-full" />
                          )}
                        </div>
                      </div>
                      
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {notification.description}
                      </p>
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        {notification.housekeeper_name && (
                          <Badge variant="outline" className="text-xs">
                            <User className="h-3 w-3 mr-1" />
                            {notification.housekeeper_name}
                          </Badge>
                        )}
                        {notification.room_number && (
                          <Badge variant="outline" className="text-xs">
                            <Bed className="h-3 w-3 mr-1" />
                            CH {notification.room_number}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {getTypeLabel(notification.type)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};