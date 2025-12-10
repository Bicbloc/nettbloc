/**
 * Module PMS unifié
 * Point d'entrée principal pour le parsing des rapports PMS
 */

export * from './types';
export { PmsAdapter } from './PmsAdapter';
export { pmsAdapterFactory } from './PmsAdapterFactory';
export { unifiedParserService } from './UnifiedParserService';
export * from './adapters';

// Export des services de compatibilité pour les composants legacy
export {
  mewsDetectionService,
  smartExtractionService,
  patternLearningService,
  type DetectionRule,
  type PmsMatchResult,
  type ReservationBlock,
  type AnalysisResult,
  type PmsPattern
} from './compat';
