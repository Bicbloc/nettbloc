import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthStabilityOptions {
  enableRetry: boolean;
  maxRetries: number;
  retryDelay: number;
}

export const useHousekeeperAuthStability = (options: AuthStabilityOptions = {
  enableRetry: true,
  maxRetries: 3,
  retryDelay: 1000
}) => {
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'offline'>('good');
  const [retryCount, setRetryCount] = useState(0);
  const { toast } = useToast();

  // Surveiller la qualité de connexion
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const startTime = Date.now();
        await supabase.from('profiles').select('id').limit(1);
        const responseTime = Date.now() - startTime;
        
        if (responseTime < 1000) {
          setConnectionQuality('good');
        } else if (responseTime < 3000) {
          setConnectionQuality('poor');
        } else {
          setConnectionQuality('offline');
        }
        
        setRetryCount(0); // Reset sur succès
      } catch (error) {
        setConnectionQuality('offline');
        console.error('Connection check failed:', error);
      }
    };

    const interval = setInterval(checkConnection, 30000); // Check every 30s
    checkConnection(); // Initial check

    return () => clearInterval(interval);
  }, []);

  const executeWithRetry = async <T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T | null> => {
    let attempts = 0;
    
    while (attempts < options.maxRetries) {
      try {
        const result = await operation();
        if (attempts > 0) {
          toast({
            title: "Connexion rétablie",
            description: `${operationName} a réussi après ${attempts} tentative(s).`
          });
        }
        return result;
      } catch (error) {
        attempts++;
        console.error(`${operationName} attempt ${attempts} failed:`, error);
        
        if (attempts >= options.maxRetries) {
          toast({
            variant: "destructive",
            title: "Échec de connexion",
            description: `${operationName} a échoué après ${attempts} tentatives.`
          });
          setRetryCount(attempts);
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, options.retryDelay * attempts));
      }
    }
    
    return null;
  };

  const authenticateCode = async (accessCode: string, hotelId?: string) => {
    return executeWithRetry(async () => {
      console.log('🔐 Tentative authentification code:', accessCode);
      
      const { data, error } = await supabase.rpc('authenticate_housekeeper_by_code', {
        p_access_code: accessCode.toUpperCase().trim()
      });
      
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Code invalide');
      
      const result = data[0];
      console.log('✅ Authentification réussie:', result);
      
      return result;
    }, 'Authentification du code');
  };

  return {
    connectionQuality,
    retryCount,
    executeWithRetry,
    authenticateCode
  };
};