import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { HousekeeperActionLogger } from '@/services/housekeeperActionLogger';

interface UseRoomCleaningActionsProps {
  hotelId: string;
  housekeeperName: string;
}

export const useRoomCleaningActions = ({ 
  hotelId, 
  housekeeperName 
}: UseRoomCleaningActionsProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const startCleaning = useCallback(async (roomNumber: string) => {
    if (!hotelId || !housekeeperName) {
      console.warn('Missing hotelId or housekeeperName for cleaning start');
      return false;
    }

    setIsLoading(true);
    try {
      const success = await HousekeeperActionLogger.logCleaningStart(
        hotelId,
        roomNumber,
        housekeeperName
      );

      if (success) {
        toast({
          title: "🧹 Nettoyage démarré",
          description: `Chambre ${roomNumber} - nettoyage en cours`,
          duration: 3000,
        });
      }

      return success;
    } catch (error) {
      console.error('Error starting cleaning:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'enregistrer le début du nettoyage"
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [hotelId, housekeeperName, toast]);

  const finishCleaning = useCallback(async (roomNumber: string) => {
    if (!hotelId || !housekeeperName) {
      console.warn('Missing hotelId or housekeeperName for cleaning end');
      return false;
    }

    setIsLoading(true);
    try {
      const success = await HousekeeperActionLogger.logCleaningEnd(
        hotelId,
        roomNumber,
        housekeeperName
      );

      if (success) {
        toast({
          title: "✅ Nettoyage terminé",
          description: `Chambre ${roomNumber} - nettoyage complété`,
          duration: 3000,
        });
      }

      return success;
    } catch (error) {
      console.error('Error finishing cleaning:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'enregistrer la fin du nettoyage"
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [hotelId, housekeeperName, toast]);

  return {
    startCleaning,
    finishCleaning,
    isLoading
  };
};