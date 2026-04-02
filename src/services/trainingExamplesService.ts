/**
 * Service pour gérer les exemples d'entraînement IA par hôtel
 * Stocke les exemples dans hotel_report_configs.manual_corrections
 * et les convertit au format attendu par l'edge function parse-report
 */
import { supabase } from '@/integrations/supabase/client';
import { loadHotelReportConfig, saveHotelReportConfig } from './reportConfigService';

export interface TrainingExample {
  roomNumber: string;
  cleaningType: 'a_blanc' | 'recouche' | 'none';
  reason: string;
  pattern?: string;
}

/**
 * Charge les exemples d'entraînement d'un hôtel
 */
export async function loadTrainingExamples(hotelId: string): Promise<TrainingExample[]> {
  const config = await loadHotelReportConfig(hotelId, 'ai-training');
  if (!config) return [];

  // Les exemples sont stockés dans manual_corrections avec field='cleaningType'
  return (config.manual_corrections || [])
    .filter(c => c.field === 'cleaningType')
    .map(c => ({
      roomNumber: c.roomNumber,
      cleaningType: c.correctedValue as 'a_blanc' | 'recouche' | 'none',
      reason: c.originalValue || '',
    }));
}

/**
 * Sauvegarde des exemples d'entraînement pour un hôtel
 */
export async function saveTrainingExamples(
  hotelId: string,
  examples: TrainingExample[]
): Promise<boolean> {
  const corrections = examples.map(ex => ({
    roomNumber: ex.roomNumber,
    field: 'cleaningType' as const,
    originalValue: ex.reason,
    correctedValue: ex.cleaningType,
    timestamp: new Date().toISOString(),
  }));

  const result = await saveHotelReportConfig(hotelId, {
    manual_corrections: corrections,
    detected_format: 'ai-training',
  }, 'ai-training');

  return result !== null;
}

/**
 * Ajoute un exemple d'entraînement
 */
export async function addTrainingExample(
  hotelId: string,
  example: TrainingExample
): Promise<boolean> {
  const existing = await loadTrainingExamples(hotelId);
  
  // Remplacer si même chambre existe déjà
  const filtered = existing.filter(e => e.roomNumber !== example.roomNumber);
  filtered.push(example);

  return saveTrainingExamples(hotelId, filtered);
}

/**
 * Supprime un exemple d'entraînement
 */
export async function removeTrainingExample(
  hotelId: string,
  roomNumber: string
): Promise<boolean> {
  const existing = await loadTrainingExamples(hotelId);
  const filtered = existing.filter(e => e.roomNumber !== roomNumber);
  return saveTrainingExamples(hotelId, filtered);
}
