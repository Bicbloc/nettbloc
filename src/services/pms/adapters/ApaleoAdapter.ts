/**
 * Adapter pour Apaleo PMS
 */

import { PmsAdapter } from '../PmsAdapter';
import { PmsConfig, ExtractedRoom, CleaningType } from '../types';

export class ApaleoAdapter extends PmsAdapter {
  readonly name = 'apaleo';
  
  readonly keywords = [
    'APALEO', 'CLOUD PMS', 'HOUSEKEEPING REPORT',
    'Recouche', 'Parti', 'En arrivée', 'Arrivé', 'A contrôler', 'Propre'
  ];

  readonly config: PmsConfig = {
    pmsType: 'apaleo',
    keywords: this.keywords,
    roomNumberRegex: '\\b(0?[1-9]\\d{0,4}|[1-9]\\d{1,4})\\b',
    statusMappings: {
      'RECOUCHE': { status: 'stayover', cleaning: 'quick', priority: 10 },
      'Recouche': { status: 'stayover', cleaning: 'quick', priority: 10 },
      'PARTI': { status: 'checkout', cleaning: 'full', priority: 20 },
      'Parti': { status: 'checkout', cleaning: 'full', priority: 20 },
      'DEPART': { status: 'checkout', cleaning: 'full', priority: 20 },
      'DEPARTURE': { status: 'checkout', cleaning: 'full', priority: 20 },
      'CHECKOUT': { status: 'checkout', cleaning: 'full', priority: 20 },
      'EN ARRIVEE': { status: 'arrival', cleaning: 'full', priority: 15 },
      'EN ARRIVÉE': { status: 'arrival', cleaning: 'full', priority: 15 },
      'ARRIVAL': { status: 'arrival', cleaning: 'full', priority: 15 },
      'ARRIVEE': { status: 'arrival', cleaning: 'full', priority: 15 },
      'ARRIVÉ': { status: 'occupied', cleaning: 'none', priority: 5 },
      'ARRIVE': { status: 'occupied', cleaning: 'none', priority: 5 },
      'A CONTROLER': { status: 'clean', cleaning: 'none', priority: 8 },
      'CONTROLER': { status: 'clean', cleaning: 'none', priority: 8 },
      'PROPRE': { status: 'clean', cleaning: 'none', priority: 8 },
      'CLEAN': { status: 'clean', cleaning: 'none', priority: 8 },
      'DIR': { status: 'dirty', cleaning: 'full', priority: 18 },
      'DIRTY': { status: 'dirty', cleaning: 'full', priority: 18 },
      'SALE': { status: 'dirty', cleaning: 'full', priority: 18 },
      'INS': { status: 'inspected', cleaning: 'none', priority: 7 },
      'INSPECTED': { status: 'inspected', cleaning: 'none', priority: 7 },
      'OCC': { status: 'occupied', cleaning: 'none', priority: 5 },
      'OCCUPIED': { status: 'occupied', cleaning: 'none', priority: 5 },
    },
    combinationRules: [
      // Départ + Arrivée = À blanc
      { conditions: ['checkout', 'arrival'], result: { status: 'checkout_arrival', cleaning: 'full' } },
      { conditions: ['PARTI', 'EN ARRIVEE'], result: { status: 'checkout_arrival', cleaning: 'full' } },
      { conditions: ['DEPART', 'ARRIVEE'], result: { status: 'checkout_arrival', cleaning: 'full' } },
      // Arrivée + À contrôler = Propre
      { conditions: ['arrival', 'clean'], result: { status: 'clean', cleaning: 'none' } },
      { conditions: ['EN ARRIVEE', 'A CONTROLER'], result: { status: 'clean', cleaning: 'none' } },
    ],
    dateFormats: ['dd/MM/yyyy', 'dd/MM/yy', 'dd.MM.yyyy', 'dd-MM-yyyy']
  };

  /**
   * Extraction spécifique pour Apaleo avec gestion des chambres communicantes
   */
  extractRooms(text: string): ExtractedRoom[] {
    const rooms = super.extractRooms(text);
    
    // Détecter les chambres communicantes
    const connectedPatterns = [
      /(\d{2,4})\s*[-–—]\s*(\d{2,4})/g,
      /(\d{2,4})\s*[+&]\s*(\d{2,4})/g,
      /(\d{2,4})\s*\/\s*(\d{2,4})/g,
      /(\d{2,4})\s*et\s*(\d{2,4})/gi,
    ];

    for (const pattern of connectedPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const [, room1, room2] = match;
        
        // Marquer les chambres comme connectées
        const r1 = rooms.find(r => r.roomNumber === room1);
        const r2 = rooms.find(r => r.roomNumber === room2);
        
        if (r1) {
          r1.isConnected = true;
          r1.linkedRooms = [...(r1.linkedRooms || []), room2];
        }
        if (r2) {
          r2.isConnected = true;
          r2.linkedRooms = [...(r2.linkedRooms || []), room1];
        }
      }
    }

    return rooms;
  }
}
