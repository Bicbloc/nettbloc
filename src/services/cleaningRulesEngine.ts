/**
 * Moteur d'application des règles de nettoyage
 * Applique les règles configurées aux chambres extraites
 */

import { 
  CleaningRule, 
  CleaningRuleCondition, 
  CleaningType, 
  ExtractedRoom,
  normalizeCleaningType,
  CLEANING_TYPE_LABELS
} from './pms/types';

export interface RuleMatchResult {
  matched: boolean;
  rule?: CleaningRule;
  reason?: string;
  originalCleaning?: CleaningType;
  appliedCleaning?: CleaningType;
}

/**
 * Évalue une condition unique contre une chambre
 */
function evaluateCondition(
  condition: CleaningRuleCondition,
  room: ExtractedRoom,
  rawText?: string
): boolean {
  const { type, operator, value } = condition;
  
  switch (type) {
    case 'status': {
      const roomStatus = room.status?.toLowerCase() || '';
      const targetValue = String(value).toLowerCase();
      
      switch (operator) {
        case 'equals':
          return roomStatus === targetValue || 
                 (roomStatus === 'checkout' && targetValue === 'departure') ||
                 (roomStatus === 'departure' && targetValue === 'checkout');
        case 'not_equals':
          return roomStatus !== targetValue;
        case 'contains':
          return roomStatus.includes(targetValue);
        default:
          return false;
      }
    }
    
    case 'night_info': {
      const current = room.currentNight;
      const total = room.totalNights;
      
      if (!current || !total) return false;
      
      switch (operator) {
        case 'last_night':
          return current === total;
        case 'first_night':
          return current === 1;
        case 'equals':
          return room.nightInfo === value;
        default:
          return false;
      }
    }
    
    case 'room_pattern': {
      const roomNum = room.roomNumber || '';
      const targetValue = String(value);
      
      switch (operator) {
        case 'starts_with':
          return roomNum.startsWith(targetValue);
        case 'ends_with':
          return roomNum.endsWith(targetValue);
        case 'contains':
          return roomNum.includes(targetValue);
        case 'range': {
          // value devrait être { min: number, max: number }
          if (typeof value === 'object' && 'min' in value && 'max' in value) {
            const numericPart = parseInt(roomNum.replace(/\D/g, ''));
            if (isNaN(numericPart)) return false;
            return numericPart >= value.min && numericPart <= value.max;
          }
          return false;
        }
        default:
          return false;
      }
    }
    
    case 'floor': {
      const roomNum = room.roomNumber || '';
      // Extraire l'étage (premier(s) chiffre(s) pour les chambres à 3+ chiffres)
      const numericPart = roomNum.replace(/\D/g, '');
      if (numericPart.length < 2) return false;
      
      const floor = numericPart.length === 3 
        ? parseInt(numericPart[0]) 
        : parseInt(numericPart.slice(0, -2)) || parseInt(numericPart[0]);
      
      const targetFloor = typeof value === 'number' ? value : parseInt(String(value));
      
      switch (operator) {
        case 'equals':
          return floor === targetFloor;
        case 'greater_than':
          return floor > targetFloor;
        case 'less_than':
          return floor < targetFloor;
        default:
          return false;
      }
    }
    
    case 'rate_code': {
      const rateCode = room.rateCode?.toUpperCase() || '';
      const targetValue = String(value).toUpperCase();
      
      switch (operator) {
        case 'equals':
          return rateCode === targetValue;
        case 'contains':
          return rateCode.includes(targetValue);
        default:
          return false;
      }
    }
    
    case 'room_type': {
      const roomType = room.roomType?.toLowerCase() || '';
      const targetValue = String(value).toLowerCase();
      
      switch (operator) {
        case 'equals':
          return roomType === targetValue;
        case 'contains':
          return roomType.includes(targetValue);
        default:
          return false;
      }
    }
    
    case 'keyword': {
      const text = (rawText || room.originalText || '').toLowerCase();
      const targetValue = String(value).toLowerCase();
      
      switch (operator) {
        case 'contains':
          return text.includes(targetValue);
        case 'not_contains':
          return !text.includes(targetValue);
        default:
          return false;
      }
    }
    
    case 'date': {
      const today = new Date().toISOString().split('T')[0];
      
      switch (operator) {
        case 'is_today': {
          if (String(value) === 'departure') {
            return room.departureDate === today;
          }
          if (String(value) === 'arrival') {
            return room.arrivalDate === today;
          }
          return false;
        }
        default:
          return false;
      }
    }
    
    default:
      return false;
  }
}

/**
 * Évalue une règle complète contre une chambre
 */
function evaluateRule(
  rule: CleaningRule,
  room: ExtractedRoom,
  rawText?: string
): boolean {
  if (!rule.isActive) return false;
  if (rule.conditions.length === 0) return false;
  
  const results = rule.conditions.map(c => evaluateCondition(c, room, rawText));
  
  if (rule.conditionLogic === 'AND') {
    return results.every(r => r);
  } else {
    return results.some(r => r);
  }
}

/**
 * Génère une description lisible de pourquoi la règle s'est appliquée
 */
function generateMatchReason(rule: CleaningRule, room: ExtractedRoom): string {
  const conditionDescriptions = rule.conditions.map(c => {
    switch (c.type) {
      case 'status':
        return `Statut = ${c.value}`;
      case 'night_info':
        if (c.operator === 'last_night') return 'Dernière nuit';
        if (c.operator === 'first_night') return 'Première nuit';
        return `Nuit: ${room.nightInfo}`;
      case 'room_pattern':
        return `Chambre ${c.operator === 'starts_with' ? 'commence par' : c.operator === 'range' ? 'entre' : ''} ${JSON.stringify(c.value)}`;
      case 'floor':
        return `Étage ${c.operator === 'equals' ? '=' : c.operator === 'greater_than' ? '>' : '<'} ${c.value}`;
      default:
        return `${c.type}: ${c.value}`;
    }
  });
  
  return `Règle "${rule.name}" : ${conditionDescriptions.join(rule.conditionLogic === 'AND' ? ' ET ' : ' OU ')}`;
}

/**
 * Applique les règles à une chambre et retourne le résultat
 */
export function applyRulesToRoom(
  room: ExtractedRoom,
  rules: CleaningRule[],
  rawText?: string
): RuleMatchResult {
  // Trier les règles par priorité décroissante
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);
  
  const originalCleaning = normalizeCleaningType(room.cleaningType);
  
  for (const rule of sortedRules) {
    if (evaluateRule(rule, room, rawText)) {
      return {
        matched: true,
        rule,
        reason: generateMatchReason(rule, room),
        originalCleaning,
        appliedCleaning: rule.resultCleaningType,
      };
    }
  }
  
  return {
    matched: false,
    originalCleaning,
    appliedCleaning: originalCleaning,
  };
}

/**
 * Applique les règles à une liste de chambres
 */
export function applyRulesToRooms(
  rooms: ExtractedRoom[],
  rules: CleaningRule[],
  rawText?: string
): Array<ExtractedRoom & { ruleApplied?: string; ruleReason?: string }> {
  return rooms.map(room => {
    const result = applyRulesToRoom(room, rules, rawText);
    
    return {
      ...room,
      cleaningType: result.appliedCleaning || room.cleaningType,
      ruleApplied: result.rule?.name,
      ruleReason: result.reason,
      inferenceReason: result.reason || room.inferenceReason,
    };
  });
}

/**
 * Teste une règle contre un ensemble de chambres et retourne les statistiques
 */
export function testRuleAgainstRooms(
  rule: CleaningRule,
  rooms: ExtractedRoom[],
  rawText?: string
): {
  matchedCount: number;
  matchedRooms: string[];
  wouldChange: number;
  details: Array<{
    roomNumber: string;
    originalCleaning: string;
    newCleaning: string;
  }>;
} {
  const matchedRooms: string[] = [];
  const details: Array<{
    roomNumber: string;
    originalCleaning: string;
    newCleaning: string;
  }> = [];
  
  for (const room of rooms) {
    if (evaluateRule(rule, room, rawText)) {
      matchedRooms.push(room.roomNumber);
      const originalCleaning = normalizeCleaningType(room.cleaningType);
      
      if (originalCleaning !== rule.resultCleaningType) {
        details.push({
          roomNumber: room.roomNumber,
          originalCleaning: CLEANING_TYPE_LABELS[originalCleaning],
          newCleaning: CLEANING_TYPE_LABELS[rule.resultCleaningType],
        });
      }
    }
  }
  
  return {
    matchedCount: matchedRooms.length,
    matchedRooms,
    wouldChange: details.length,
    details,
  };
}

/**
 * Convertit un pattern simple en regex
 */
export function patternToRegex(
  pattern: string,
  operator: 'starts_with' | 'ends_with' | 'contains' | 'range'
): string {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  switch (operator) {
    case 'starts_with':
      return `^${escaped}`;
    case 'ends_with':
      return `${escaped}$`;
    case 'contains':
      return escaped;
    case 'range':
      // Pour les plages, on s'attend à un format "100-199" ou "100 à 199"
      const rangeMatch = pattern.match(/(\d+)\s*(?:-|à)\s*(\d+)/);
      if (rangeMatch) {
        const min = parseInt(rangeMatch[1]);
        const max = parseInt(rangeMatch[2]);
        // Générer un pattern pour la plage
        return `(?:${Array.from({ length: max - min + 1 }, (_, i) => min + i).join('|')})`;
      }
      return escaped;
    default:
      return escaped;
  }
}

/**
 * Valide une règle
 */
export function validateRule(rule: Partial<CleaningRule>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!rule.name?.trim()) {
    errors.push('Le nom de la règle est requis');
  }
  
  if (!rule.conditions || rule.conditions.length === 0) {
    errors.push('Au moins une condition est requise');
  }
  
  if (!rule.resultCleaningType) {
    errors.push('Le type de nettoyage résultant est requis');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}
