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
    // Regex améliorée: supporte 01-09 et chambres à 3-4 chiffres
    roomNumberRegex: '(?<![\\d])([0-9]{1,4}[A-Z]?)(?![\\d])',
    statusMappings: {
      'DIRTY': { status: 'dirty', cleaning: 'a_blanc', priority: 20 },
      'CLEAN': { status: 'clean', cleaning: 'none', priority: 8 },
      'INSPECTED': { status: 'inspected', cleaning: 'none', priority: 7 },
      'OUT OF ORDER': { status: 'out-of-order', cleaning: 'none', priority: 25 },
      'OOO': { status: 'out-of-order', cleaning: 'none', priority: 25 },
      'PICKUP': { status: 'stayover', cleaning: 'recouche', priority: 10 },
      'VACANT': { status: 'vacant', cleaning: 'a_blanc', priority: 15 },
      'OCCUPIED': { status: 'occupied', cleaning: 'none', priority: 5 },
      'DUE OUT': { status: 'checkout', cleaning: 'a_blanc', priority: 20 },
      'CHECKOUT': { status: 'checkout', cleaning: 'a_blanc', priority: 20 },
      'CO': { status: 'checkout', cleaning: 'a_blanc', priority: 20 },
      'DUE IN': { status: 'arrival', cleaning: 'a_blanc', priority: 15 },
      'CHECKIN': { status: 'arrival', cleaning: 'a_blanc', priority: 15 },
      'CI': { status: 'arrival', cleaning: 'a_blanc', priority: 15 },
      'VC': { status: 'clean', cleaning: 'none', priority: 9 },
      'VD': { status: 'dirty', cleaning: 'a_blanc', priority: 20 },
      'OC': { status: 'occupied', cleaning: 'none', priority: 5 },
      'OD': { status: 'stayover', cleaning: 'recouche', priority: 10 },
    },
    combinationRules: [
      // Départ + Arrivée = À blanc
      { conditions: ['DUE OUT', 'DUE IN'], result: { status: 'checkout_arrival', cleaning: 'a_blanc' } },
      { conditions: ['CHECKOUT', 'CHECKIN'], result: { status: 'checkout_arrival', cleaning: 'a_blanc' } },
      { conditions: ['CO', 'CI'], result: { status: 'checkout_arrival', cleaning: 'a_blanc' } },
      // Vacant + Clean = Pas de nettoyage
      { conditions: ['VACANT', 'CLEAN'], result: { status: 'ready', cleaning: 'none' } },
      { conditions: ['VC', 'ARRIVAL'], result: { status: 'ready', cleaning: 'none' } },
    ],
    dateFormats: ['dd-MMM-yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd', 'dd MMM yyyy']
  };
}
