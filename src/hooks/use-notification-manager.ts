import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface NotificationManager {
  permission: NotificationPermission;
  requestPermission: () => Promise<void>;
  showNotification: (title: string, options?: NotificationOptions) => void;
  isSupported: boolean;
}

export const useNotificationManager = (): NotificationManager => {
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async (): Promise<void> => {
    if (!('Notification' in window)) {
      toast({
        variant: "destructive",
        title: "Notifications non supportées",
        description: "Votre navigateur ne supporte pas les notifications."
      });
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        toast({
          title: "✅ Notifications activées",
          description: "Vous recevrez maintenant des notifications en temps réel."
        });
        
        // Test notification
        showNotification('Notifications activées', {
          body: 'Vous recevrez maintenant les alertes importantes.',
          icon: '/favicon.ico'
        });
      } else {
        toast({
          variant: "destructive",
          title: "Notifications refusées",
          description: "Vous pouvez les activer dans les paramètres du navigateur."
        });
      }
    } catch (error) {
      console.error('Erreur demande permission:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de demander les permissions."
      });
    }
  };

  const showNotification = (title: string, options?: NotificationOptions): void => {
    if ('Notification' in window && permission === 'granted') {
      try {
        new Notification(title, {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          ...options
        });
      } catch (error) {
        console.error('Erreur affichage notification:', error);
      }
    }
  };

  return {
    permission,
    requestPermission,
    showNotification,
    isSupported: 'Notification' in window
  };
};