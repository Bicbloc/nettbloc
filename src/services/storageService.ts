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

// Anciennes clés à migrer puis supprimer
const LEGACY_KEYS = [
  'hotel_session',
  'selectedHotelId',
  'selectedHotelName',
  'selectedHotelCode',
  'currentHotelId',
  'hotelId',
  'lastSelectedHotelId',
  'housekeeperProfile',
  'housekeeper',
  'housekeeper_name',
  'housekeeper_id',
  'housekeeperCode',
  'admin_active_tab',
] as const;

export interface HotelSession {
  id: string;
  name: string;
  code: string;
  timestamp: number;
  expiresAt: number;
}

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  notifications?: boolean;
}

export interface HousekeeperProfile {
  id: string;
  name: string;
  email: string;
  currentHotelId?: string;
}

export type AppPortal = 'establishment' | 'housekeeper' | 'governess' | 'technician' | 'cafetiere';

const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

class StorageService {
  private migrated = false;

  constructor() {
    this.migrateFromLegacy();
  }

  /**
   * Migration one-time des anciennes clés vers le nouveau format
   */
  private migrateFromLegacy(): void {
    if (this.migrated) return;
    
    try {
      // Vérifier si migration déjà faite
      const migrationDone = localStorage.getItem('nettobloc_migration_v1');
      if (migrationDone) {
        this.migrated = true;
        return;
      }


      // Migrer hotel_session ou clés individuelles
      const existingSession = localStorage.getItem('hotel_session');
      if (existingSession) {
        try {
          const parsed = JSON.parse(existingSession);
          if (parsed.id && this.isValidUUID(parsed.id)) {
            this.saveHotel({
              id: parsed.id,
              name: parsed.name || '',
              code: parsed.code || ''
            });
          }
        } catch (e) {
          // Ignorer les erreurs de parsing
        }
      } else {
        // Essayer les anciennes clés individuelles
        const legacyId = localStorage.getItem('selectedHotelId') || 
                         localStorage.getItem('currentHotelId') || 
                         localStorage.getItem('hotelId');
        
        if (legacyId && this.isValidUUID(legacyId)) {
          this.saveHotel({
            id: legacyId,
            name: localStorage.getItem('selectedHotelName') || '',
            code: localStorage.getItem('selectedHotelCode') || ''
          });
        }
      }

      // Migrer admin_active_tab
      const adminTab = localStorage.getItem('admin_active_tab');
      if (adminTab) {
        localStorage.setItem(STORAGE_KEYS.ADMIN_TAB, adminTab);
      }

      // Migrer housekeeperProfile
      const hkProfile = localStorage.getItem('housekeeperProfile');
      if (hkProfile) {
        localStorage.setItem(STORAGE_KEYS.HOUSEKEEPER_PROFILE, hkProfile);
      }

      // Nettoyer les anciennes clés (après migration réussie)
      LEGACY_KEYS.forEach(key => {
        localStorage.removeItem(key);
      });

      // Marquer la migration comme faite
      localStorage.setItem('nettobloc_migration_v1', Date.now().toString());
      this.migrated = true;
      
    } catch (error) {
      console.error('❌ StorageService: Erreur migration:', error);
    }
  }

  private isValidUUID(uuid: string): boolean {
    if (!uuid || typeof uuid !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid) || uuid.length >= 30;
  }

  // ============ HOTEL SESSION ============

  saveHotel(hotel: { id: string; name: string; code: string }): void {
    if (!hotel.id || !this.isValidUUID(hotel.id)) {
      console.error('❌ StorageService: ID hôtel invalide', hotel.id);
      throw new Error('Invalid hotel ID');
    }

    const session: HotelSession = {
      ...hotel,
      timestamp: Date.now(),
      expiresAt: Date.now() + EXPIRY_MS,
    };

    localStorage.setItem(STORAGE_KEYS.HOTEL_SESSION, JSON.stringify(session));
    
    // Backward compatibility: garder selectedHotelId pour les anciens composants
    // À supprimer dans une future version
    localStorage.setItem('selectedHotelId', hotel.id);
    
  }

  getHotel(): HotelSession | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.HOTEL_SESSION);
      if (!stored) return null;

      const session: HotelSession = JSON.parse(stored);
      
      // Vérifier expiration
      if (Date.now() > session.expiresAt) {
        this.clearHotel();
        return null;
      }

      return session;
    } catch (error) {
      console.error('❌ StorageService: Erreur lecture hotel:', error);
      return null;
    }
  }

  getHotelId(): string | null {
    return this.getHotel()?.id || null;
  }

  clearHotel(): void {
    localStorage.removeItem(STORAGE_KEYS.HOTEL_SESSION);
    localStorage.removeItem('selectedHotelId'); // Backward compat
  }

  saveHousekeeperHotel(hotel: { id: string; name?: string; code?: string }): void {
    if (!hotel.id || !this.isValidUUID(hotel.id)) return;
    localStorage.setItem('nettobloc_hk_hotel_id', hotel.id);
    if (hotel.name) localStorage.setItem('nettobloc_hk_hotel_name', hotel.name);
    if (hotel.code) localStorage.setItem('nettobloc_hk_hotel_code', hotel.code);
  }

  getHousekeeperHotelId(): string | null {
    const id = localStorage.getItem('nettobloc_hk_hotel_id');
    return id && this.isValidUUID(id) ? id : null;
  }

  clearHousekeeperHotel(): void {
    localStorage.removeItem('nettobloc_hk_hotel_id');
    localStorage.removeItem('nettobloc_hk_hotel_name');
    localStorage.removeItem('nettobloc_hk_hotel_code');
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

  // ============ STAFF MODE (APK) ============

  /** Persist staff-only mode (mobile APK) so it survives refresh & navigation */
  setStaffMode(enabled: boolean): void {
    if (enabled) {
      localStorage.setItem('nettobloc_staff_mode', 'true');
    }
  }

  isStaffMode(): boolean {
    return localStorage.getItem('nettobloc_staff_mode') === 'true';
  }

  // ============ USER PREFERENCES ============

  savePreferences(prefs: UserPreferences): void {
    localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(prefs));
  }

  getPreferences(): UserPreferences {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  // ============ ADMIN TAB ============

  saveAdminTab(tab: string): void {
    localStorage.setItem(STORAGE_KEYS.ADMIN_TAB, tab);
  }

  getAdminTab(): string {
    return localStorage.getItem(STORAGE_KEYS.ADMIN_TAB) || 'overview';
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

    // 1b. Hôtel verrouillé côté femme de chambre
    const housekeeperHotelId = this.getHousekeeperHotelId();
    if (housekeeperHotelId) {
      this.saveHotel({ id: housekeeperHotelId, name: '', code: '' });
      return housekeeperHotelId;
    }

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
