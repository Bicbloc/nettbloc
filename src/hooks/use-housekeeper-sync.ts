import { useState, useEffect, useCallback } from 'react';
import { SupabaseService } from '@/services/supabaseService';
import { useHousekeeping } from '@/contexts/HousekeepingContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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
            // Vérifier à nouveau en base avant création (protection contre race conditions)
            const { data: doubleCheck } = await supabase
              .from('housekeepers')
              .select('id')
              .eq('hotel_id', selectedHotelId)
              .ilike('name', name.trim())
              .eq('is_active', true)
              .maybeSingle();
            
            if (doubleCheck) {
              console.log(`⏭️ Skipping duplicate: ${name}`);
              continue;
            }
            
            const housekeeper = await SupabaseService.createHousekeeper(selectedHotelId, name);
            result.synchronized++;
            console.log(`✅ Femme de chambre synchronisée: ${name} -> ${housekeeper.access_code}`);
          } catch (error: any) {
            console.error(`Erreur synchronisation ${name}:`, error);
            const errorMsg = error.message || `Erreur synchronisation: ${name}`;
            result.errors.push(errorMsg);
            
            // Si erreur de session, arrêter et informer l'utilisateur
            if (errorMsg.includes('Session expirée') || errorMsg.includes('reconnecter')) {
              result.success = false;
              break;
            }
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
        const firstError = result.errors[0];
        
        // Message spécifique si problème de session
        if (firstError.includes('Session expirée') || firstError.includes('reconnecter')) {
          toast({
            title: "Session expirée",
            description: "Veuillez vous reconnecter pour continuer",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Synchronisation partielle",
            description: `${result.errors.length} erreur(s) lors de la synchronisation`,
            variant: "destructive"
          });
        }
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

  // Synchronisation basée sur les événements (plus de polling automatique)
  const checkForSyncNeeded = useCallback(async () => {
    const selectedHotelId = localStorage.getItem('selectedHotelId');
    if (!selectedHotelId || housekeeperNames.length === 0) return false;

    try {
      const existingHousekeepers = await SupabaseService.getHousekeepers(selectedHotelId);
      const existingNames = existingHousekeepers.map(h => h.name.toLowerCase());
      
      return housekeeperNames.some(name => 
        !existingNames.includes(name.toLowerCase())
      );
    } catch (error) {
      console.error('Error checking sync status:', error);
      return false;
    }
  }, [housekeeperNames]);

  // Exposer la vérification pour déclenchement manuel
  const triggerSyncIfNeeded = useCallback(async () => {
    const needsSync = await checkForSyncNeeded();
    if (needsSync) {
      console.log('🔄 Synchronisation déclenchée par événement');
      return await syncHousekeepers();
    }
    return { success: true, synchronized: 0, errors: [] };
  }, [checkForSyncNeeded, syncHousekeepers]);

  return {
    syncHousekeepers,
    isSyncing,
    triggerSyncIfNeeded,
    checkForSyncNeeded
  };
}