/**
 * Adapter pour Oracle Opera PMS
 */

import { PmsAdapter } from '../PmsAdapter';
import { PmsConfig } from '../types';

export class OperaAdapter extends PmsAdapter {
  readonly name = 'opera';
  
  readonly criticalKeywords = ['OPERA', 'ORACLE HOSPITALITY', 'OPERA CLOUD'];
  
  readonly keywords = [
    'MICROS', 'OPERA PMS', 'DUE OUT', 'PICKUP', 'VACANT'
  ];

  readonly config: PmsConfig = {
    pmsType: 'opera',
    keywords: this.keywords,
    roomNumberRegex: '\\b([1-9]\\d{2,4})\\b',
    statusMappings: {
      'DIRTY': { status: 'dirty', cleaning: 'full', priority: 20 },
      'CLEAN': { status: 'clean', cleaning: 'none', priority: 8 },
      'INSPECTED': { status: 'inspected', cleaning: 'none', priority: 7 },
      'OUT OF ORDER': { status: 'out-of-order', cleaning: 'none', priority: 25 },
      'OOO': { status: 'out-of-order', cleaning: 'none', priority: 25 },
      'PICKUP': { status: 'stayover', cleaning: 'quick', priority: 10 },
      'VACANT': { status: 'vacant', cleaning: 'full', priority: 15 },
      'OCCUPIED': { status: 'occupied', cleaning: 'none', priority: 5 },
      'DUE OUT': { status: 'checkout', cleaning: 'full', priority: 20 },
      'CHECKOUT': { status: 'checkout', cleaning: 'full', priority: 20 },
      'DUE IN': { status: 'arrival', cleaning: 'full', priority: 15 },
      'CHECKIN': { status: 'arrival', cleaning: 'full', priority: 15 },
    },
    combinationRules: [
      // Départ + Arrivée = À blanc
      { conditions: ['DUE OUT', 'DUE IN'], result: { status: 'checkout_arrival', cleaning: 'full' } },
      { conditions: ['CHECKOUT', 'CHECKIN'], result: { status: 'checkout_arrival', cleaning: 'full' } },
      // Vacant + Clean = Pas de nettoyage
      { conditions: ['VACANT', 'CLEAN'], result: { status: 'ready', cleaning: 'none' } },
    ],
    dateFormats: ['dd-MMM-yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd', 'dd MMM yyyy']
  };
}
