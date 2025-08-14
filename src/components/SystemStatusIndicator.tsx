import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, Wifi, Database, Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotificationManager } from '@/hooks/use-notification-manager';

export const SystemStatusIndicator = () => {
  const { isAuthenticated } = useAuth();
  const { permission, isSupported } = useNotificationManager();

  const getAuthStatus = () => {
    if (isAuthenticated) {
      return {
        icon: <CheckCircle className="h-4 w-4" />,
        label: "Authentifié",
        variant: "default" as const
      };
    }
    return {
      icon: <AlertTriangle className="h-4 w-4" />,
      label: "Non authentifié",
      variant: "destructive" as const
    };
  };

  const getNotificationStatus = () => {
    if (!isSupported) {
      return {
        icon: <Bell className="h-4 w-4" />,
        label: "Non supportées",
        variant: "secondary" as const
      };
    }
    
    switch (permission) {
      case 'granted':
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          label: "Activées",
          variant: "default" as const
        };
      case 'denied':
        return {
          icon: <AlertTriangle className="h-4 w-4" />,
          label: "Refusées",
          variant: "destructive" as const
        };
      default:
        return {
          icon: <Bell className="h-4 w-4" />,
          label: "En attente",
          variant: "outline" as const
        };
    }
  };

  const authStatus = getAuthStatus();
  const notificationStatus = getNotificationStatus();

  return (
    <Card className="w-80">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Wifi className="h-4 w-4" />
          État du système
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm">Authentification</span>
          <Badge variant={authStatus.variant} className="flex items-center gap-1">
            {authStatus.icon}
            {authStatus.label}
          </Badge>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm">Base de données</span>
          <Badge variant="default" className="flex items-center gap-1">
            <Database className="h-4 w-4" />
            Connectée
          </Badge>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm">Notifications</span>
          <Badge variant={notificationStatus.variant} className="flex items-center gap-1">
            {notificationStatus.icon}
            {notificationStatus.label}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};