/**
 * Service de parsing unifié pour les rapports PMS
 * Avec chargement dynamique des règles et fallback IA
 */

import { supabase } from '@/integrations/supabase/client';
import { pmsAdapterFactory } from './PmsAdapterFactory';
import { 
  ExtractedRoom, 
  PmsDetectionResult, 
  CleaningType, 
  StatusMapping,
  CombinationRule,
  ParseResultWithMeta,
  ExtractionDebugInfo
} from './types';

interface LearnedRoomPattern {
  roomNumber: string;
  cleaningType: CleaningType;
  status: string;
}

interface PmsRuleFromDb {
  pms_type: string;
  status_mappings: any;
  combination_rules: any;
  keywords: string[] | null;
  is_default: boolean;
}

class UnifiedParserService {
  private learnedPatterns: Map<string, LearnedRoomPattern> = new Map();
  private customStatusMappings: Map<string, StatusMapping> = new Map();
  private dynamicRules: Map<string, PmsRuleFromDb> = new Map();
  private hotelId: string | null = null;
  private debugLogs: string[] = [];

  private log(message: string): void {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const logEntry = `[${timestamp}] ${message}`;
    this.debugLogs.push(logEntry);
    console.log(logEntry);
  }

  /**
   * Charge les règles PMS depuis la base de données
   */
  async loadPmsRules(hotelId: string): Promise<void> {
    this.dynamicRules.clear();
    
    try {
      const { data: rules, error } = await supabase
        .from('pms_rules')
        .select('pms_type, status_mappings, combination_rules, keywords, is_default')
        .or(`hotel_id.eq.${hotelId},is_default.eq.true`)
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (!error && rules) {
        for (const rule of rules) {
          // Les règles spécifiques à l'hôtel écrasent les règles par défaut
          if (!this.dynamicRules.has(rule.pms_type) || !rule.is_default) {
            this.dynamicRules.set(rule.pms_type, rule as unknown as PmsRuleFromDb);
          }
        }
        this.log(`📜 ${this.dynamicRules.size} règles PMS chargées depuis la DB`);
      }
    } catch (error) {
      this.log(`⚠️ Erreur chargement règles PMS: ${error}`);
    }
  }

  /**
   * Charge les patterns appris pour un hôtel
   */
  async loadHotelPatterns(hotelId: string): Promise<void> {
    this.hotelId = hotelId;
    this.learnedPatterns.clear();
    this.customStatusMappings.clear();
    this.debugLogs = [];

    try {
      // Charger les règles PMS dynamiques
      await this.loadPmsRules(hotelId);

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

      this.log(`📚 Patterns chargés: ${this.learnedPatterns.size} chambres, ${this.customStatusMappings.size} mappings`);
    } catch (error) {
      this.log(`❌ Erreur chargement patterns: ${error}`);
    }
  }

  /**
   * Parse un rapport avec fallback IA automatique
   */
  async parseReportHybrid(text: string, hotelId: string): Promise<ParseResultWithMeta> {
    const startTime = Date.now();
    this.debugLogs = [];
    
    // Charger les patterns si nécessaire
    if (this.hotelId !== hotelId) {
      await this.loadHotelPatterns(hotelId);
    }

    // Étape 1: Parsing local
    const localResult = await this.parseReportLocal(text);
    
    this.log(`🔍 Parsing local: ${localResult.rooms.length} chambres, confiance ${localResult.confidence.toFixed(1)}%`);

    // Critères pour déclencher le fallback IA
    const needsAiFallback = 
      localResult.confidence < 60 || 
      localResult.rooms.length < 3 ||
      (localResult.rooms.length > 0 && localResult.rooms.filter(r => r.status === 'unknown').length > localResult.rooms.length * 0.3);

    if (needsAiFallback) {
      this.log(`🤖 Confiance insuffisante, appel IA...`);
      
      try {
        const aiResult = await this.callAiFallback(text, hotelId);
        
        if (aiResult && aiResult.length > 0) {
          // Fusionner les résultats (IA a priorité pour les chambres manquantes)
          const mergedRooms = this.mergeResults(localResult.rooms, aiResult);
          
          this.log(`✅ Fusion: ${mergedRooms.length} chambres (local: ${localResult.rooms.length}, IA: ${aiResult.length})`);
          
          return {
            rooms: mergedRooms,
            pmsType: localResult.pmsType,
            confidence: Math.min(localResult.confidence + 20, 95),
            usedAi: true,
            usedLearnedPatterns: this.learnedPatterns.size > 0,
            debugLogs: this.debugLogs,
            processingTime: Date.now() - startTime
          };
        }
      } catch (error) {
        this.log(`⚠️ Erreur IA fallback: ${error}`);
      }
    }

    return {
      ...localResult,
      debugLogs: this.debugLogs,
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Parse un rapport localement (sans IA)
   */
  private async parseReportLocal(text: string): Promise<ParseResultWithMeta> {
    // Détecter le PMS
    const { adapter, detection } = pmsAdapterFactory.detectPms(text);
    
    // Enrichir l'adapter avec les règles dynamiques
    const dynamicRule = this.dynamicRules.get(detection.pmsType);
    if (dynamicRule) {
      const statusMappings = dynamicRule.status_mappings || {};
      const combinationRules = dynamicRule.combination_rules || [];
      adapter.enrichConfig(statusMappings, combinationRules);
      this.log(`📜 Règles dynamiques appliquées pour ${detection.pmsType}`);
    }
    
    // Si confiance > 50%, utiliser le parsing local
    if (detection.confidence >= 50) {
      this.log(`✅ Parsing local avec adapter ${adapter.name} (confiance: ${detection.confidence.toFixed(1)}%)`);
      
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
    this.log(`⚠️ Confiance faible (${detection.confidence.toFixed(1)}%), utilisation adapter générique`);
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
   * Appelle l'edge function IA pour le fallback
   */
  private async callAiFallback(text: string, hotelId: string): Promise<ExtractedRoom[]> {
    try {
      const { data, error } = await supabase.functions.invoke('learn-pattern', {
        body: {
          reportText: text.substring(0, 5000), // Limiter la taille
          hotelId,
          mode: 'extract' // Mode extraction simple
        }
      });

      if (error) {
        this.log(`❌ Erreur appel learn-pattern: ${error.message}`);
        return [];
      }

      if (data?.rooms && Array.isArray(data.rooms)) {
        return data.rooms.map((r: any) => ({
          roomNumber: String(r.roomNumber || r.room_number),
          status: r.status || 'unknown',
          cleaningType: r.cleaningType || r.cleaning_type || 'full',
          confidence: r.confidence || 70,
          debugInfo: {
            rawLine: '',
            cleanedLine: '',
            detectedKeywords: [],
            source: 'ai' as const,
            confidence: r.confidence || 70
          }
        }));
      }

      return [];
    } catch (error) {
      this.log(`❌ Exception appel IA: ${error}`);
      return [];
    }
  }

  /**
   * Fusionne les résultats locaux et IA
   */
  private mergeResults(localRooms: ExtractedRoom[], aiRooms: ExtractedRoom[]): ExtractedRoom[] {
    const roomsMap = new Map<string, ExtractedRoom>();
    
    // D'abord les chambres locales
    for (const room of localRooms) {
      roomsMap.set(room.roomNumber, room);
    }
    
    // Ensuite les chambres IA (seulement si pas déjà présentes ou meilleure confiance)
    for (const room of aiRooms) {
      const existing = roomsMap.get(room.roomNumber);
      if (!existing) {
        roomsMap.set(room.roomNumber, room);
      } else if ((room.confidence || 0) > (existing.confidence || 0)) {
        // L'IA a une meilleure confiance, mettre à jour
        roomsMap.set(room.roomNumber, {
          ...room,
          debugInfo: {
            ...room.debugInfo!,
            source: 'ai'
          }
        });
      }
    }
    
    return Array.from(roomsMap.values());
  }

  /**
   * Parse un rapport PDF et extrait les chambres (méthode principale)
   */
  async parseReport(text: string, hotelId: string): Promise<ParseResultWithMeta> {
    // Utiliser la méthode hybride par défaut
    return this.parseReportHybrid(text, hotelId);
  }

  /**
   * Applique les patterns appris aux chambres extraites
   */
  private applyLearnedPatterns(rooms: ExtractedRoom[]): ExtractedRoom[] {
    return rooms.map(room => {
      const learned = this.learnedPatterns.get(room.roomNumber);
      if (learned) {
        this.log(`🎓 Pattern appris appliqué pour chambre ${room.roomNumber}`);
        return {
          ...room,
          cleaningType: learned.cleaningType,
          status: learned.status,
          confidence: 95,
          validated: true,
          debugInfo: {
            ...room.debugInfo!,
            source: 'pattern' as const,
            appliedRule: 'Learned pattern',
            confidence: 95
          }
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
      let matchedKeyword = '';

      for (const [keyword, mapping] of this.customStatusMappings) {
        if (contextUpper.includes(keyword) && (mapping.priority || 0) > bestPriority) {
          bestMapping = mapping;
          bestPriority = mapping.priority || 0;
          matchedKeyword = keyword;
        }
      }

      if (bestMapping) {
        return {
          ...room,
          cleaningType: bestMapping.cleaning,
          status: bestMapping.status,
          confidence: 85,
          debugInfo: {
            ...room.debugInfo!,
            appliedRule: `Custom mapping: ${matchedKeyword}`,
            detectedKeywords: [...(room.debugInfo?.detectedKeywords || []), matchedKeyword],
            confidence: 85
          }
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
    this.dynamicRules.clear();
    this.hotelId = null;
    this.debugLogs = [];
  }

  /**
   * Retourne les logs de debug
   */
  getDebugLogs(): string[] {
    return [...this.debugLogs];
  }
}

// Singleton
export const unifiedParserService = new UnifiedParserService();
