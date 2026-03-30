import { supabase } from "@/integrations/supabase/client";

/**
 * Normalise un numéro de chambre pour la comparaison
 * Supprime les zéros initiaux sauf si le numéro est uniquement "0"
 * "05" → "5", "01" → "1", "10" → "10", "101" → "101"
 */
export function normalizeRoomNumber(roomNumber: string): string {
  if (!roomNumber) return '';
  const trimmed = roomNumber.trim();
  // Supprime les zéros initiaux
  const normalized = trimmed.replace(/^0+/, '') || '0';
  return normalized;
}

/**
 * Compare deux numéros de chambre de manière normalisée
 */
export function roomNumbersMatch(room1: string, room2: string): boolean {
  return normalizeRoomNumber(room1) === normalizeRoomNumber(room2);
}

export interface RoomFormatConfig {
  format: string; // 'XXX', '0X', 'XXXX', 'NN', etc.
  regex: RegExp;
  minLength: number;
  maxLength: number;
  statusKeywords?: string[]; // Apaleo keywords like "Recouche", "Parti"
}

/**
 * Load the learned room format for a hotel from report_training_patterns
 * Loads patterns where:
 * 1. hotel_id = hotelId (created by this hotel)
 * 2. assigned_to_hotel_id = hotelId (assigned to this hotel)
 */
export async function loadHotelRoomFormat(hotelId: string): Promise<RoomFormatConfig | null> {
  try {
    // Check report_training_patterns for learned format
    // Look for patterns created by this hotel OR assigned to this hotel
    const { data: patterns } = await supabase
      .from('report_training_patterns')
      .select('extracted_data, detection_rules, pms_type')
      .or(`hotel_id.eq.${hotelId},assigned_to_hotel_id.eq.${hotelId}`)
      .eq('validated', true)
      .order('updated_at', { ascending: false })
      .limit(1);
    
    if (patterns && patterns.length > 0) {
      const pattern = patterns[0];
      
      // Try to get room format from detection_rules first, then extracted_data
      let roomFormat: string | null = null;
      let statusKeywords: string[] | undefined = undefined;
      
      const detectionRules = pattern.detection_rules as Record<string, any> | null;
      const extractedData = pattern.extracted_data as Record<string, any> | null;
      
      if (detectionRules?.roomFormat) {
        roomFormat = detectionRules.roomFormat;
      } else if (extractedData?.patterns?.roomFormat) {
        roomFormat = extractedData.patterns.roomFormat;
      }
      
      // Load status keywords from detection_rules (for Apaleo)
      if (detectionRules?.statusKeywords && Array.isArray(detectionRules.statusKeywords)) {
        statusKeywords = detectionRules.statusKeywords;
      }
      
      if (roomFormat) {
        const config = getRoomFormatConfig(roomFormat);
        config.statusKeywords = statusKeywords;
        return config;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Erreur chargement format chambre:', error);
    return null;
  }
}

/**
 * Get the room format configuration based on the format string
 */
export function getRoomFormatConfig(format: string): RoomFormatConfig {
  // Format NN: all 2-digit numbers (01-99) - used by Apaleo
  if (format === 'NN' || format === '00') {
    return {
      format: 'NN',
      regex: /\b(0[1-9]|[1-9]\d?)\b/g,  // 01-09 AND 10-99
      minLength: 1,
      maxLength: 2
    };
  }
  
  // Format 0X: 2 digits starting with 0 (01, 02, ..., 09)
  if (format === '0X' || format.match(/^0[1-9]$/)) {
    return {
      format: '0X',
      regex: /\b(0[1-9])\b/g,
      minLength: 2,
      maxLength: 2
    };
  }
  
  // Format XX: 2 digits (10-99)
  if (format === 'XX' || format.match(/^[1-9][0-9]$/)) {
    return {
      format: 'XX',
      regex: /\b([1-9][0-9])\b/g,
      minLength: 2,
      maxLength: 2
    };
  }
  
  // Format XXX: 3 digits starting with 1-9 (101-999)
  if (format === 'XXX' || format.match(/^[1-9][0-9]{2}$/)) {
    return {
      format: 'XXX',
      regex: /\b([1-9]\d{2})\b/g,
      minLength: 3,
      maxLength: 3
    };
  }
  
  // Format XXXX: 4 digits (1000-9999)
  if (format === 'XXXX' || format.match(/^[1-9][0-9]{3}$/)) {
    return {
      format: 'XXXX',
      regex: /\b([1-9]\d{3})\b/g,
      minLength: 4,
      maxLength: 4
    };
  }
  
  // Default: accept 3-5 digit room numbers (most common in hotels)
  return {
    format: 'default',
    regex: /\b([1-9]\d{2,4})\b/g,
    minLength: 3,
    maxLength: 5
  };
}

/**
 * Check if a room number matches the expected format
 */
export function isValidRoomNumber(roomNumber: string, formatConfig: RoomFormatConfig | null): boolean {
  if (!formatConfig) {
    // No format defined, accept any 2-5 digit number
    return /^\d{2,5}$/.test(roomNumber);
  }
  
  // Create a fresh regex for single match testing
  const testRegex = new RegExp(`^${formatConfig.regex.source.replace(/^\\b|\\b$/g, '')}$`);
  return testRegex.test(roomNumber);
}

/**
 * Filter rooms based on the learned format
 */
export function filterRoomsByFormat(
  rooms: any[], 
  formatConfig: RoomFormatConfig | null, 
  registryNumbers?: Set<string>
): any[] {
  if (!formatConfig) {
    return rooms;
  }
  
  const filteredRooms = rooms.filter(room => {
    const roomNumber = room.roomNumber || room.room_number || room.number;
    if (!roomNumber) return false;
    
    // If room exists in the registry, always accept it (handles 2-digit rooms like "14")
    if (registryNumbers && registryNumbers.has(normalizeRoomNumber(roomNumber))) {
      return true;
    }
    
    const isValid = isValidRoomNumber(roomNumber, formatConfig);
    return isValid;
  });
  
  return filteredRooms;
}

/**
 * Get inactive rooms from the registry
 */
export async function getInactiveRoomNumbers(hotelId: string): Promise<Set<string>> {
  try {
    const { data: inactiveRooms } = await supabase
      .from('hotel_rooms_registry')
      .select('room_number')
      .eq('hotel_id', hotelId)
      .eq('is_active', false);
    
    const inactiveSet = new Set<string>();
    if (inactiveRooms) {
      inactiveRooms.forEach(r => inactiveSet.add(r.room_number));
    }
    
    return inactiveSet;
  } catch (error) {
    console.error('Erreur chargement chambres inactives:', error);
    return new Set();
  }
}

/**
 * Filter out inactive rooms from the list
 */
export function filterOutInactiveRooms(rooms: any[], inactiveRoomNumbers: Set<string>): any[] {
  if (inactiveRoomNumbers.size === 0) {
    return rooms;
  }
  
  // Normaliser les numéros inactifs pour la comparaison
  const normalizedInactive = new Set<string>();
  inactiveRoomNumbers.forEach(num => normalizedInactive.add(normalizeRoomNumber(num)));
  
  const filteredRooms = rooms.filter(room => {
    const roomNumber = room.roomNumber || room.room_number || room.number;
    if (!roomNumber) return false;
    
    // Comparer avec le numéro normalisé
    const isInactive = normalizedInactive.has(normalizeRoomNumber(roomNumber));
    if (isInactive) {
    }
    return !isInactive;
  });
  
  return filteredRooms;
}
