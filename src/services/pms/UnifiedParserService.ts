/**
 * Service de parsing unifié pour les rapports PMS
 * Remplace smartExtractionService et patternLearningService
 */

import { supabase } from '@/integrations/supabase/client';
import { pmsAdapterFactory } from './PmsAdapterFactory';
import { ExtractedRoom, PmsDetectionResult, CleaningType, StatusMapping } from './types';

interface ParseResult {
  rooms: ExtractedRoom[];
  pmsType: string;
  confidence: number;
  usedAi: boolean;
  usedLearnedPatterns: boolean;
}

interface LearnedRoomPattern {
  roomNumber: string;
  cleaningType: CleaningType;
  status: string;
}

class UnifiedParserService {
  private learnedPatterns: Map<string, LearnedRoomPattern> = new Map();
  private customStatusMappings: Map<string, StatusMapping> = new Map();
  private hotelId: string | null = null;

  /**
   * Charge les patterns appris pour un hôtel
   */
  async loadHotelPatterns(hotelId: string): Promise<void> {
    this.hotelId = hotelId;
    this.learnedPatterns.clear();
    this.customStatusMappings.clear();

    try {
      // Charger les patterns validés
      const { data: patterns, error: patternsError } = await supabase
        .from('report_training_patterns')
        .select('extracted_data, detection_rules, pms_type')
        .or(`hotel_id.eq.${hotelId},assigned_to_hotel_id.eq.${hotelId},is_default.eq.true`)
        .eq('validated', true)
        .order('updated_at', { ascending: false })
        .limit(5);

      if (!patternsError && patterns) {
        for (const pattern of patterns) {
          const rooms = Array.isArray(pattern.extracted_data)
            ? pattern.extracted_data
            : (pattern.extracted_data as any)?.rooms || [];

          for (const room of rooms) {
            if (room.roomNumber) {
              this.learnedPatterns.set(String(room.roomNumber), {
                roomNumber: room.roomNumber,
                cleaningType: room.cleaningType || 'none',
                status: room.status || 'clean'
              });
            }
          }

          // Extraire les mappings de statut personnalisés
          const rules = pattern.detection_rules as any;
          if (rules?.statusKeywords) {
            for (const keyword of rules.statusKeywords) {
              this.customStatusMappings.set(keyword.toUpperCase(), {
                status: keyword,
                cleaning: this.inferCleaningFromKeyword(keyword),
                priority: 50
              });
            }
          }
        }
      }

      // Charger les règles de nettoyage personnalisées
      const { data: cleaningRules, error: rulesError } = await supabase
        .from('hotel_cleaning_rules')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('is_active', true);

      if (!rulesError && cleaningRules) {
        for (const rule of cleaningRules) {
          const conditions = rule.conditions as any;
          if (conditions?.keywords) {
            for (const keyword of conditions.keywords) {
              this.customStatusMappings.set(keyword.toUpperCase(), {
                status: rule.result_status || keyword,
                cleaning: rule.result_cleaning_type as CleaningType,
                priority: rule.priority
              });
            }
          }
        }
      }

      console.log(`📚 Patterns chargés: ${this.learnedPatterns.size} chambres, ${this.customStatusMappings.size} mappings`);
    } catch (error) {
      console.error('Erreur chargement patterns:', error);
    }
  }

  /**
   * Parse un rapport PDF et extrait les chambres
   */
  async parseReport(text: string, hotelId: string): Promise<ParseResult> {
    // Charger les patterns si nécessaire
    if (this.hotelId !== hotelId) {
      await this.loadHotelPatterns(hotelId);
    }

    // Détecter le PMS
    const { adapter, detection } = pmsAdapterFactory.detectPms(text);
    
    // Si confiance > 50%, utiliser le parsing local
    if (detection.confidence >= 50) {
      console.log(`✅ Parsing local avec adapter ${adapter.name}`);
      
      let rooms = adapter.extractRooms(text);
      
      // Appliquer les patterns appris en priorité
      rooms = this.applyLearnedPatterns(rooms);
      
      // Appliquer les mappings personnalisés
      rooms = this.applyCustomMappings(rooms, text);

      return {
        rooms,
        pmsType: detection.pmsType,
        confidence: detection.confidence,
        usedAi: false,
        usedLearnedPatterns: this.learnedPatterns.size > 0
      };
    }

    // Sinon, utiliser l'adapter générique
    console.log(`⚠️ Confiance faible (${detection.confidence.toFixed(1)}%), utilisation adapter générique`);
    const genericAdapter = pmsAdapterFactory.getAdapter('generic');
    let rooms = genericAdapter.extractRooms(text);
    rooms = this.applyLearnedPatterns(rooms);
    rooms = this.applyCustomMappings(rooms, text);

    return {
      rooms,
      pmsType: 'generic',
      confidence: detection.confidence,
      usedAi: false,
      usedLearnedPatterns: this.learnedPatterns.size > 0
    };
  }

  /**
   * Applique les patterns appris aux chambres extraites
   */
  private applyLearnedPatterns(rooms: ExtractedRoom[]): ExtractedRoom[] {
    return rooms.map(room => {
      const learned = this.learnedPatterns.get(room.roomNumber);
      if (learned) {
        console.log(`🎓 Pattern appris appliqué pour chambre ${room.roomNumber}`);
        return {
          ...room,
          cleaningType: learned.cleaningType,
          status: learned.status,
          confidence: 95,
          validated: true
        };
      }
      return room;
    });
  }

  /**
   * Applique les mappings de statut personnalisés
   */
  private applyCustomMappings(rooms: ExtractedRoom[], text: string): ExtractedRoom[] {
    if (this.customStatusMappings.size === 0) return rooms;

    return rooms.map(room => {
      const context = room.originalText || '';
      const contextUpper = context.toUpperCase();

      // Trouver le mapping avec la priorité la plus haute
      let bestMapping: StatusMapping | null = null;
      let bestPriority = -1;

      for (const [keyword, mapping] of this.customStatusMappings) {
        if (contextUpper.includes(keyword) && (mapping.priority || 0) > bestPriority) {
          bestMapping = mapping;
          bestPriority = mapping.priority || 0;
        }
      }

      if (bestMapping) {
        return {
          ...room,
          cleaningType: bestMapping.cleaning,
          status: bestMapping.status,
          confidence: 85
        };
      }

      return room;
    });
  }

  /**
   * Infère le type de nettoyage à partir d'un mot-clé
   */
  private inferCleaningFromKeyword(keyword: string): CleaningType {
    const lower = keyword.toLowerCase();
    
    if (lower.includes('recouche') || lower.includes('stayover') || lower.includes('sal')) {
      return 'quick';
    }
    if (lower.includes('propre') || lower.includes('clean') || lower.includes('ins') || lower.includes('contrôl')) {
      return 'none';
    }
    // Par défaut, nettoyage complet
    return 'full';
  }

  /**
   * Détecte le type de PMS
   */
  detectPmsType(text: string): PmsDetectionResult {
    const { detection } = pmsAdapterFactory.detectPms(text);
    return detection;
  }

  /**
   * Récupère les types de PMS disponibles
   */
  getAvailablePmsTypes(): string[] {
    return pmsAdapterFactory.getAvailablePmsTypes();
  }

  /**
   * Vide le cache des patterns
   */
  clearCache(): void {
    this.learnedPatterns.clear();
    this.customStatusMappings.clear();
    this.hotelId = null;
  }
}

// Singleton
export const unifiedParserService = new UnifiedParserService();
