/**
 * Adapter pour Medialog PMS
 */

import { PmsAdapter } from '../PmsAdapter';
import { PmsConfig } from '../types';

export class MedialogAdapter extends PmsAdapter {
  readonly name = 'medialog';
  
  readonly keywords = [
    'MEDIALOG', 'PLANNING MENAGE', 'PLANNING MÉNAGE', 'DRAPS', 'À BLANC'
  ];

  readonly config: PmsConfig = {
    pmsType: 'medialog',
    keywords: this.keywords,
    roomNumberRegex: '\\b([1-9]\\d{1,3})\\b',
    statusMappings: {
      'DRAPS': { status: 'change-sheets', cleaning: 'full', priority: 18 },
      'RECOUCHE': { status: 'stayover', cleaning: 'quick', priority: 10 },
      'BLANC': { status: 'dirty', cleaning: 'full', priority: 20 },
      'À BLANC': { status: 'dirty', cleaning: 'full', priority: 20 },
      'A BLANC': { status: 'dirty', cleaning: 'full', priority: 20 },
      'NE PAS NETTOYER': { status: 'occupied', cleaning: 'none', priority: 5 },
      'DEPART': { status: 'checkout', cleaning: 'full', priority: 20 },
      'DÉPART': { status: 'checkout', cleaning: 'full', priority: 20 },
    },
    combinationRules: [
      { conditions: ['DEPART', 'ARRIVEE'], result: { status: 'checkout_arrival', cleaning: 'full' } },
    ],
    dateFormats: ['dd/MM/yyyy', 'dd/MM/yy']
  };
}
