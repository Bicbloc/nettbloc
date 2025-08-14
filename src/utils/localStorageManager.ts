// Gestionnaire centralisé pour nettoyer et gérer le localStorage
export class LocalStorageManager {
  private static readonly HOTEL_KEYS = [
    'selectedHotelId',
    'selectedHotelCode', 
    'selectedHotelName',
    'autoSetupComplete',
    'lastHotelCheck',
    'email_hotel_association'
  ];

  private static readonly CORRUPTED_VALUES = [
    'undefined',
    'null',
    '',
    'false',
    'true'
  ];

  /**
   * Détecter les valeurs corrompues dans localStorage
   */
  static detectCorruptedValues(): string[] {
    const corrupted: string[] = [];
    
    this.HOTEL_KEYS.forEach(key => {
      const value = localStorage.getItem(key);
      if (value && this.CORRUPTED_VALUES.includes(value)) {
        corrupted.push(`${key}=${value}`);
      }
      
      // Vérifier les UUIDs invalides pour selectedHotelId
      if (key === 'selectedHotelId' && value && !this.isValidUUID(value)) {
        corrupted.push(`${key}=${value} (invalid UUID)`);
      }
    });
    
    return corrupted;
  }

  /**
   * Nettoyer toutes les valeurs corrompues
   */
  static cleanCorruptedValues(): { cleaned: string[], remaining: string[] } {
    const corrupted = this.detectCorruptedValues();
    const cleaned: string[] = [];
    
    corrupted.forEach(item => {
      const key = item.split('=')[0];
      localStorage.removeItem(key);
      cleaned.push(key);
      console.log(`🧹 Nettoyé localStorage corrrompu: ${item}`);
    });
    
    const remaining = this.detectCorruptedValues();
    return { cleaned, remaining };
  }

  /**
   * Reset complet de tous les données hôtel
   */
  static resetHotelData(): void {
    console.log('🔄 Reset complet des données hôtel localStorage...');
    this.HOTEL_KEYS.forEach(key => {
      localStorage.removeItem(key);
    });
    
    // Nettoyer également les préférences utilisateur liées
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(key => {
      if (key.startsWith('housekeeper_') || key.startsWith('hotel_')) {
        localStorage.removeItem(key);
      }
    });
    
    console.log('✅ Reset localStorage terminé');
  }

  /**
   * Sauvegarder les données hôtel avec validation
   */
  static saveHotelData(hotelData: {
    id: string;
    code?: string;
    name: string;
  }): boolean {
    try {
      if (!this.isValidUUID(hotelData.id)) {
        console.error('❌ ID hôtel invalide:', hotelData.id);
        return false;
      }

      // Nettoyer d'abord les anciennes valeurs
      this.HOTEL_KEYS.forEach(key => localStorage.removeItem(key));

      // Sauvegarder les nouvelles valeurs
      localStorage.setItem('selectedHotelId', hotelData.id);
      localStorage.setItem('selectedHotelCode', hotelData.code || '');
      localStorage.setItem('selectedHotelName', hotelData.name);
      localStorage.setItem('autoSetupComplete', 'true');
      localStorage.setItem('lastHotelCheck', Date.now().toString());

      console.log('✅ Données hôtel sauvegardées:', {
        id: hotelData.id,
        code: hotelData.code,
        name: hotelData.name
      });

      return true;
    } catch (error) {
      console.error('❌ Erreur sauvegarde localStorage:', error);
      return false;
    }
  }

  /**
   * Valider un UUID
   */
  private static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Obtenir un rapport de diagnostic du localStorage
   */
  static getDiagnosticReport(): {
    valid: Record<string, string>;
    corrupted: string[];
    missing: string[];
  } {
    const valid: Record<string, string> = {};
    const missing: string[] = [];
    const corrupted = this.detectCorruptedValues();

    this.HOTEL_KEYS.forEach(key => {
      const value = localStorage.getItem(key);
      if (value === null) {
        missing.push(key);
      } else if (!corrupted.some(c => c.startsWith(key + '='))) {
        valid[key] = value;
      }
    });

    return { valid, corrupted, missing };
  }
}