/**
 * Service de stockage unifié - Source unique de vérité pour localStorage
 * Remplace hotelStorageService.ts et élimine les clés legacy
 */

// Clés unifiées
const STORAGE_KEYS = {
  HOTEL_SESSION: 'nettobloc_hotel_session',
  USER_PREFERENCES: 'nettobloc_user_prefs',
  ADMIN_TAB: 'nettobloc_admin_tab',
  ACTIVE_PORTAL: 'nettobloc_active_portal',
  HOUSEKEEPER_PROFILE: 'nettobloc_hk_profile',
  HOUSEKEEPER_SESSION: 'nettobloc_hk_session',
  TECHNICIAN_PROFILE: 'nettobloc_tech_profile',
} as const;
...
export interface HousekeeperProfile {
  id: string;
  name: string;
  email: string;
  currentHotelId?: string;
}

export type AppPortal = 'establishment' | 'housekeeper' | 'governess' | 'technician';
...
  // ============ ADMIN TAB ============

  saveAdminTab(tab: string): void {
    localStorage.setItem(STORAGE_KEYS.ADMIN_TAB, tab);
  }

  getAdminTab(): string {
    return localStorage.getItem(STORAGE_KEYS.ADMIN_TAB) || 'overview';
  }

  // ============ ACTIVE PORTAL ============

  saveActivePortal(portal: AppPortal): void {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PORTAL, portal);
  }

  getActivePortal(): AppPortal | null {
    const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_PORTAL);

    if (
      stored === 'establishment' ||
      stored === 'housekeeper' ||
      stored === 'governess' ||
      stored === 'technician'
    ) {
      return stored;
    }

    return null;
  }

  clearActivePortal(): void {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_PORTAL);
  }

  // ============ HOUSEKEEPER PROFILE ============

  saveHousekeeperProfile(profile: HousekeeperProfile): void {
    localStorage.setItem(STORAGE_KEYS.HOUSEKEEPER_PROFILE, JSON.stringify(profile));
  }

  getHousekeeperProfile(): HousekeeperProfile | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.HOUSEKEEPER_PROFILE);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  clearHousekeeperProfile(): void {
    localStorage.removeItem(STORAGE_KEYS.HOUSEKEEPER_PROFILE);
  }

  // ============ HOUSEKEEPER SESSION (for non-auth sessions) ============

  saveHousekeeperSession(data: { id: string; name: string; accessCode?: string }): void {
    localStorage.setItem(STORAGE_KEYS.HOUSEKEEPER_SESSION, JSON.stringify({
      ...data,
      timestamp: Date.now()
    }));
  }

  getHousekeeperSession(): { id: string; name: string; accessCode?: string } | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.HOUSEKEEPER_SESSION);
      if (!stored) {
        // Try legacy keys
        const legacyHousekeeper = localStorage.getItem('housekeeper');
        if (legacyHousekeeper) {
          const parsed = JSON.parse(legacyHousekeeper);
          return { id: parsed.id, name: parsed.name, accessCode: parsed.access_code };
        }
        return null;
      }
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  clearHousekeeperSession(): void {
    localStorage.removeItem(STORAGE_KEYS.HOUSEKEEPER_SESSION);
    // Also clear legacy
    localStorage.removeItem('housekeeper');
    localStorage.removeItem('housekeeper_name');
    localStorage.removeItem('housekeeper_id');
  }

  // ============ TECHNICIAN PROFILE ============

  saveTechnicianProfile(profile: { id: string; name: string; email: string }): void {
    localStorage.setItem(STORAGE_KEYS.TECHNICIAN_PROFILE, JSON.stringify(profile));
  }

  getTechnicianProfile(): { id: string; name: string; email: string } | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TECHNICIAN_PROFILE);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  clearTechnicianProfile(): void {
    localStorage.removeItem(STORAGE_KEYS.TECHNICIAN_PROFILE);
  }

  // ============ UTILITY ============

  /**
   * Nettoie tout le stockage de l'application
   */
  clearAll(): void {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    // Clear remaining legacy keys
    LEGACY_KEYS.forEach(key => {
      localStorage.removeItem(key);
    });
  }

  /**
   * Nettoie les données volatiles (session, tokens) sans toucher à l'auth
   */
  clearVolatile(): void {
    const volatileKeys = [
      STORAGE_KEYS.HOTEL_SESSION,
      STORAGE_KEYS.HOUSEKEEPER_SESSION,
      'hotel_session_token',
      'pendingActions',
      'sb-rarhqnvvbjzfdevnghnz-auth-token-code-verifier',
    ];
    
    volatileKeys.forEach(key => {
      localStorage.removeItem(key);
    });
    
  }

  /**
   * Récupération d'urgence de l'hotel ID
   */
  recoverHotelId(): string | null {
    // 1. Essayer la méthode standard
    const standard = this.getHotelId();
    if (standard) return standard;

    // 2. Essayer les clés legacy (peut encore exister)
    const legacyKeys = ['selectedHotelId', 'currentHotelId', 'hotelId', 'lastSelectedHotelId'];
    for (const key of legacyKeys) {
      const id = localStorage.getItem(key);
      if (id && this.isValidUUID(id)) {
        this.saveHotel({ id, name: '', code: '' });
        return id;
      }
    }

    return null;
  }

  /**
   * Nettoie les clés legacy obsolètes
   */
  cleanupLegacyKeys(): void {
    LEGACY_KEYS.forEach(key => {
      localStorage.removeItem(key);
    });
  }

  /**
   * Vérifie si le cache est sain
   */
  isHealthy(): { ok: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check hotel session
    const hotel = this.getHotel();
    if (hotel) {
      if (!this.isValidUUID(hotel.id)) {
        issues.push('Hotel ID invalide');
      }
      if (Date.now() > hotel.expiresAt) {
        issues.push('Session hôtel expirée');
      }
    }
    
    // Check for orphaned legacy keys
    LEGACY_KEYS.forEach(key => {
      if (localStorage.getItem(key)) {
        issues.push(`Clé legacy présente: ${key}`);
      }
    });
    
    return {
      ok: issues.length === 0,
      issues
    };
  }
}

// Singleton
export const storageService = new StorageService();
