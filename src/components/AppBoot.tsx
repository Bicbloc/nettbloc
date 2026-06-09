import { useEffect, useState } from 'react';
import { storageService } from '@/services/storageService';
import { nativeNotificationService } from '@/services/nativeNotificationService';
import { pushNotificationService } from '@/services/pushNotificationService';
import { nativeCameraService } from '@/services/nativeCameraService';

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
 * AppBoot component - handles cache invalidation only
 * NON-BLOCKING: does not touch auth tokens, AuthContext handles that
 */
export const AppBoot = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    try {
      const currentBuildId = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';
      const storedBuildId = localStorage.getItem(BUILD_ID_KEY);

      if (typeof window !== 'undefined') {
        storageService.syncActivePortalFromPath(window.location.pathname);
      }

      if (storedBuildId && storedBuildId !== currentBuildId) {
        VOLATILE_KEYS.forEach(key => {
          try { localStorage.removeItem(key); } catch { /* ignore */ }
        });
        storageService.cleanupLegacyKeys();
        localStorage.setItem(LAST_CLEAN_KEY, new Date().toISOString());
      }

      localStorage.setItem(BUILD_ID_KEY, currentBuildId);
      storageService.cleanupLegacyKeys();
    } catch (error) {
      console.error('❌ AppBoot error:', error);
    }
  }, []);

  // Initialiser les permissions natives (APK) : notifications + push + caméra
  useEffect(() => {
    nativeNotificationService.initialize();
    // Push FCM (APK uniquement) : sonnerie même application fermée
    pushNotificationService.initialize();
    // Pré-demander la permission caméra côté APK pour éviter le blocage au 1er usage
    if (nativeCameraService.isNative) {
      nativeCameraService.requestPermissions().catch(() => { /* silent */ });
    }
  }, []);

  return <>{children}</>;
};
