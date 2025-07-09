import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, BellOff, X, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface NotificationPanelProps {
  notifications: any[];
  hasUnread: boolean;
}

export const NotificationPanel = ({ notifications, hasUnread }: NotificationPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // Marquer comme lu quand on ouvre le panneau
  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  // Fermer le panneau
  const handleClose = () => {
    setIsOpen(false);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'room-status':
        return '🧹';
      case 'remark':
        return '⚠️';
      case 'assignment':
        return '📋';
      default:
        return '🔔';
    }
  };

  const getStatusColor = (description: string) => {
    if (description.includes('terminé') || description.includes('nettoyage de la chambre')) {
      return 'bg-green-100 text-green-800';
    } else if (description.includes('commencé')) {
      return 'bg-yellow-100 text-yellow-800';
    } else if (description.includes('remarque')) {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-blue-100 text-blue-800';
  };

  return (
    <div className="relative">
      {/* Bouton de notification */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleToggle}
        className="relative"
      >
        {hasUnread || notifications.length > 0 ? (
          <Bell className="h-4 w-4" />
        ) : (
          <BellOff className="h-4 w-4" />
        )}
        {notifications.length > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
          >
            {notifications.length > 9 ? '9+' : notifications.length}
          </Badge>
        )}
      </Button>

      {/* Panneau de notifications */}
      {isOpen && (
        <Card className="absolute right-0 top-12 w-96 z-50 shadow-lg border">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg">Notifications</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Aucune notification</p>
              </div>
            ) : (
              <ScrollArea className="h-80">
                <div className="space-y-2 p-4">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="text-lg flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm text-foreground">
                            {notification.title}
                          </p>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getStatusColor(notification.description)}`}
                          >
                            {notification.type === 'room-status' ? 'Status' : 'Info'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {notification.description}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(notification.timestamp, 'HH:mm', { locale: fr })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};