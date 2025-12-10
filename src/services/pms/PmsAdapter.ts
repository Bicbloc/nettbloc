/**
 * Interface de base pour tous les adapters PMS
 */

import { 
  ExtractedRoom, 
  PmsDetectionResult, 
  PmsCredentials, 
  PmsApiRoom,
  PmsConfig,
  CleaningType,
  StatusMapping,
  CombinationRule
} from './types';

export abstract class PmsAdapter {
  abstract readonly name: string;
  abstract readonly keywords: string[];
  abstract readonly config: PmsConfig;

  /**
   * Détecte si le texte correspond à ce PMS
   */
  detect(text: string): PmsDetectionResult {
    const textUpper = text.toUpperCase();
    const matchedKeywords = this.keywords.filter(kw => 
      textUpper.includes(kw.toUpperCase())
    );
    
    const confidence = this.keywords.length > 0 
      ? (matchedKeywords.length / this.keywords.length) * 100 
      : 0;

    return {
      pmsType: this.name,
      confidence,
      matchedKeywords
    };
  }

  /**
   * Extrait les chambres depuis le texte du rapport PDF
   */
  extractRooms(text: string): ExtractedRoom[] {
    const rooms: ExtractedRoom[] = [];
    const lines = text.split('\n');
    const roomRegex = new RegExp(this.config.roomNumberRegex, 'g');
    const seenRooms = new Map<string, ExtractedRoom[]>();

    for (const line of lines) {
      const roomMatches = line.match(roomRegex);
      if (!roomMatches) continue;

      for (const roomNumber of roomMatches) {
        const { status, cleaning } = this.detectStatus(line);
        
        const room: ExtractedRoom = {
          roomNumber,
          status,
          cleaningType: cleaning,
          originalText: line.trim(),
          validated: false,
          confidence: 80
        };

        // Grouper par numéro pour appliquer les règles de combinaison
        if (!seenRooms.has(roomNumber)) {
          seenRooms.set(roomNumber, []);
        }
        seenRooms.get(roomNumber)!.push(room);
      }
    }

    // Appliquer les règles de combinaison et dédupliquer
    for (const [roomNumber, roomEntries] of seenRooms) {
      if (roomEntries.length > 1) {
        const combined = this.applyCombinationRules(roomEntries);
        rooms.push(combined);
      } else {
        rooms.push(roomEntries[0]);
      }
    }

    return rooms;
  }

  /**
   * Détecte le statut d'une ligne de texte
   */
  protected detectStatus(line: string): { status: string; cleaning: CleaningType } {
    const lineUpper = line.toUpperCase();
    
    // Trier par priorité (haute priorité d'abord)
    const sortedMappings = Object.entries(this.config.statusMappings)
      .sort((a, b) => (b[1].priority || 0) - (a[1].priority || 0));

    for (const [keyword, mapping] of sortedMappings) {
      if (lineUpper.includes(keyword.toUpperCase())) {
        return { status: mapping.status, cleaning: mapping.cleaning };
      }
    }

    return { status: 'unknown', cleaning: 'none' };
  }

  /**
   * Applique les règles de combinaison (ex: Départ + Arrivée = full clean)
   */
  protected applyCombinationRules(roomEntries: ExtractedRoom[]): ExtractedRoom {
    const statuses = roomEntries.map(r => r.status.toLowerCase());
    
    for (const rule of this.config.combinationRules) {
      const conditionsLower = rule.conditions.map(c => c.toLowerCase());
      const allMet = conditionsLower.every(cond => 
        statuses.some(s => s.includes(cond) || cond.includes(s))
      );
      
      if (allMet) {
        return {
          ...roomEntries[0],
          status: rule.result.status,
          cleaningType: rule.result.cleaning,
          confidence: 90
        };
      }
    }

    // Par défaut, prendre l'entrée avec la priorité de nettoyage la plus haute
    const priorityOrder: CleaningType[] = ['full', 'quick', 'none'];
    const sorted = [...roomEntries].sort((a, b) => 
      priorityOrder.indexOf(a.cleaningType) - priorityOrder.indexOf(b.cleaningType)
    );
    
    return sorted[0];
  }

  /**
   * Récupère les chambres via l'API du PMS (à implémenter par les adapters)
   */
  async fetchRoomsFromApi?(credentials: PmsCredentials): Promise<PmsApiRoom[]>;
}
