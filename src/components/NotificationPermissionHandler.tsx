import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export const NotificationPermissionHandler = () => {
  const [showRequest, setShowRequest] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    // Vérifier le statut des notifications au chargement
    if ('Notification' in window) {
      setPermission(Notification.permission);
      
      // Afficher la demande si les notifications ne sont pas encore autorisées
      if (Notification.permission === 'default') {
        // Attendre un peu avant d'afficher la demande pour ne pas être intrusif
        const timer = setTimeout(() => {
          setShowRequest(true);
        }, 3000);
        
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      toast({
        variant: "destructive",
        title: "Notifications non supportées",
        description: "Votre navigateur ne supporte pas les notifications."
      });
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);
      
      if (permission === 'granted') {
        toast({
          title: "✅ Notifications activées",
          description: "Vous recevrez maintenant des notifications pour les événements importants."
        });
        
        // Test notification
        new Notification('Notifications activées', {
          body: 'Vous recevrez maintenant les notifications en temps réel.',
          icon: '/favicon.ico'
        });
      } else {
        toast({
          variant: "destructive",
          title: "Notifications refusées",
          description: "Vous pouvez les activer manuellement dans les paramètres de votre navigateur."
        });
      }
      
      setShowRequest(false);
    } catch (error) {
      console.error('Erreur demande permission notifications:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de demander l'autorisation pour les notifications."
      });
    }
  };

  const dismissRequest = () => {
    setShowRequest(false);
    // Sauvegarder qu'on a refusé pour ne pas redemander tout de suite
    localStorage.setItem('notificationRequestDismissed', Date.now().toString());
  };

  // Vérifier si on a récemment refusé la demande
  useEffect(() => {
    const dismissedTime = localStorage.getItem('notificationRequestDismissed');
    if (dismissedTime) {
      const timeSinceDismissed = Date.now() - parseInt(dismissedTime);
      // Ne pas redemander pendant 24h
      if (timeSinceDismissed < 24 * 60 * 60 * 1000) {
        setShowRequest(false);
      }
    }
  }, []);

  // Ne pas afficher si les notifications sont déjà accordées ou le navigateur ne les supporte pas
  if (!('Notification' in window) || permission === 'granted') {
    return null;
  }

  // Afficher seulement si pas encore demandé ou si c'est par défaut ET qu'on doit montrer la demande
  if (!showRequest && permission !== 'default') {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 max-w-sm z-50">
      <Card className="border-2 border-primary bg-background shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-start justify-between space-x-3">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="font-medium text-sm">Activer les notifications</h3>
                <p className="text-xs text-muted-foreground">
                  Recevez des alertes en temps réel pour les activités importantes de votre hôtel.
                </p>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={requestPermission}
                    className="text-xs"
                  >
                    Activer
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={dismissRequest}
                    className="text-xs"
                  >
                    Plus tard
                  </Button>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={dismissRequest}
              className="p-1 h-6 w-6"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};