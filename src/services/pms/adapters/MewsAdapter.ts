/**
 * Adapter pour Mews PMS
 */

import { PmsAdapter } from '../PmsAdapter';
import { PmsConfig, ExtractedRoom, CleaningType } from '../types';

export class MewsAdapter extends PmsAdapter {
  readonly name = 'mews';
  
  readonly keywords = [
    'MEWS', 'COMMANDER', 'MEWS SYSTEMS', 'MEWS COMMANDER', 
    'STATUT DES ESPACES', 'SPACE STATUS', 'DIR', 'INS', 'SAL', 'Night', 'Nuit'
  ];

  readonly config: PmsConfig = {
    pmsType: 'mews',
    keywords: this.keywords,
    roomNumberRegex: '\\b([1-9]\\d{1,3})\\b',
    statusMappings: {
      // Statuts anglais
      'Dirty': { status: 'dirty', cleaning: 'full', priority: 20 },
      'Clean': { status: 'clean', cleaning: 'none', priority: 8 },
      'Inspected': { status: 'inspected', cleaning: 'none', priority: 7 },
      'Out of Service': { status: 'out-of-order', cleaning: 'none', priority: 25 },
      'Out of order': { status: 'out-of-order', cleaning: 'none', priority: 25 },
      'OOO': { status: 'out-of-order', cleaning: 'none', priority: 25 },
      'Occupied Clean': { status: 'occupied', cleaning: 'none', priority: 5 },
      'Occupied Dirty': { status: 'occupied', cleaning: 'quick', priority: 10 },
      
      // Statuts français/Mews abréviations
      'SAL': { status: 'dirty', cleaning: 'full', priority: 20 },  // SALE = dirty
      'SALE': { status: 'dirty', cleaning: 'full', priority: 20 },
      'INS': { status: 'clean', cleaning: 'none', priority: 8 },   // Inspecté = propre
      'DIR': { status: 'dirty', cleaning: 'full', priority: 20 },  // Dirty
      'DEP': { status: 'checkout', cleaning: 'full', priority: 22 },
      'ARR': { status: 'arrival', cleaning: 'full', priority: 18 },
      'COC': { status: 'occupied', cleaning: 'none', priority: 5 },
      'CLA': { status: 'clean', cleaning: 'none', priority: 8 },
      'VAC': { status: 'vacant', cleaning: 'none', priority: 6 },
      
      // Termes complets français
      'PARTI': { status: 'checkout', cleaning: 'full', priority: 22 },
      'DEPART': { status: 'checkout', cleaning: 'full', priority: 22 },
      'RECOUCHE': { status: 'stayover', cleaning: 'quick', priority: 15 },
    },
    combinationRules: [
      // Départ + Arrivée même ligne = À blanc
      { conditions: ['DIR', 'ARR'], result: { status: 'checkout_arrival', cleaning: 'full' } },
      { conditions: ['DEP', 'ARR'], result: { status: 'checkout_arrival', cleaning: 'full' } },
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
        if (current > 1 && room.cleaningType !== 'full') {
          room.cleaningType = 'quick';
          room.status = 'stayover';
        }
        // Nuit 1 = arrivée
        else if (current === 1) {
          room.cleaningType = 'full';
          room.status = 'arrival';
        }
      }
    }

    return rooms;
  }
}
