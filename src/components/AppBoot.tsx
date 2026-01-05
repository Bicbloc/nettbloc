import { useEffect, useState } from 'react';
import { storageService } from '@/services/storageService';
import { supabase } from '@/integrations/supabase/client';

// Build ID injected at build time - this will change on each deployment
declare const __BUILD_ID__: string;

const VOLATILE_KEYS = [
  'nettobloc_hotel_session',
  'nettobloc_hk_session',
  'hotel_session_token',
  'selectedHotelId',
  'currentHotelId',
  'hotelId',
  'lastSelectedHotelId',
  'pendingActions',
  'sb-rarhqnvvbjzfdevnghnz-auth-token-code-verifier',
];

const BUILD_ID_KEY = 'nettobloc_build_id';
const LAST_CLEAN_KEY = 'nettobloc_last_clean';

/**
 * AppBoot component - handles cache invalidation and auth recovery
 * This solves the "works in private browsing" issue
 */
export const AppBoot = ({ children }: { children: React.ReactNode }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const checkAndCleanCache = async () => {
      try {
        // Get current build ID (injected by Vite at build time)
        const currentBuildId = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';
        const storedBuildId = localStorage.getItem(BUILD_ID_KEY);

        console.log('🚀 AppBoot: Checking build', { current: currentBuildId?.slice(0, 10), stored: storedBuildId?.slice(0, 10) });

        // If build ID changed (new deployment)
        if (storedBuildId && storedBuildId !== currentBuildId) {
          console.log('🧹 AppBoot: New build detected, cleaning volatile cache...');

          // Clean volatile keys that might cause issues
          VOLATILE_KEYS.forEach(key => {
            try {
              localStorage.removeItem(key);
            } catch {
              // Ignore
            }
          });

          // Clean legacy keys via storageService
          storageService.cleanupLegacyKeys();

          // Record the cleanup
          localStorage.setItem(LAST_CLEAN_KEY, new Date().toISOString());
          
          console.log('✅ AppBoot: Cache cleaned for new build');
        }

        // Always update build ID
        localStorage.setItem(BUILD_ID_KEY, currentBuildId);

        // Nettoyage safe à CHAQUE démarrage
        storageService.cleanupLegacyKeys();
        
        // Vérifier la santé du storage
        const health = storageService.isHealthy();
        if (!health.ok) {
          console.warn('🩺 AppBoot: Storage unhealthy, clearing volatile cache:', health.issues);
          storageService.clearVolatile();
        }

        // ===== RÉCUPÉRATION AUTH INTELLIGENTE =====
        const authTokenKey = 'sb-rarhqnvvbjzfdevnghnz-auth-token';
        const authToken = localStorage.getItem(authTokenKey);
        
        if (authToken) {
          try {
            const parsed = JSON.parse(authToken);
            const expiresAtMs = parsed.expires_at ? parsed.expires_at * 1000 : null;
            
            if (expiresAtMs && expiresAtMs < Date.now()) {
              console.log('🔐 AppBoot: Token expiré, tentative de refresh...');
              
              // Tentative de refresh avant de supprimer
              const { error } = await supabase.auth.refreshSession();
              
              if (error) {
                console.log('🔐 AppBoot: Refresh échoué, nettoyage token:', error.message);
                localStorage.removeItem(authTokenKey);
                storageService.clearVolatile();
              } else {
                console.log('✅ AppBoot: Token récupéré par refresh');
              }
            } else if (expiresAtMs) {
              // Token valide mais proche de l'expiration (< 5 min)
              const timeToExpiry = expiresAtMs - Date.now();
              if (timeToExpiry < 5 * 60 * 1000) {
                console.log('🔐 AppBoot: Token bientôt expiré, refresh préventif...');
                await supabase.auth.refreshSession();
              }
            }
          } catch {
            // Invalid JSON, clear it
            console.log('🔐 AppBoot: Token corrompu, nettoyage...');
            localStorage.removeItem(authTokenKey);
            storageService.clearVolatile();
          }
        }

        setIsReady(true);
      } catch (error) {
        console.error('❌ AppBoot: Error during cache check:', error);
        // Continue anyway
        setIsReady(true);
      }
    };

    checkAndCleanCache();
  }, []);

  // Show nothing briefly while checking (prevents flash of stale data)
  if (!isReady) {
    return null;
  }

  return <>{children}</>;
};
