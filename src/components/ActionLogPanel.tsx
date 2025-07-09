import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Bell, BellOff, Trash2, Check, Clock, AlertCircle, User, Bed, Home } from 'lucide-react';
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
        return <Home className={iconClasses} />;
      case 'cleaning-start':
        return <Clock className={iconClasses} />;
      case 'cleaning-end':
        return <Check className={iconClasses} />;
      default:
        return <Bell className={iconClasses} />;
    }
  };

  const getStatusColor = (type: Notification['type']) => {
    switch (type) {
      case 'room-status':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'remark':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'assignment':
        return 'bg-info/10 text-info border-info/20';
      case 'cleaning-start':
        return 'bg-success/10 text-success border-success/20';
      case 'cleaning-end':
        return 'bg-accent/10 text-accent border-accent/20';
      default:
        return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return format(timestamp, 'HH:mm:ss', { locale: fr });
  };

  const formatDate = (timestamp: Date) => {
    return format(timestamp, 'dd/MM/yyyy', { locale: fr });
  };

  const groupNotificationsByDate = (notifications: Notification[]) => {
    const groups: Record<string, Notification[]> = {};
    
    notifications.forEach(notification => {
      const dateKey = formatDate(notification.timestamp);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(notification);
    });
    
    return groups;
  };

  const groupedNotifications = groupNotificationsByDate(notifications);
  const sortedDates = Object.keys(groupedNotifications).sort((a, b) => 
    new Date(b.split('/').reverse().join('-')).getTime() - 
    new Date(a.split('/').reverse().join('-')).getTime()
  );

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[80vh] bg-card border shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Journal des Actions
              {hasUnread && (
                <Badge variant="destructive" className="ml-2">
                  Nouveau
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {hasUnread && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-sm"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Tout marquer comme lu
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={clearNotifications}
                className="text-sm"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Effacer tout
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
              >
                Fermer
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <ScrollArea className="h-[400px] w-full">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <BellOff className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Aucune action enregistrée</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedDates.map(date => (
                  <div key={date} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Separator className="flex-1" />
                      <span className="text-sm font-medium text-muted-foreground px-2">
                        {date}
                      </span>
                      <Separator className="flex-1" />
                    </div>
                    
                    <div className="space-y-2">
                      {groupedNotifications[date].map((notification) => (
                        <div
                          key={notification.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer hover:bg-accent/50 ${
                            !notification.is_read ? 'bg-accent/20 border-accent/40' : 'bg-background'
                          }`}
                          onClick={() => markAsRead(notification.id)}
                        >
                          <div className={`p-2 rounded-full ${getStatusColor(notification.type)}`}>
                            {getNotificationIcon(notification.type)}
                          </div>
                          
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-sm">
                                {notification.title}
                              </h4>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {formatTimestamp(notification.timestamp)}
                                </span>
                                {!notification.is_read && (
                                  <div className="w-2 h-2 bg-primary rounded-full" />
                                )}
                              </div>
                            </div>
                            
                            <p className="text-sm text-muted-foreground">
                              {notification.description}
                            </p>
                            
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {notification.housekeeperName && (
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  <span>{notification.housekeeperName}</span>
                                </div>
                              )}
                              {notification.roomNumber && (
                                <div className="flex items-center gap-1">
                                  <Bed className="h-3 w-3" />
                                  <span>Chambre {notification.roomNumber}</span>
                                </div>
                              )}
                              <Badge variant="outline" className="text-xs">
                                {notification.type === 'room-status' && 'Statut chambre'}
                                {notification.type === 'remark' && 'Remarque'}
                                {notification.type === 'assignment' && 'Assignation'}
                                {notification.type === 'cleaning-start' && 'Début nettoyage'}
                                {notification.type === 'cleaning-end' && 'Fin nettoyage'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
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