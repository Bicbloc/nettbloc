import { useState, useEffect } from 'react';
import { SupabaseService } from '@/services/supabaseService';
import { useHousekeeping } from '@/contexts/HousekeepingContext';
import { useToast } from '@/hooks/use-toast';

interface SyncResult {
  success: boolean;
  synchronized: number;
  errors: string[];
}

export function useHousekeeperSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const { housekeeperNames, refreshHousekeepers } = useHousekeeping();
  const { toast } = useToast();

  const syncHousekeepers = async (): Promise<SyncResult> => {
    setIsSyncing(true);
    const result: SyncResult = {
      success: true,
      synchronized: 0,
      errors: []
    };

    try {
      const selectedHotelId = localStorage.getItem('selectedHotelId');
      
      if (!selectedHotelId) {
        result.success = false;
        result.errors.push('Aucun hôtel sélectionné');
        return result;
      }

      // Récupérer les femmes de chambre existantes en base
      const existingHousekeepers = await SupabaseService.getHousekeepers(selectedHotelId);
      const existingNames = existingHousekeepers.map(h => h.name.toLowerCase());

      // Synchroniser chaque femme de chambre du contexte local
      for (const name of housekeeperNames) {
        if (!existingNames.includes(name.toLowerCase())) {
          try {
            const housekeeper = await SupabaseService.createHousekeeper(selectedHotelId, name);
            if (housekeeper) {
              result.synchronized++;
              console.log(`✅ Femme de chambre synchronisée: ${name} -> ${housekeeper.access_code}`);
            } else {
              result.errors.push(`Échec synchronisation: ${name}`);
            }
          } catch (error) {
            console.error(`Erreur synchronisation ${name}:`, error);
            result.errors.push(`Erreur synchronisation: ${name}`);
          }
        }
      }

      // Rafraîchir la liste depuis la base
      await refreshHousekeepers();

      if (result.synchronized > 0) {
        toast({
          title: "Synchronisation réussie",
          description: `${result.synchronized} femme(s) de chambre synchronisée(s)`,
        });
      }

      if (result.errors.length > 0) {
        result.success = false;
        toast({
          title: "Synchronisation partielle",
          description: `${result.errors.length} erreur(s) lors de la synchronisation`,
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error('Erreur synchronisation:', error);
      result.success = false;
      result.errors.push('Erreur générale de synchronisation');
      
      toast({
        title: "Erreur synchronisation",
        description: "Une erreur est survenue lors de la synchronisation",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }

    return result;
  };

  // Synchronisation automatique au chargement si nécessaire
  useEffect(() => {
    const autoSync = async () => {
      const selectedHotelId = localStorage.getItem('selectedHotelId');
      if (!selectedHotelId || housekeeperNames.length === 0) return;

      // Vérifier s'il y a des femmes de chambre à synchroniser
      const existingHousekeepers = await SupabaseService.getHousekeepers(selectedHotelId);
      const existingNames = existingHousekeepers.map(h => h.name.toLowerCase());
      
      const needsSync = housekeeperNames.some(name => 
        !existingNames.includes(name.toLowerCase())
      );

      if (needsSync) {
        console.log('🔄 Synchronisation automatique requise');
        await syncHousekeepers();
      }
    };

    // Délai pour laisser le contexte se charger
    const timeout = setTimeout(autoSync, 2000);
    return () => clearTimeout(timeout);
  }, [housekeeperNames.length]);

  return {
    syncHousekeepers,
    isSyncing
  };
}