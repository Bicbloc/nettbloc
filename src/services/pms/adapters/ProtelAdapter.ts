/**
 * Adapter pour Protel PMS
 */

import { PmsAdapter } from '../PmsAdapter';
import { PmsConfig } from '../types';

export class ProtelAdapter extends PmsAdapter {
  readonly name = 'protel';
  
  readonly keywords = [
    'PROTEL', 'PROTEL PMS', 'PROTEL HOTELSOFTWARE', 'PROTEL AIR'
  ];

  readonly config: PmsConfig = {
    pmsType: 'protel',
    keywords: this.keywords,
    roomNumberRegex: '\\b([1-9]\\d{2,4})\\b',
    statusMappings: {
      'DIRTY': { status: 'dirty', cleaning: 'full', priority: 20 },
      'CLEAN': { status: 'clean', cleaning: 'none', priority: 8 },
      'CHECKED OUT': { status: 'checkout', cleaning: 'full', priority: 20 },
      'OCCUPIED': { status: 'occupied', cleaning: 'none', priority: 5 },
      'VACANT': { status: 'vacant', cleaning: 'full', priority: 15 },
      'OUT OF ORDER': { status: 'out-of-order', cleaning: 'none', priority: 25 },
      'BLOCKED': { status: 'blocked', cleaning: 'none', priority: 25 },
    },
    combinationRules: [
      { conditions: ['CHECKED OUT', 'ARRIVAL'], result: { status: 'checkout_arrival', cleaning: 'full' } },
    ],
    dateFormats: ['dd.MM.yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd']
  };
}
