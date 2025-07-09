import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useNotifications } from '@/hooks/use-notifications';
import { TestTube } from 'lucide-react';

interface TestNotificationButtonProps {
  hotelId?: string;
}

export function TestNotificationButton({ hotelId }: TestNotificationButtonProps) {
  const { addNotification } = useNotifications(hotelId);

  const handleTest = async () => {
    if (!hotelId) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Aucun hôtel configuré"
      });
      return;
    }

    const success = await addNotification({
      title: "Test système",
      description: "Notification de test créée avec succès",
      type: 'assignment',
      user_type: 'admin'
    });

    if (success) {
      toast({
        title: "Test réussi",
        description: "La notification de test a été créée"
      });
    } else {
      toast({
        variant: "destructive",
        title: "Test échoué",
        description: "Impossible de créer la notification"
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