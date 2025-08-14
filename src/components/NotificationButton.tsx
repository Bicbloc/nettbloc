import { Button } from '@/components/ui/button';
import { Bell, BellOff } from 'lucide-react';
import { useNotificationManager } from '@/hooks/use-notification-manager';

export const NotificationButton = () => {
  const { permission, requestPermission, isSupported } = useNotificationManager();

  if (!isSupported) {
    return null;
  }

  const getButtonVariant = () => {
    switch (permission) {
      case 'granted': return 'default';
      case 'denied': return 'destructive';
      default: return 'outline';
    }
  };

  const getButtonText = () => {
    switch (permission) {
      case 'granted': return 'Notifications activées';
      case 'denied': return 'Notifications refusées';
      default: return 'Activer les notifications';
    }
  };

  const handleClick = () => {
    if (permission === 'default') {
      requestPermission();
    } else if (permission === 'denied') {
      // Rediriger vers les paramètres du navigateur
      alert('Pour activer les notifications, allez dans les paramètres de votre navigateur et autorisez les notifications pour ce site.');
    }
  };

  return (
    <Button 
      onClick={handleClick}
      variant={getButtonVariant()}
      size="sm"
      className="flex items-center gap-2"
    >
      {permission === 'granted' ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
      {getButtonText()}
    </Button>
  );
};