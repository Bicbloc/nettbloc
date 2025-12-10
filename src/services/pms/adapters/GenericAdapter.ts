/**
 * Adapter générique pour PMS inconnus
 * Utilise des patterns communs pour extraire les données
 */

import { PmsAdapter } from '../PmsAdapter';
import { PmsConfig, ExtractedRoom, CleaningType } from '../types';

export class GenericAdapter extends PmsAdapter {
  readonly name = 'generic';
  
  readonly keywords: string[] = [];

  readonly config: PmsConfig = {
    pmsType: 'generic',
    keywords: [],
    roomNumberRegex: '\\b([1-9]\\d{1,4})\\b',
    statusMappings: {
      // Français
      'SALE': { status: 'dirty', cleaning: 'full', priority: 20 },
      'DIRTY': { status: 'dirty', cleaning: 'full', priority: 20 },
      'PROPRE': { status: 'clean', cleaning: 'none', priority: 8 },
      'CLEAN': { status: 'clean', cleaning: 'none', priority: 8 },
      'OCCUPÉ': { status: 'occupied', cleaning: 'none', priority: 5 },
      'OCCUPE': { status: 'occupied', cleaning: 'none', priority: 5 },
      'OCCUPIED': { status: 'occupied', cleaning: 'none', priority: 5 },
      'DÉPART': { status: 'checkout', cleaning: 'full', priority: 20 },
      'DEPART': { status: 'checkout', cleaning: 'full', priority: 20 },
      'CHECKOUT': { status: 'checkout', cleaning: 'full', priority: 20 },
      'ARRIVÉE': { status: 'arrival', cleaning: 'full', priority: 15 },
      'ARRIVEE': { status: 'arrival', cleaning: 'full', priority: 15 },
      'ARRIVAL': { status: 'arrival', cleaning: 'full', priority: 15 },
      'RECOUCHE': { status: 'stayover', cleaning: 'quick', priority: 10 },
      'STAYOVER': { status: 'stayover', cleaning: 'quick', priority: 10 },
      'LIBRE': { status: 'vacant', cleaning: 'full', priority: 15 },
      'VACANT': { status: 'vacant', cleaning: 'full', priority: 15 },
      'HS': { status: 'out-of-order', cleaning: 'none', priority: 25 },
      'HORS SERVICE': { status: 'out-of-order', cleaning: 'none', priority: 25 },
      'OUT OF ORDER': { status: 'out-of-order', cleaning: 'none', priority: 25 },
    },
    combinationRules: [
      { conditions: ['checkout', 'arrival'], result: { status: 'checkout_arrival', cleaning: 'full' } },
      { conditions: ['DEPART', 'ARRIVEE'], result: { status: 'checkout_arrival', cleaning: 'full' } },
    ],
    dateFormats: ['dd/MM/yyyy', 'dd/MM/yy', 'yyyy-MM-dd']
  };

  /**
   * Détection avec fallback basé sur des patterns génériques
   */
  detect(text: string): { pmsType: string; confidence: number; matchedKeywords: string[] } {
    // Le generic adapter ne fait pas de détection, il est utilisé en fallback
    return {
      pmsType: 'generic',
      confidence: 10,
      matchedKeywords: []
    };
  }

  /**
   * Extraction avec détection de patterns génériques
   */
  extractRooms(text: string): ExtractedRoom[] {
    const rooms = super.extractRooms(text);
    
    // Essayer de détecter les patterns de date pour améliorer l'extraction
    const datePattern = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/g;
    
    for (const room of rooms) {
      if (room.originalText) {
        const dates = room.originalText.match(datePattern);
        if (dates && dates.length >= 2) {
          room.arrivalDate = dates[0];
          room.departureDate = dates[1];
        }
      }
    }

    return rooms;
  }
}
