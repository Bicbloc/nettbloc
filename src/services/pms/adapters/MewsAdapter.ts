/**
 * Adapter pour Mews PMS
 */

import { PmsAdapter } from '../PmsAdapter';
import { PmsConfig, ExtractedRoom, CleaningType } from '../types';

export class MewsAdapter extends PmsAdapter {
  readonly name = 'mews';
  
  readonly criticalKeywords = ['MEWS', 'MEWS COMMANDER', 'MEWS SYSTEMS'];
  
  readonly keywords = [
    'COMMANDER', 'STATUT DES ESPACES', 'SPACE STATUS', 'DIR', 'INS', 'SAL', 'Night', 'Nuit'
  ];

  readonly config: PmsConfig = {
    pmsType: 'mews',
    keywords: this.keywords,
    // Regex améliorée: supporte 01-09 et formats alphanumériques
    roomNumberRegex: '(?<![\\d])([0-9]{1,4}[A-Z]?|[A-Z][0-9]{1,4})(?![\\d])',
    statusMappings: {
      // Statuts anglais - utilise a_blanc/recouche
      'Dirty': { status: 'dirty', cleaning: 'a_blanc', priority: 20 },
      'Clean': { status: 'clean', cleaning: 'none', priority: 8 },
      'Inspected': { status: 'inspected', cleaning: 'none', priority: 7 },
      'Out of Service': { status: 'out-of-order', cleaning: 'none', priority: 25 },
      'Out of order': { status: 'out-of-order', cleaning: 'none', priority: 25 },
      'OOO': { status: 'out-of-order', cleaning: 'none', priority: 25 },
      'Occupied Clean': { status: 'occupied', cleaning: 'none', priority: 5 },
      'Occupied Dirty': { status: 'occupied', cleaning: 'recouche', priority: 10 },
      
      // Statuts français/Mews abréviations
      'SAL': { status: 'dirty', cleaning: 'a_blanc', priority: 20 },
      'SALE': { status: 'dirty', cleaning: 'a_blanc', priority: 20 },
      'INS': { status: 'clean', cleaning: 'none', priority: 8 },
      'DIR': { status: 'dirty', cleaning: 'a_blanc', priority: 20 },
      'DEP': { status: 'checkout', cleaning: 'a_blanc', priority: 22 },
      'ARR': { status: 'arrival', cleaning: 'a_blanc', priority: 18 },
      'COC': { status: 'occupied', cleaning: 'none', priority: 5 },
      'CLA': { status: 'clean', cleaning: 'none', priority: 8 },
      'VAC': { status: 'vacant', cleaning: 'none', priority: 6 },
      
      // Termes complets français
      'PARTI': { status: 'checkout', cleaning: 'a_blanc', priority: 22 },
      'DEPART': { status: 'checkout', cleaning: 'a_blanc', priority: 22 },
      'RECOUCHE': { status: 'stayover', cleaning: 'recouche', priority: 15 },
    },
    combinationRules: [
      // Départ + Arrivée même ligne = À blanc
      { conditions: ['DIR', 'ARR'], result: { status: 'checkout_arrival', cleaning: 'a_blanc' } },
      { conditions: ['DEP', 'ARR'], result: { status: 'checkout_arrival', cleaning: 'a_blanc' } },
      // INS avec arrivée = Propre
      { conditions: ['INS', 'ARR'], result: { status: 'ready', cleaning: 'none' } },
      // VAC + INS = Propre
      { conditions: ['VAC', 'INS'], result: { status: 'clean', cleaning: 'none' } },
    ],
    dateFormats: ['dd/MM/yyyy', 'yyyy-MM-dd', 'dd.MM.yyyy']
  };

  /**
   * Extraction spécifique pour Mews avec détection Nuit X/Y
   */
  extractRooms(text: string): ExtractedRoom[] {
    const rooms = super.extractRooms(text);
    
    // Pattern Nuit X/Y pour détecter les recouches
    const nightPattern = /Nuit\s*(\d+)\s*[\/\\]\s*(\d+)/gi;
    const lines = text.split('\n');
    
    for (const room of rooms) {
      // Chercher dans le contexte de la chambre
      const roomContext = lines.find(l => l.includes(room.roomNumber));
      if (!roomContext) continue;
      
      const nightMatch = nightPattern.exec(roomContext);
      if (nightMatch) {
        const [, currentNight, totalNights] = nightMatch;
        const current = parseInt(currentNight, 10);
        
      // Nuit > 1 = client qui reste = recouche
      if (current > 1 && room.cleaningType !== 'a_blanc' && room.cleaningType !== 'full') {
        room.cleaningType = 'recouche';
        room.status = 'stayover';
      }
      // Nuit 1 = arrivée
      else if (current === 1) {
        room.cleaningType = 'a_blanc';
        room.status = 'arrival';
      }
      }
    }

    return rooms;
  }
}
