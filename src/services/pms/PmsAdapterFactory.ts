/**
 * Factory pour créer et gérer les adapters PMS
 */

import { PmsAdapter } from './PmsAdapter';
import { PmsDetectionResult } from './types';
import {
  ApaleoAdapter,
  MewsAdapter,
  OperaAdapter,
  ProtelAdapter,
  MedialogAdapter,
  FidelioAdapter,
  GenericAdapter
} from './adapters';

class PmsAdapterFactory {
  private adapters: Map<string, PmsAdapter> = new Map();

  constructor() {
    // Enregistrer tous les adapters disponibles
    this.registerAdapter(new ApaleoAdapter());
    this.registerAdapter(new MewsAdapter());
    this.registerAdapter(new OperaAdapter());
    this.registerAdapter(new ProtelAdapter());
    this.registerAdapter(new MedialogAdapter());
    this.registerAdapter(new FidelioAdapter());
    this.registerAdapter(new GenericAdapter());
  }

  /**
   * Enregistre un adapter
   */
  registerAdapter(adapter: PmsAdapter): void {
    this.adapters.set(adapter.name.toLowerCase(), adapter);
  }

  /**
   * Récupère un adapter par son nom
   */
  getAdapter(pmsType: string): PmsAdapter {
    const adapter = this.adapters.get(pmsType.toLowerCase());
    if (adapter) return adapter;
    
    // Fallback sur l'adapter générique
    return this.adapters.get('generic')!;
  }

  /**
   * Détecte le PMS à partir du texte du rapport
   * Retourne l'adapter avec la meilleure correspondance
   */
  detectPms(text: string): { adapter: PmsAdapter; detection: PmsDetectionResult } {
    let bestAdapter: PmsAdapter = this.adapters.get('generic')!;
    let bestDetection: PmsDetectionResult = { pmsType: 'generic', confidence: 0, matchedKeywords: [] };

    for (const [name, adapter] of this.adapters) {
      if (name === 'generic') continue;
      
      const detection = adapter.detect(text);
      
      if (detection.confidence > bestDetection.confidence) {
        bestDetection = detection;
        bestAdapter = adapter;
      }
    }

    console.log(`🔍 PMS détecté: ${bestDetection.pmsType} (confiance: ${bestDetection.confidence.toFixed(1)}%)`);
    console.log(`   Mots-clés: ${bestDetection.matchedKeywords.join(', ') || 'aucun'}`);

    return { adapter: bestAdapter, detection: bestDetection };
  }

  /**
   * Liste tous les types de PMS disponibles
   */
  getAvailablePmsTypes(): string[] {
    return Array.from(this.adapters.keys()).filter(k => k !== 'generic');
  }

  /**
   * Récupère la configuration d'un adapter
   */
  getAdapterConfig(pmsType: string) {
    const adapter = this.getAdapter(pmsType);
    return adapter.config;
  }
}

// Singleton
export const pmsAdapterFactory = new PmsAdapterFactory();
