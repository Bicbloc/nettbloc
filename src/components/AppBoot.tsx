import { useEffect, useState } from 'react';
import { storageService } from '@/services/storageService';

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
 * AppBoot component - handles cache invalidation on new deployments
 * This solves the "works in private browsing" issue
 */
export const AppBoot = ({ children }: { children: React.ReactNode }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const checkAndCleanCache = () => {
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

        // Nettoyage safe à CHAQUE démarrage (évite les états "ça marche en navigation privée")
        storageService.cleanupLegacyKeys();
        const health = storageService.isHealthy();
        if (!health.ok) {
          console.warn('🩺 AppBoot: Storage unhealthy, clearing volatile cache:', health.issues);
          storageService.clearVolatile();
        }

        // Check for corrupted auth state
        const authToken = localStorage.getItem('sb-rarhqnvvbjzfdevnghnz-auth-token');
        if (authToken) {
          try {
            const parsed = JSON.parse(authToken);
            // Check if token is expired
            if (parsed.expires_at && parsed.expires_at * 1000 < Date.now()) {
              console.log('🔐 AppBoot: Expired auth token found, clearing...');
              localStorage.removeItem('sb-rarhqnvvbjzfdevnghnz-auth-token');
            }
          } catch {
            // Invalid JSON, clear it
            console.log('🔐 AppBoot: Invalid auth token found, clearing...');
            localStorage.removeItem('sb-rarhqnvvbjzfdevnghnz-auth-token');
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
