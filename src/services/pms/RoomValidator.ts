/**
 * Service de validation post-extraction des chambres
 * Filtre les faux positifs et calcule un score de confiance
 */

import { ExtractedRoom, CleaningType } from './types';

export interface ValidationResult {
  validRooms: ExtractedRoom[];
  invalidRooms: ExtractedRoom[];
  stats: {
    totalInput: number;
    valid: number;
    invalid: number;
    duplicatesRemoved: number;
    averageConfidence: number;
  };
}

export interface ValidationRule {
  name: string;
  check: (room: ExtractedRoom, context: ValidationContext) => boolean;
  penalty: number; // 0-100, score penalty if check fails
}

interface ValidationContext {
  allRooms: ExtractedRoom[];
  text: string;
  expectedRoomCount?: number;
}

// Règles de validation par défaut
const DEFAULT_VALIDATION_RULES: ValidationRule[] = [
  {
    name: 'valid_number_format',
    check: (room) => {
      // Doit être numérique ou alphanumérique valide
      return /^[A-Z]?-?\d{1,4}[A-Z]?$/i.test(room.roomNumber);
    },
    penalty: 100 // Invalide complètement
  },
  {
    name: 'reasonable_range',
    check: (room) => {
      const num = parseInt(room.roomNumber, 10);
      if (isNaN(num)) return true; // Alphanumérique OK
      return num >= 1 && num <= 9999;
    },
    penalty: 100
  },
  {
    name: 'not_year',
    check: (room) => {
      const num = parseInt(room.roomNumber, 10);
      if (isNaN(num)) return true;
      return num < 1900 || num > 2100;
    },
    penalty: 100
  },
  {
    name: 'has_valid_status',
    check: (room) => {
      const validStatuses = [
        'checkout', 'checkout_arrival', 'stayover', 'arrival', 
        'clean', 'dirty', 'occupied', 'vacant', 'maintenance',
        'out-of-order', 'needs-cleaning', 'needs-inspection',
        'to_check', 'inspected', 'unknown'
      ];
      return validStatuses.some(s => room.status.toLowerCase().includes(s) || s.includes(room.status.toLowerCase()));
    },
    penalty: 20
  },
  {
    name: 'has_cleaning_type',
    check: (room) => ['full', 'quick', 'none'].includes(room.cleaningType),
    penalty: 30
  },
  {
    name: 'not_isolated_number',
    check: (room, ctx) => {
      // Un numéro isolé sans contexte est suspect
      if (!room.originalText) return true;
      const text = room.originalText.toLowerCase();
      // Doit contenir au moins un mot-clé de statut ou "chambre/room"
      const hasContext = /chambre|room|ch\.|status|statut|clean|dirty|sale|propre|parti|arrivé|checkout|arrival/i.test(text);
      return hasContext || (room.confidence || 0) > 70;
    },
    penalty: 40
  }
];

class RoomValidator {
  private rules: ValidationRule[] = DEFAULT_VALIDATION_RULES;

  /**
   * Valide et filtre les chambres extraites
   */
  validate(rooms: ExtractedRoom[], text: string, expectedRoomCount?: number): ValidationResult {
    const context: ValidationContext = { allRooms: rooms, text, expectedRoomCount };
    const validRooms: ExtractedRoom[] = [];
    const invalidRooms: ExtractedRoom[] = [];
    const seenRooms = new Map<string, ExtractedRoom>();

    for (const room of rooms) {
      // Calculer le score après validation
      let score = room.confidence || 70;
      let isValid = true;

      for (const rule of this.rules) {
        if (!rule.check(room, context)) {
          score -= rule.penalty;
          if (rule.penalty >= 100) {
            isValid = false;
            break;
          }
        }
      }

      if (!isValid || score < 30) {
        invalidRooms.push({ ...room, confidence: Math.max(0, score) });
        continue;
      }

      // Gérer les doublons - garder celui avec le meilleur score
      const normalizedNumber = this.normalizeRoomNumber(room.roomNumber);
      const existing = seenRooms.get(normalizedNumber);

      if (existing) {
        if (score > (existing.confidence || 0)) {
          // Remplacer par le meilleur
          seenRooms.set(normalizedNumber, { ...room, roomNumber: normalizedNumber, confidence: score });
        }
      } else {
        seenRooms.set(normalizedNumber, { ...room, roomNumber: normalizedNumber, confidence: score });
      }
    }

    // Collecter les chambres valides
    for (const room of seenRooms.values()) {
      validRooms.push(room);
    }

    // Trier par numéro de chambre
    validRooms.sort((a, b) => {
      const numA = parseInt(a.roomNumber, 10);
      const numB = parseInt(b.roomNumber, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.roomNumber.localeCompare(b.roomNumber);
    });

    const averageConfidence = validRooms.length > 0
      ? validRooms.reduce((sum, r) => sum + (r.confidence || 0), 0) / validRooms.length
      : 0;

    return {
      validRooms,
      invalidRooms,
      stats: {
        totalInput: rooms.length,
        valid: validRooms.length,
        invalid: invalidRooms.length,
        duplicatesRemoved: rooms.length - validRooms.length - invalidRooms.length,
        averageConfidence: Math.round(averageConfidence * 10) / 10
      }
    };
  }

  /**
   * Fusionne intelligemment les chambres locales et IA
   */
  smartMerge(localRooms: ExtractedRoom[], aiRooms: ExtractedRoom[]): ExtractedRoom[] {
    const mergedMap = new Map<string, ExtractedRoom>();

    // D'abord les chambres locales
    for (const room of localRooms) {
      const key = this.normalizeRoomNumber(room.roomNumber);
      mergedMap.set(key, room);
    }

    // Ensuite les chambres IA - fusion intelligente
    for (const aiRoom of aiRooms) {
      const key = this.normalizeRoomNumber(aiRoom.roomNumber);
      const existing = mergedMap.get(key);

      if (!existing) {
        // Nouvelle chambre trouvée par l'IA
        mergedMap.set(key, { ...aiRoom, roomNumber: key });
      } else {
        // Chambre existe - décider quelle version garder
        const localScore = existing.confidence || 70;
        const aiScore = aiRoom.confidence || 70;

        // L'IA gagne si:
        // 1. Score significativement meilleur (+15)
        // 2. Statut plus précis (pas "unknown")
        const aiHasBetterStatus = existing.status === 'unknown' && aiRoom.status !== 'unknown';
        const aiHasBetterScore = aiScore > localScore + 15;

        if (aiHasBetterStatus || aiHasBetterScore) {
          mergedMap.set(key, {
            ...aiRoom,
            roomNumber: key,
            debugInfo: {
              ...aiRoom.debugInfo!,
              source: 'ai',
              appliedRule: `AI override: ${aiHasBetterStatus ? 'better status' : 'higher confidence'}`
            }
          });
        } else if (aiRoom.status !== 'unknown' && existing.status !== aiRoom.status) {
          // Statuts différents mais valides - combiner les infos
          const combinedRoom = this.combineRoomInfo(existing, aiRoom);
          mergedMap.set(key, combinedRoom);
        }
      }
    }

    return Array.from(mergedMap.values()).sort((a, b) => {
      const numA = parseInt(a.roomNumber, 10);
      const numB = parseInt(b.roomNumber, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.roomNumber.localeCompare(b.roomNumber);
    });
  }

  /**
   * Combine les informations de deux versions d'une même chambre
   */
  private combineRoomInfo(local: ExtractedRoom, ai: ExtractedRoom): ExtractedRoom {
    // Règles de combinaison (similaires aux adapters)
    const statuses = [local.status, ai.status];
    
    // Checkout + Arrival = checkout_arrival
    if (statuses.some(s => s.includes('checkout') || s.includes('parti')) &&
        statuses.some(s => s.includes('arrival') || s.includes('arrivée'))) {
      return {
        ...local,
        status: 'checkout_arrival',
        cleaningType: 'full',
        confidence: Math.max(local.confidence || 0, ai.confidence || 0) + 10,
        debugInfo: {
          ...local.debugInfo!,
          appliedRule: 'Smart merge: checkout + arrival',
          confidence: 90
        }
      };
    }

    // Arrival + Clean = clean (pas de nettoyage)
    if (statuses.some(s => s.includes('arrival') || s.includes('arrivée')) &&
        statuses.some(s => s.includes('clean') || s.includes('control') || s.includes('inspect'))) {
      return {
        ...local,
        status: 'clean',
        cleaningType: 'none',
        confidence: Math.max(local.confidence || 0, ai.confidence || 0),
        debugInfo: {
          ...local.debugInfo!,
          appliedRule: 'Smart merge: arrival + clean',
          confidence: 85
        }
      };
    }

    // Par défaut, prendre le nettoyage le plus important
    const cleaningPriority: Record<CleaningType, number> = { full: 3, quick: 2, none: 1 };
    const bestCleaning = cleaningPriority[local.cleaningType] >= cleaningPriority[ai.cleaningType]
      ? local.cleaningType : ai.cleaningType;

    return {
      ...local,
      cleaningType: bestCleaning,
      confidence: Math.max(local.confidence || 0, ai.confidence || 0),
      debugInfo: {
        ...local.debugInfo!,
        appliedRule: 'Smart merge: combined info'
      }
    };
  }

  /**
   * Normalise un numéro de chambre
   */
  private normalizeRoomNumber(roomNumber: string): string {
    // Supprimer les zéros initiaux pour les numéros purement numériques
    const numMatch = roomNumber.match(/^0*(\d+)$/);
    if (numMatch) return numMatch[1];
    // Garder le format pour les alphanumériques mais normaliser
    return roomNumber.replace(/^0+/, '').toUpperCase() || roomNumber;
  }

  /**
   * Ajoute une règle de validation personnalisée
   */
  addRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }
}

// Singleton
export const roomValidator = new RoomValidator();
