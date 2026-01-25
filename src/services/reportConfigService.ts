/**
 * Service pour gérer les configurations d'apprentissage des rapports par hôtel
 */
import { supabase } from '@/integrations/supabase/client';
import { ColumnType } from './training/ReportFormatDetector';

export interface ColumnMapping {
  columnIndex: number;
  columnName: string;
  type: ColumnType;
  enabled: boolean;
  order: number;
}

export interface StatusMapping {
  [key: string]: 'full' | 'quick' | 'none' | 'out_of_service' | 'exclude';
}

export interface ManualCorrection {
  roomNumber: string;
  field: 'guestName' | 'cleaningType' | 'status' | 'arrivalDate' | 'departureDate';
  originalValue: string;
  correctedValue: string;
  timestamp: string;
}

export interface HotelReportConfig {
  id: string;
  hotel_id: string;
  config_name: string;
  column_mappings: ColumnMapping[];
  status_mappings: StatusMapping;
  exclusion_patterns: string[];
  manual_corrections: ManualCorrection[];
  detected_format: string | null;
  last_used_at: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Charge la configuration d'un hôtel
 */
export async function loadHotelReportConfig(hotelId: string, configName = 'default'): Promise<HotelReportConfig | null> {
  const { data, error } = await supabase
    .from('hotel_report_configs')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('config_name', configName)
    .maybeSingle();

  if (error) {
    console.error('Erreur chargement config:', error);
    return null;
  }

  if (!data) return null;

  return {
    ...data,
    column_mappings: (data.column_mappings as unknown as ColumnMapping[]) || [],
    status_mappings: (data.status_mappings as unknown as StatusMapping) || {},
    manual_corrections: (data.manual_corrections as unknown as ManualCorrection[]) || [],
    exclusion_patterns: data.exclusion_patterns || [],
  };
}

/**
 * Sauvegarde ou met à jour la configuration d'un hôtel
 */
export async function saveHotelReportConfig(
  hotelId: string,
  config: Partial<Omit<HotelReportConfig, 'id' | 'hotel_id' | 'created_at' | 'updated_at'>>,
  configName = 'default'
): Promise<HotelReportConfig | null> {
  const { data: existing } = await supabase
    .from('hotel_report_configs')
    .select('id')
    .eq('hotel_id', hotelId)
    .eq('config_name', configName)
    .maybeSingle();

  const payload = {
    hotel_id: hotelId,
    config_name: configName,
    column_mappings: JSON.parse(JSON.stringify(config.column_mappings || [])),
    status_mappings: JSON.parse(JSON.stringify(config.status_mappings || {})),
    exclusion_patterns: config.exclusion_patterns || [],
    manual_corrections: JSON.parse(JSON.stringify(config.manual_corrections || [])),
    detected_format: config.detected_format,
    last_used_at: new Date().toISOString(),
    usage_count: (config.usage_count || 0) + 1,
  };

  if (existing) {
    // Update
    const { data, error } = await supabase
      .from('hotel_report_configs')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('Erreur mise à jour config:', error);
      return null;
    }

    return {
      ...data,
      column_mappings: (data.column_mappings as unknown as ColumnMapping[]) || [],
      status_mappings: (data.status_mappings as unknown as StatusMapping) || {},
      manual_corrections: (data.manual_corrections as unknown as ManualCorrection[]) || [],
      exclusion_patterns: data.exclusion_patterns || [],
    };
  } else {
    // Insert
    const { data: user } = await supabase.auth.getUser();
    
    const insertPayload = {
      ...payload,
      created_by: user?.user?.id || null,
    };

    const { data, error } = await supabase
      .from('hotel_report_configs')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('Erreur création config:', error);
      return null;
    }

    return {
      ...data,
      column_mappings: (data.column_mappings as unknown as ColumnMapping[]) || [],
      status_mappings: (data.status_mappings as unknown as StatusMapping) || {},
      manual_corrections: (data.manual_corrections as unknown as ManualCorrection[]) || [],
      exclusion_patterns: data.exclusion_patterns || [],
    };
  }
}

/**
 * Ajoute une correction manuelle à la configuration
 */
export async function addManualCorrection(
  hotelId: string,
  correction: ManualCorrection,
  configName = 'default'
): Promise<boolean> {
  const config = await loadHotelReportConfig(hotelId, configName);
  
  if (!config) {
    // Créer une nouvelle config avec la correction
    const result = await saveHotelReportConfig(hotelId, {
      manual_corrections: [correction],
    }, configName);
    return result !== null;
  }

  // Ajouter la correction à la liste existante
  const existingCorrections = config.manual_corrections || [];
  
  // Éviter les doublons
  const filtered = existingCorrections.filter(
    c => !(c.roomNumber === correction.roomNumber && c.field === correction.field)
  );
  
  const result = await saveHotelReportConfig(hotelId, {
    ...config,
    manual_corrections: [...filtered, correction],
  }, configName);

  return result !== null;
}

/**
 * Applique les corrections manuelles aux données parsées
 */
export function applyManualCorrections<T extends { roomNumber: string; guestName?: string; cleaningType?: string }>(
  rows: T[],
  corrections: ManualCorrection[]
): T[] {
  if (!corrections || corrections.length === 0) return rows;

  return rows.map(row => {
    const roomCorrections = corrections.filter(c => c.roomNumber === row.roomNumber);
    
    if (roomCorrections.length === 0) return row;

    const correctedRow = { ...row };
    
    for (const correction of roomCorrections) {
      if (correction.field === 'guestName' && 'guestName' in correctedRow) {
        (correctedRow as any).guestName = correction.correctedValue;
      } else if (correction.field === 'cleaningType' && 'cleaningType' in correctedRow) {
        (correctedRow as any).cleaningType = correction.correctedValue;
      }
    }

    return correctedRow;
  });
}

/**
 * Vérifie si une ligne doit être exclue
 */
export function shouldExcludeLine(line: string, exclusionPatterns: string[]): boolean {
  if (!exclusionPatterns || exclusionPatterns.length === 0) return false;
  
  const lowerLine = line.toLowerCase();
  return exclusionPatterns.some(pattern => 
    lowerLine.includes(pattern.toLowerCase())
  );
}

/**
 * Applique le mapping de statuts personnalisé
 */
export function applyStatusMapping(
  status: string,
  statusMappings: StatusMapping
): 'full' | 'quick' | 'none' | 'out_of_service' | 'exclude' | null {
  if (!statusMappings || Object.keys(statusMappings).length === 0) return null;
  
  const upperStatus = status.toUpperCase();
  return statusMappings[upperStatus] || null;
}
