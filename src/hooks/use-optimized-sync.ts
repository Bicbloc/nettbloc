import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SyncCache {
  housekeepers: Map<string, any>;
  accessCodes: Map<string, string>;
  lastUpdate: number;
}

interface BatchResult {
  success: boolean;
  generated: number;
  errors: string[];
}

export function useOptimizedSync() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const cache = useRef<SyncCache>({
    housekeepers: new Map(),
    accessCodes: new Map(),
    lastUpdate: 0
  });

  // Cache intelligent avec invalidation
  const getCachedData = useCallback((key: string, maxAge: number = 30000) => {
    const now = Date.now();
    if (now - cache.current.lastUpdate > maxAge) {
      cache.current.housekeepers.clear();
      cache.current.accessCodes.clear();
    }
    return cache.current.housekeepers.get(key);
  }, []);

  const setCachedData = useCallback((key: string, data: any) => {
    cache.current.housekeepers.set(key, data);
    cache.current.lastUpdate = Date.now();
  }, []);

  // Génération optimisée de codes d'accès par batch
  const generateAccessCodesBatch = useCallback(async (
    hotelId: string, 
    housekeeperNames: string[]
  ): Promise<BatchResult> => {
    setIsProcessing(true);
    const result: BatchResult = { success: true, generated: 0, errors: [] };

    try {
      // Vérifier les codes existants en une seule requête
      const { data: existingCodes } = await supabase
        .from('housekeeper_access_codes')
        .select('access_code, housekeeper_id')
        .eq('hotel_id', hotelId)
        .eq('is_active', true);

      const existingCodeSet = new Set(existingCodes?.map(c => c.access_code) || []);

      // Pré-générer un pool de codes uniques
      const codePool = new Set<string>();
      while (codePool.size < housekeeperNames.length * 2) { // Buffer de sécurité
        const code = await generateUniqueCode(hotelId, existingCodeSet, codePool);
        if (code) codePool.add(code);
      }

      const codes = Array.from(codePool);
      let codeIndex = 0;

      // Traitement par batch de 5
      const batchSize = 5;
      for (let i = 0; i < housekeeperNames.length; i += batchSize) {
        const batch = housekeeperNames.slice(i, i + batchSize);
        
        await Promise.allSettled(batch.map(async (name) => {
          try {
            const accessCode = codes[codeIndex++];
            if (!accessCode) throw new Error('Pool de codes épuisé');

            // Créer avec le code pré-généré
            const { data, error } = await supabase
              .from('housekeepers')
              .insert({
                hotel_id: hotelId,
                name,
                access_code: accessCode,
                user_id: (await supabase.auth.getUser()).data.user?.id
              })
              .select()
              .single();

            if (error) throw error;

            setCachedData(`${hotelId}-${name}`, data);
            result.generated++;
          } catch (error) {
            result.errors.push(`${name}: ${error.message}`);
          }
        }));

        // Pause entre les batches pour éviter la surcharge
        if (i + batchSize < housekeeperNames.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      if (result.errors.length > 0) {
        result.success = false;
      }

      return result;
    } catch (error) {
      console.error('Erreur génération batch:', error);
      result.success = false;
      result.errors.push('Erreur générale de génération');
      return result;
    } finally {
      setIsProcessing(false);
    }
  }, [setCachedData]);

  // Génération de code unique optimisée
  const generateUniqueCode = async (
    hotelId: string, 
    existingCodes: Set<string>, 
    tempCodes: Set<string>
  ): Promise<string | null> => {
    try {
      // Récupérer le code hôtel depuis le cache ou la DB
      let hotelCode = cache.current.accessCodes.get(hotelId);
      if (!hotelCode) {
        const { data } = await supabase
          .from('hotels')
          .select('hotel_code')
          .eq('id', hotelId)
          .single();
        hotelCode = data?.hotel_code || 'HTL';
        cache.current.accessCodes.set(hotelId, hotelCode);
      }

      // Génération avec vérification optimisée
      for (let attempts = 0; attempts < 10; attempts++) {
        const suffix = Math.floor(1000 + Math.random() * 9000).toString();
        const code = `${hotelCode}-${suffix}`;
        
        if (!existingCodes.has(code) && !tempCodes.has(code)) {
          return code;
        }
      }
      return null;
    } catch (error) {
      console.error('Erreur génération code unique:', error);
      return null;
    }
  };

  // Synchronisation intelligente avec retry
  const syncWithRetry = useCallback(async (
    operation: () => Promise<any>,
    maxRetries: number = 3
  ): Promise<any> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        console.warn(`Tentative ${attempt}/${maxRetries} échouée:`, error);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Délai exponentiel entre les tentatives
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }, []);

  return {
    generateAccessCodesBatch,
    syncWithRetry,
    getCachedData,
    setCachedData,
    isProcessing,
    clearCache: () => {
      cache.current.housekeepers.clear();
      cache.current.accessCodes.clear();
      cache.current.lastUpdate = 0;
    }
  };
}