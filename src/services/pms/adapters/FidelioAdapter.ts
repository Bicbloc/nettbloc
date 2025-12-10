/**
 * Adapter pour Fidelio PMS (Oracle/Micros)
 */

import { PmsAdapter } from '../PmsAdapter';
import { PmsConfig } from '../types';

export class FidelioAdapter extends PmsAdapter {
  readonly name = 'fidelio';
  
  readonly keywords = [
    'FIDELIO', 'FIDELIO SUITE 8', 'FIDELIO V8'
  ];

  readonly config: PmsConfig = {
    pmsType: 'fidelio',
    keywords: this.keywords,
    roomNumberRegex: '\\b([1-9]\\d{2,4})\\b',
    statusMappings: {
      'DRT': { status: 'dirty', cleaning: 'full', priority: 20 },
      'CLN': { status: 'clean', cleaning: 'none', priority: 8 },
      'INS': { status: 'inspected', cleaning: 'none', priority: 7 },
      'OOO': { status: 'out-of-order', cleaning: 'none', priority: 25 },
      'OCC': { status: 'occupied', cleaning: 'none', priority: 5 },
      'VAC': { status: 'vacant', cleaning: 'full', priority: 15 },
      'DEP': { status: 'checkout', cleaning: 'full', priority: 20 },
    },
    combinationRules: [
      { conditions: ['DEP', 'ARR'], result: { status: 'checkout_arrival', cleaning: 'full' } },
    ],
    dateFormats: ['dd-MMM-yy', 'dd/MM/yy', 'ddMMMyy']
  };
}
