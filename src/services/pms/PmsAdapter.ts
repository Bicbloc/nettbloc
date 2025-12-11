/**
 * Interface de base pour tous les adapters PMS
 * Avec système de scoring pondéré pour la détection
 */

import { 
  ExtractedRoom, 
  PmsDetectionResult, 
  PmsCredentials, 
  PmsApiRoom,
  PmsConfig,
  CleaningType,
  StatusMapping,
  CombinationRule,
  ExtractionDebugInfo
} from './types';

export abstract class PmsAdapter {
  abstract readonly name: string;
  abstract readonly keywords: string[];
  abstract readonly criticalKeywords: string[]; // Mots-clés critiques (50+ points)
  abstract readonly config: PmsConfig;

  /**
   * Détecte si le texte correspond à ce PMS avec scoring pondéré
   */
  detect(text: string): PmsDetectionResult {
    const textUpper = text.toUpperCase();
    const matchedKeywords: string[] = [];
    const criticalKeywordsMatched: string[] = [];
    let score = 0;

    // Vérifier les mots-clés critiques (50 points chacun, max 100)
    for (const kw of this.criticalKeywords) {
      if (textUpper.includes(kw.toUpperCase())) {
        criticalKeywordsMatched.push(kw);
        score += 50;
      }
    }
    score = Math.min(score, 100); // Cap à 100 pour les critiques

    // Vérifier les mots-clés normaux (10 points chacun)
    for (const kw of this.keywords) {
      if (textUpper.includes(kw.toUpperCase())) {
        matchedKeywords.push(kw);
        if (!criticalKeywordsMatched.includes(kw)) {
          score += 10;
        }
      }
    }

    // Calculer la confiance (0-100%)
    const confidence = Math.min(score, 100);

    return {
      pmsType: this.name,
      confidence,
      matchedKeywords,
      criticalKeywordsMatched,
      score
    };
  }

  /**
   * Extrait les chambres depuis le texte du rapport PDF
   */
  extractRooms(text: string): ExtractedRoom[] {
    const rooms: ExtractedRoom[] = [];
    const lines = text.split('\n');
    const roomRegex = new RegExp(this.config.roomNumberRegex, 'gi');
    const seenRooms = new Map<string, ExtractedRoom[]>();

    for (const line of lines) {
      // Reset regex state
      roomRegex.lastIndex = 0;
      
      let match;
      while ((match = roomRegex.exec(line)) !== null) {
        const roomNumber = this.normalizeRoomNumber(match[1] || match[0]);
        
        // Valider le numéro de chambre
        if (!this.isValidRoomNumber(roomNumber, line)) continue;
        
        const { status, cleaning, keyword } = this.detectStatus(line);
        
        const debugInfo: ExtractionDebugInfo = {
          rawLine: line,
          cleanedLine: line.trim(),
          detectedKeywords: keyword ? [keyword] : [],
          source: 'regex',
          confidence: 80
        };
        
        const room: ExtractedRoom = {
          roomNumber,
          status,
          cleaningType: cleaning,
          originalText: line.trim(),
          validated: false,
          confidence: 80,
          debugInfo
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
   * Normalise un numéro de chambre
   */
  protected normalizeRoomNumber(roomNumber: string): string {
    // Supprime les zéros initiaux pour les numéros purement numériques
    const numMatch = roomNumber.match(/^0*(\d+)$/);
    if (numMatch) {
      return numMatch[1];
    }
    // Garde le format pour les numéros alphanumériques
    return roomNumber.replace(/^0+/, '') || roomNumber;
  }

  /**
   * Valide si un numéro est un numéro de chambre valide
   */
  protected isValidRoomNumber(num: string, originalLine: string): boolean {
    const n = parseInt(num, 10);
    
    // Si c'est un nombre pur
    if (!isNaN(n)) {
      // Exclure les années
      if (n >= 1900 && n <= 2100) return false;
      
      // Les chambres sont généralement entre 1 et 9999
      if (n < 1 || n > 9999) return false;
    }
    
    // Exclure si fait partie d'une heure (HH:MM)
    if (originalLine.includes(num + ':') || originalLine.includes(':' + num)) return false;
    
    // Exclure si fait partie d'une date
    const dateContext = new RegExp(`\\b${num}[\/\\-\\.]\\d|\\d[\/\\-\\.]${num}\\b`);
    if (dateContext.test(originalLine)) return false;
    
    return true;
  }

  /**
   * Détecte le statut d'une ligne de texte
   */
  protected detectStatus(line: string): { status: string; cleaning: CleaningType; keyword?: string } {
    const lineUpper = line.toUpperCase();
    
    // Trier par priorité (haute priorité d'abord)
    const sortedMappings = Object.entries(this.config.statusMappings)
      .sort((a, b) => (b[1].priority || 0) - (a[1].priority || 0));

    for (const [keyword, mapping] of sortedMappings) {
      if (lineUpper.includes(keyword.toUpperCase())) {
        return { status: mapping.status, cleaning: mapping.cleaning, keyword };
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
          confidence: 90,
          debugInfo: {
            ...roomEntries[0].debugInfo!,
            appliedRule: `Combination: ${rule.conditions.join(' + ')} → ${rule.result.status}`,
            confidence: 90
          }
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

  /**
   * Enrichit la config avec des règles dynamiques
   */
  enrichConfig(statusMappings: Record<string, StatusMapping>, combinationRules: CombinationRule[]): void {
    // Merge status mappings (nouvelles règles ont priorité)
    this.config.statusMappings = { ...this.config.statusMappings, ...statusMappings };
    
    // Ajouter les nouvelles règles de combinaison
    this.config.combinationRules = [...this.config.combinationRules, ...combinationRules];
  }
}
