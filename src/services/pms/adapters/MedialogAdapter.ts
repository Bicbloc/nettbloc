/**
 * Adapter pour Medialog PMS
 */

import { PmsAdapter } from '../PmsAdapter';
import { PmsConfig } from '../types';

export class MedialogAdapter extends PmsAdapter {
  readonly name = 'medialog';
  
  readonly keywords = [
    'MEDIALOG', 'PLANNING MENAGE', 'PLANNING MÉNAGE', 'DRAPS', 'À BLANC',
    'L\'état des chambres', 'état des chambres', 'ETAT', 'MEMO GOUVERNANTE',
    'Solutions digitales hôtelières'
  ];

  readonly config: PmsConfig = {
    pmsType: 'medialog',
    keywords: this.keywords,
    roomNumberRegex: '\\b([1-9]\\d{0,3})\\b',
    statusMappings: {
      // Départs
      'PARTI': { status: 'checkout', cleaning: 'full', priority: 22 },
      'DEPART': { status: 'checkout', cleaning: 'full', priority: 22 },
      'DÉPART': { status: 'checkout', cleaning: 'full', priority: 22 },
      
      // Recouche / Draps
      'RECOUCHE': { status: 'stayover', cleaning: 'quick', priority: 15 },
      'DRAPS': { status: 'stayover', cleaning: 'quick', priority: 14 },
      
      // À blanc / Sale
      'À BLANC': { status: 'dirty', cleaning: 'full', priority: 20 },
      'A BLANC': { status: 'dirty', cleaning: 'full', priority: 20 },
      'BLANC': { status: 'dirty', cleaning: 'full', priority: 18 },
      'SALE': { status: 'dirty', cleaning: 'full', priority: 18 },
      
      // Ne pas nettoyer / Occupé
      'NE PAS NETTOYER': { status: 'occupied', cleaning: 'none', priority: 5 },
      'NO SERVICE': { status: 'occupied', cleaning: 'none', priority: 5 },
      
      // À vérifier
      'A VERIFIER': { status: 'needs-inspection', cleaning: 'none', priority: 6 },
      'À VÉRIFIER': { status: 'needs-inspection', cleaning: 'none', priority: 6 },
    },
    combinationRules: [
      { conditions: ['DEPART', 'ARRIVEE'], result: { status: 'checkout_arrival', cleaning: 'full' } },
      { conditions: ['PARTI', 'ARRIVEE'], result: { status: 'checkout_arrival', cleaning: 'full' } },
    ],
    dateFormats: ['dd/MM/yyyy', 'dd/MM/yy']
  };
}
