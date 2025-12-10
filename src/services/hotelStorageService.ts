export interface HotelSession {
  id: string;
  name: string;
  code: string;
  timestamp: number;
}

export class HotelStorageService {
  private static readonly KEY = 'hotel_session';
  private static readonly EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

  // Clé unique pour éviter les conflits de synchronisation
  private static readonly LEGACY_KEY = 'selectedHotelId';

  static save(hotel: { id: string; name: string; code: string }): void {
    try {
      // Validation des données
      if (!hotel.id || hotel.id.length < 30) {
        console.error('❌ HotelStorageService: ID invalide', hotel.id);
        throw new Error('Invalid hotel ID');
      }

      const session: HotelSession = {
        ...hotel,
        timestamp: Date.now(),
      };
      
      // Source unique de vérité
      localStorage.setItem(this.KEY, JSON.stringify(session));
      
      // UNE SEULE clé legacy pour rétrocompatibilité (évite les conflits)
      localStorage.setItem(this.LEGACY_KEY, hotel.id);
      
      // Backup pour récupération (lecture seule, jamais écrit ailleurs)
      localStorage.setItem('lastSelectedHotelId', hotel.id);
      
      // Vérification immédiate
      const verification = localStorage.getItem(this.LEGACY_KEY);
      if (verification !== hotel.id) {
        console.error('❌ Échec sauvegarde localStorage');
        throw new Error('localStorage save failed');
      }
      
      console.log('✅ Hotel session saved:', hotel.id.slice(0, 8) + '...');
    } catch (error) {
      console.error('Failed to save hotel session:', error);
      throw error;
    }
  }

  static get(): HotelSession | null {
    try {
      // Try new format first
      const stored = localStorage.getItem(this.KEY);
      if (stored) {
        const session: HotelSession = JSON.parse(stored);
        
        // Check if expired
        if (Date.now() - session.timestamp > this.EXPIRY_MS) {
          this.clear();
          return null;
        }
        
        return session;
      }

      // Fallback to legacy keys
      const id = localStorage.getItem('selectedHotelId');
      if (id) {
        return {
          id,
          name: localStorage.getItem('selectedHotelName') || '',
          code: localStorage.getItem('selectedHotelCode') || '',
          timestamp: Date.now()
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to retrieve hotel session:', error);
      this.clear();
      return null;
    }
  }

  static clear(): void {
    try {
      localStorage.removeItem(this.KEY);
      localStorage.removeItem(this.LEGACY_KEY);
      // Ne PAS effacer lastSelectedHotelId (backup de récupération)
    } catch (error) {
      console.error('Failed to clear hotel session:', error);
    }
  }

  static getId(): string | null {
    const session = this.get();
    return session?.id || null;
  }

  // Méthode de récupération en cas de perte
  static recover(): string | null {
    // 1. Essayer la méthode standard
    const standard = this.getId();
    if (standard) return standard;
    
    // 2. Essayer le backup
    const backup = localStorage.getItem('lastSelectedHotelId');
    if (backup && backup.length >= 30) {
      console.log('🔄 Récupération depuis lastSelectedHotelId');
      // Restaurer les données
      localStorage.setItem('selectedHotelId', backup);
      localStorage.setItem('currentHotelId', backup);
      return backup;
    }
    
    // 3. Essayer le profil
    try {
      const profile = localStorage.getItem('housekeeperProfile');
      if (profile) {
        const parsed = JSON.parse(profile);
        if (parsed.currentHotelId && parsed.currentHotelId.length >= 30) {
          console.log('🔄 Récupération depuis housekeeperProfile');
          localStorage.setItem('selectedHotelId', parsed.currentHotelId);
          return parsed.currentHotelId;
        }
      }
    } catch (e) {
      console.error('Erreur récupération profil:', e);
    }
    
    return null;
  }
}
