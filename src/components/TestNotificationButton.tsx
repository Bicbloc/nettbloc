import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useNotifications } from '@/hooks/use-notifications';
import { TestTube } from 'lucide-react';
import { isValidUUID } from '@/lib/utils';

interface TestNotificationButtonProps {
  hotelId?: string;
}

export function TestNotificationButton({ hotelId }: TestNotificationButtonProps) {
  const { addNotification } = useNotifications(hotelId);

  const handleTest = async () => {
    console.log("🧪 Test notification avec hotelId:", hotelId);
    
    if (!hotelId) {
      toast({
        variant: "destructive", 
        title: "Erreur",
        description: "Aucun hôtel configuré pour les notifications"
      });
      return;
    }

    if (!isValidUUID(hotelId)) {
      toast({
        variant: "destructive", 
        title: "Erreur UUID",
        description: `Hotel ID invalide: ${hotelId.slice(0, 15)}... - Veuillez reconfigurer l'hôtel`
      });
      return;
    }

    const success = await addNotification({
      title: "🧪 Test système - Notifications opérationnelles",
      description: `Notification de test créée avec succès pour l'hôtel ID: ${hotelId.slice(0, 8)}... - ${new Date().toLocaleTimeString()}`,
      type: 'assignment',
      user_type: 'admin'
    });

    if (success) {
      toast({
        title: "Test réussi ✅",
        description: "La notification de test a été créée avec succès"
      });
    } else {
      toast({
        variant: "destructive",
        title: "Test échoué ❌",
        description: "Impossible de créer la notification de test"
      });
    }
  };

  return (
    <Button
      onClick={handleTest}
      variant="outline"
      size="sm"
      className="hover-scale"
    >
      <TestTube className="h-4 w-4 mr-2" />
      Test notifications
    </Button>
  );
}