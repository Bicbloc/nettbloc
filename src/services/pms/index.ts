/**
 * Module PMS unifié
 * Point d'entrée principal pour le parsing des rapports PMS
 */

// Types
export * from './types';

// Services principaux
export { PmsAdapter } from './PmsAdapter';
export { pmsAdapterFactory } from './PmsAdapterFactory';
export { unifiedParserService } from './UnifiedParserService';

// Nouveaux services optimisés
export { textPreprocessor } from './TextPreprocessor';
export { roomValidator } from './RoomValidator';
export { detectionCache } from './DetectionCache';

// Adapters
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
