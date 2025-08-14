import { Button } from '@/components/ui/button';
import { Bell, BellOff, BellRing } from 'lucide-react';
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
      // Rediriger vers les paramètres du navigateur avec instructions
      const instructions = 'Pour activer les notifications:\n\n1. Cliquez sur l\'icône de verrou/informations dans la barre d\'adresse\n2. Autorisez les notifications\n3. Rechargez la page';
      alert(instructions);
    } else if (permission === 'granted') {
      // Test notification
      new Notification('Test NettoBloc', {
        body: 'Les notifications fonctionnent correctement !',
        icon: '/favicon.ico'
      });
    }
  };

  return (
    <Button 
      onClick={handleClick}
      variant={getButtonVariant()}
      size="sm"
      className="flex items-center gap-2"
    >
      {permission === 'granted' ? (
        <Bell className="h-4 w-4 text-green-600" />
      ) : permission === 'denied' ? (
        <BellOff className="h-4 w-4 text-red-600" />
      ) : (
        <BellRing className="h-4 w-4 text-orange-600" />
      )}
      {getButtonText()}
    </Button>
  );
};