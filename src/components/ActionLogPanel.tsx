import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, BellOff, Trash2, Check, Clock, AlertCircle, User, Bed, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { type Notification } from '@/hooks/use-notifications';

interface ActionLogPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  hasUnread: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;
}

export const ActionLogPanel: React.FC<ActionLogPanelProps> = ({ 
  isOpen, 
  onClose, 
  notifications, 
  hasUnread, 
  markAsRead, 
  markAllAsRead, 
  clearNotifications 
}) => {

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
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Card className="w-full sm:max-w-2xl max-h-[90vh] sm:max-h-[80vh] bg-background border shadow-xl animate-scale-in relative sm:m-4 rounded-b-none sm:rounded-b-lg">
        {/* Bouton fermer visible en haut à droite */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-muted hover:bg-destructive hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </Button>
        
        <CardHeader className="space-y-1 border-b pr-12">
          <div className="flex items-center justify-between flex-wrap gap-2">
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
                  <span className="hidden sm:inline">Tout marquer</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={clearNotifications}
                className="text-sm hover-scale"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Effacer</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <ScrollArea className="max-h-[calc(90vh-120px)] sm:max-h-[calc(80vh-120px)] w-full">
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