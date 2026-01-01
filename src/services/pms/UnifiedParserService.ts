/**
 * Service de parsing unifié pour les rapports PMS
 * Avec chargement dynamique des règles, fallback IA, et validation
 */

import { supabase } from '@/integrations/supabase/client';
import { pmsAdapterFactory } from './PmsAdapterFactory';
import { textPreprocessor } from './TextPreprocessor';
import { roomValidator } from './RoomValidator';
import { detectionCache } from './DetectionCache';
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
  private isLoading = false;

  private log(message: string): void {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const logEntry = `[${timestamp}] ${message}`;
    this.debugLogs.push(logEntry);
    console.log(logEntry);
  }

  /**
   * Normalise un numéro de chambre en enlevant les zéros initiaux
   * "001" -> "1", "01A" -> "1A", "100" -> "100"
   */
  private normalizeRoomNumber(roomNumber: string): string {
    if (!roomNumber) return '';
    const str = String(roomNumber).trim();
    // Enlever les zéros initiaux mais garder au moins un caractère
    // Gérer les cas comme "01A" -> "1A"
    const normalized = str.replace(/^0+/, '') || '0';
    return normalized;
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
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      // IMPORTANT: un nouvel entraînement doit invalider le cache de parsing
      // sinon un ancien résultat (ex: 0 chambre) peut être réutilisé à l'import.
      detectionCache.invalidateForHotel(hotelId);

      this.hotelId = hotelId;
      this.learnedPatterns.clear();
      this.customStatusMappings.clear();
      this.debugLogs = [];

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
            // IMPORTANT: Ne stocker QUE les chambres validées lors de l'entraînement
            if (room.roomNumber && room.validated === true) {
              // Normaliser le numéro de chambre (enlever les zéros initiaux)
              const normalizedNumber = this.normalizeRoomNumber(String(room.roomNumber));
              this.learnedPatterns.set(normalizedNumber, {
                roomNumber: room.roomNumber, // Garder l'original pour référence
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
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Parse un rapport avec fallback IA automatique et validation
   */
  /**
   * Parse un rapport avec fallback IA automatique et validation
   * @param forceAi Force l'utilisation de l'IA même si le parsing local est suffisant
   */
  async parseReportHybrid(text: string, hotelId: string, forceAi: boolean = false): Promise<ParseResultWithMeta> {
    const startTime = Date.now();
    this.debugLogs = [];
    
    // Ne pas utiliser le cache si forceAi est activé
    if (!forceAi) {
      const cachedRooms = detectionCache.getParsedRooms(text, hotelId);
      if (cachedRooms) {
        this.log(`📦 [CACHE HIT] ${cachedRooms.length} chambres depuis le cache`);
        console.log(`📦 [CACHE HIT] ${cachedRooms.length} chambres depuis le cache pour hotel ${hotelId}`);
        return {
          rooms: cachedRooms,
          pmsType: 'cached',
          confidence: 95,
          usedAi: false,
          usedLearnedPatterns: true,
          debugLogs: this.debugLogs,
          processingTime: Date.now() - startTime
        };
      }
    }
    
    this.log(`🔄 [CACHE MISS] Parsing frais pour hotel ${hotelId}`);
    
    // Charger les patterns si nécessaire
    if (this.hotelId !== hotelId) {
      await this.loadHotelPatterns(hotelId);
    }

    // Prétraiter le texte (centralisé)
    const preprocessResult = textPreprocessor.preprocess(text);
    const preprocessedText = preprocessResult.text;
    this.log(`📝 Prétraitement: ${preprocessResult.stats.linesAdded} lignes ajoutées, patterns: ${preprocessResult.stats.patternsApplied.join(', ')}`);

    // Étape 1: Parsing local
    const localResult = await this.parseReportLocal(preprocessedText);
    
    // Validation des chambres locales
    const validationResult = roomValidator.validate(localResult.rooms, text);
    this.log(`✅ Validation: ${validationResult.stats.valid}/${validationResult.stats.totalInput} chambres valides (confiance moy: ${validationResult.stats.averageConfidence}%)`);
    
    localResult.rooms = validationResult.validRooms;
    localResult.confidence = validationResult.stats.averageConfidence;

    this.log(`🔍 Parsing local: ${localResult.rooms.length} chambres, confiance ${localResult.confidence.toFixed(1)}%`);

    // Comparer avec le nombre de chambres attendu (patterns appris)
    const expectedRoomCount = this.learnedPatterns.size;
    const roomCountDeviation = expectedRoomCount > 0 
      ? Math.abs(localResult.rooms.length - expectedRoomCount) / expectedRoomCount 
      : 0;

    // Critères ASSOUPLIS pour déclencher le fallback IA
    const unknownStatusRatio = localResult.rooms.length > 0 
      ? localResult.rooms.filter(r => r.status === 'unknown').length / localResult.rooms.length 
      : 0;

    // Désactiver le fallback IA en mode test pour éviter les erreurs 402
    const isTestMode = hotelId === 'test-mode' || !hotelId;
    
    const needsAiFallback = !isTestMode && (
      forceAi ||
      localResult.confidence < 70 ||  // Seuil augmenté de 55% à 70%
      localResult.rooms.length < 3 ||
      unknownStatusRatio > 0.2 ||  // Réduit de 30% à 20%
      (expectedRoomCount > 0 && roomCountDeviation > 0.2)  // Écart > 20% avec patterns appris
    );

    if (isTestMode && (forceAi || localResult.confidence < 70 || localResult.rooms.length < 3)) {
      this.log(`🧪 Mode test: fallback IA désactivé (parsing local uniquement)`);
    }

    if (needsAiFallback) {
      const reason = forceAi ? 'forcé par utilisateur' :
        localResult.confidence < 70 ? `confiance faible (${localResult.confidence.toFixed(1)}%)` :
        localResult.rooms.length < 3 ? `peu de chambres (${localResult.rooms.length})` :
        unknownStatusRatio > 0.2 ? `trop de statuts inconnus (${(unknownStatusRatio * 100).toFixed(0)}%)` :
        `écart avec patterns (${(roomCountDeviation * 100).toFixed(0)}%)`;
      
      this.log(`🤖 Fallback IA: ${reason}`);
      
      try {
        const aiResult = await this.callAiFallback(preprocessedText, hotelId);
        
        if (aiResult && aiResult.length > 0) {
          // Fusion intelligente avec scoring
          const mergedRooms = roomValidator.smartMerge(localResult.rooms, aiResult);
          
          this.log(`✅ Fusion intelligente: ${mergedRooms.length} chambres (local: ${localResult.rooms.length}, IA: ${aiResult.length})`);
          
          // Mettre en cache
          detectionCache.setParsedRooms(text, hotelId, mergedRooms);
          
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

    // Mettre en cache le résultat local
    detectionCache.setParsedRooms(text, hotelId, localResult.rooms);

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
    // Vérifier le cache de détection
    let detection = detectionCache.getDetection(text);
    let adapter;
    
    if (detection) {
      this.log(`📦 Détection PMS du cache: ${detection.pmsType}`);
      adapter = pmsAdapterFactory.getAdapter(detection.pmsType);
    } else {
      // Détecter le PMS
      const result = pmsAdapterFactory.detectPms(text);
      adapter = result.adapter;
      detection = result.detection;
      
      // Mettre en cache
      detectionCache.setDetection(text, detection);
    }
    
    // Enrichir l'adapter avec les règles dynamiques
    const dynamicRule = this.dynamicRules.get(detection.pmsType);
    if (dynamicRule) {
      const statusMappings = dynamicRule.status_mappings || {};
      const combinationRules = dynamicRule.combination_rules || [];
      adapter.enrichConfig(statusMappings, combinationRules);
      this.log(`📜 Règles dynamiques appliquées pour ${detection.pmsType}`);
    }
    
    // Si confiance > 45%, utiliser le parsing local
    if (detection.confidence >= 45) {
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
          reportText: text.substring(0, 6000), // Augmenté pour plus de contexte
          hotelId,
          mode: 'extract'
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
          originalText: r.reason || '',
          debugInfo: {
            rawLine: '',
            cleanedLine: '',
            detectedKeywords: r.rawStatuses || [],
            source: 'ai' as const,
            confidence: r.confidence || 70,
            appliedRule: r.reason || 'AI extraction'
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
   * Parse un rapport PDF et extrait les chambres (méthode principale)
   * @param forceAi Force l'utilisation de l'IA même si le parsing local est suffisant
   */
  async parseReport(text: string, hotelId: string, forceAi: boolean = false): Promise<ParseResultWithMeta> {
    return this.parseReportHybrid(text, hotelId, forceAi);
  }

  /**
   * Applique les patterns appris aux chambres extraites
   * IMPORTANT: Si des patterns existent, on FILTRE pour ne garder que les chambres validées
   * MAIS on garde le type de nettoyage détecté dynamiquement (pas celui de l'entraînement)
   */
  private applyLearnedPatterns(rooms: ExtractedRoom[]): ExtractedRoom[] {
    // Si aucun pattern appris, retourner tel quel (pas de filtrage)
    if (this.learnedPatterns.size === 0) {
      this.log(`📋 Aucun pattern appris, toutes les chambres conservées`);
      return rooms;
    }

    // Créer un Set des numéros de chambres validés lors de l'entraînement (déjà normalisés)
    const validRoomNumbers = new Set(this.learnedPatterns.keys());
    this.log(`🎓 Filtrage par patterns appris: ${validRoomNumbers.size} chambres validées`);
    this.log(`📋 Chambres validées: ${Array.from(validRoomNumbers).slice(0, 20).join(', ')}${validRoomNumbers.size > 20 ? '...' : ''}`);

    // FILTRER pour ne garder que les chambres qui sont dans les patterns appris
    // En normalisant le numéro pour comparer (001 == 1)
    const filteredRooms = rooms.filter(room => {
      // Cas des chambres liées (ex: 100+101) : on garde si
      // - le groupe lui-même a été validé (ex: "100-101")
      // OU
      // - au moins une des chambres du groupe a été validée individuellement
      if (room.isConnected && Array.isArray(room.linkedRooms) && room.linkedRooms.length > 0) {
        const normalizedGroup = this.normalizeRoomNumber(String(room.roomNumber));
        const groupIsValid = validRoomNumbers.has(normalizedGroup);

        const anyPartValid = room.linkedRooms.some((rn) => validRoomNumbers.has(this.normalizeRoomNumber(String(rn))));

        const keep = groupIsValid || anyPartValid;
        if (!keep) {
          this.log(`🚫 Groupe ${room.roomNumber} exclu (non validé dans l'entraînement)`);
        }
        return keep;
      }

      const normalizedNumber = this.normalizeRoomNumber(room.roomNumber);
      const isValid = validRoomNumbers.has(normalizedNumber);
      if (!isValid) {
        this.log(`🚫 Chambre ${room.roomNumber} (normalisé: ${normalizedNumber}) exclue (non validée dans l'entraînement)`);
      }
      return isValid;
    });

    this.log(`📊 Résultat filtrage: ${filteredRooms.length}/${rooms.length} chambres conservées`);

    // IMPORTANT: On garde le type de nettoyage DETECTE (pas celui de l'entraînement)
    // car le rapport du jour peut avoir des statuts différents
    return filteredRooms.map(room => {
      return {
        ...room,
        // Le cleaningType et status viennent de la détection dynamique, pas de l'entraînement
        confidence: Math.max(room.confidence || 0, 85),
        validated: true,
        debugInfo: {
          ...room.debugInfo!,
          source: 'pattern' as const,
          appliedRule: `Chambre validée + détection: ${room.debugInfo?.appliedRule || 'auto'}`,
          confidence: Math.max(room.confidence || 0, 85)
        }
      };
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
    return 'full';
  }

  /**
   * Détecte le type de PMS
   */
  detectPmsType(text: string): PmsDetectionResult {
    // Vérifier le cache
    const cached = detectionCache.getDetection(text);
    if (cached) return cached;
    
    const { detection } = pmsAdapterFactory.detectPms(text);
    detectionCache.setDetection(text, detection);
    return detection;
  }

  /**
   * Récupère les types de PMS disponibles
   */
  getAvailablePmsTypes(): string[] {
    return pmsAdapterFactory.getAvailablePmsTypes();
  }

  /**
   * Vide le cache des patterns et le cache global
   */
  clearCache(): void {
    this.learnedPatterns.clear();
    this.customStatusMappings.clear();
    this.dynamicRules.clear();
    this.hotelId = null;
    this.debugLogs = [];
    detectionCache.clear();
    textPreprocessor.clearCache();
  }

  /**
   * Invalide le cache pour un hôtel spécifique
   */
  invalidateCacheForHotel(hotelId: string): void {
    if (this.hotelId === hotelId) {
      this.learnedPatterns.clear();
      this.customStatusMappings.clear();
      this.hotelId = null;
    }
    detectionCache.invalidateForHotel(hotelId);
  }

  /**
   * Parse local synchrone sans IA - Fallback quand l'IA n'est pas disponible
   */
  parseLocalFallback(text: string, hotelId: string): ExtractedRoom[] {
    try {
      // Prétraitement
      const preprocessResult = textPreprocessor.preprocess(text);
      const preprocessedText = preprocessResult.text;
      
      // Détecter le PMS
      const result = pmsAdapterFactory.detectPms(preprocessedText);
      const adapter = result.adapter;
      
      // Extraire les chambres
      let rooms = adapter.extractRooms(preprocessedText);
      
      // Appliquer les patterns appris
      rooms = this.applyLearnedPatterns(rooms);
      
      // Valider avec roomValidator
      const validation = roomValidator.validate(rooms, text);
      rooms = validation.validRooms;
      
      this.log(`🔧 Fallback local: ${rooms.length} chambres extraites avec ${adapter.name}`);
      
      return rooms;
    } catch (error) {
      this.log(`❌ Erreur fallback local: ${error}`);
      return [];
    }
  }

  /**
   * Retourne les logs de debug
   */
  getDebugLogs(): string[] {
    return [...this.debugLogs];
  }

  /**
   * Statistiques du cache
   */
  getCacheStats() {
    return detectionCache.getStats();
  }
}

// Singleton
export const unifiedParserService = new UnifiedParserService();
