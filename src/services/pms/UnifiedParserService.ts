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
  isPermanentRule?: boolean; // Si true, cette chambre a TOUJOURS ce cleaningType
}

interface ContextPattern {
  keyword: string;
  cleaningType: CleaningType;
  count: number; // Nombre de fois que ce pattern a été confirmé
}

interface PmsRuleFromDb {
  pms_type: string;
  status_mappings: any;
  combination_rules: any;
  keywords: string[] | null;
  is_default: boolean;
}

// Règle de combinaison chargée depuis la DB
interface CombinationRuleDb {
  id: string;
  priority: number;
  status_keywords: string[];
  arrival_date: 'present' | 'absent' | 'any';
  departure_date: 'present' | 'absent' | 'any';
  arrival_time: 'present' | 'absent' | 'any';
  departure_time: 'present' | 'absent' | 'any';
  night_info: 'present' | 'absent' | 'any';
  result_cleaning_type: CleaningType;
  result_status?: string;
}

class UnifiedParserService {
  private learnedPatterns: Map<string, LearnedRoomPattern> = new Map();
  private contextPatterns: Map<string, ContextPattern> = new Map(); // NOUVEAU: Patterns contextuels
  private permanentRules: Map<string, LearnedRoomPattern> = new Map(); // NOUVEAU: Règles permanentes
  private customStatusMappings: Map<string, StatusMapping> = new Map();
  private dynamicRules: Map<string, PmsRuleFromDb> = new Map();
  private combinationRules: CombinationRuleDb[] = []; // NOUVEAU: Règles de combinaison
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
   * Charge les règles de combinaison depuis hotel_combination_rules
   */
  async loadCombinationRules(hotelId: string): Promise<void> {
    this.combinationRules = [];
    
    try {
      const { data, error } = await supabase
        .from('hotel_combination_rules')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (!error && data) {
        this.combinationRules = data.map(rule => ({
          id: rule.id,
          priority: rule.priority,
          status_keywords: rule.status_keywords || [],
          arrival_date: rule.arrival_date as 'present' | 'absent' | 'any',
          departure_date: rule.departure_date as 'present' | 'absent' | 'any',
          arrival_time: rule.arrival_time as 'present' | 'absent' | 'any',
          departure_time: rule.departure_time as 'present' | 'absent' | 'any',
          night_info: rule.night_info as 'present' | 'absent' | 'any',
          result_cleaning_type: rule.result_cleaning_type as CleaningType,
          result_status: rule.result_status
        }));
        this.log(`🔧 ${this.combinationRules.length} règles de combinaison chargées`);
      }
    } catch (error) {
      this.log(`⚠️ Erreur chargement règles de combinaison: ${error}`);
    }
  }

  /**
   * Extrait le contexte d'une ligne pour le matching des règles de combinaison
   */
  private extractLineContext(line: string): {
    statusKeywords: string[];
    hasArrivalDate: boolean;
    hasDepartureDate: boolean;
    hasArrivalTime: boolean;
    hasDepartureTime: boolean;
    hasNightInfo: boolean;
  } {
    const upper = line.toUpperCase();
    
    // Extraire les mots-clés de statut
    const allKeywords = ['SAL', 'DIR', 'DIRTY', 'OCC', 'OCCUPIED', 'DEP', 'DEPART', 'PARTI', 
                         'CHECKOUT', 'C/O', 'ARR', 'ARRIVAL', 'C/I', 'CHECKIN', 'PRO', 'CLEAN', 'VAC', 'VACANT', 'INS'];
    const statusKeywords = allKeywords.filter(kw => new RegExp(`\\b${kw}\\b`).test(upper));
    
    // Détecter les dates (format DD/MM/YYYY ou DD-MM-YYYY ou DD.MM.YYYY)
    const dateMatches = line.match(/\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g) || [];
    const hasArrivalDate = dateMatches.length >= 1;
    const hasDepartureDate = dateMatches.length >= 2;
    
    // Détecter les horaires - formats multiples: HH:MM, HHhMM, HH.MM
    const timePattern = /(?<!\d[\/\-\.])\b(\d{1,2}):(\d{2})\b(?![\/\-\.]\d)|(?<!\d[\/\-\.])\b(\d{1,2})h(\d{2})\b|(?<!\d[\/\-\.])\b(\d{1,2})\.(\d{2})\b(?![\/\-\.]\d)/gi;
    const timeMatches: string[] = [];
    let match;
    while ((match = timePattern.exec(line)) !== null) {
      // Exclure les années (2025, 2024, etc.) et les valeurs > 23:59
      const hour = parseInt(match[1] || match[3] || match[5], 10);
      if (hour <= 23) {
        timeMatches.push(match[0]);
      }
    }
    
    // Logique: 2+ horaires = checkout + checkin (départ + arrivée) = à blanc
    // 1 horaire = soit départ soit arrivée selon le contexte
    let hasArrivalTime = false;
    let hasDepartureTime = false;
    
    if (timeMatches.length >= 2) {
      // IMPORTANT: 2 horaires = départ puis arrivée = c'est un checkout+checkin = à blanc
      hasArrivalTime = true;
      hasDepartureTime = true;
      this.log(`⏰ ${timeMatches.length} horaires détectés (${timeMatches.join(', ')}) → checkout+checkin`);
    } else if (timeMatches.length === 1) {
      // Un seul horaire: déterminer lequel selon le contexte
      if (/\b(DEP|PARTI|CHECKOUT|C\/O|DEPART)\b/i.test(upper)) {
        hasDepartureTime = true;
      } else if (/\b(ARR|ARRIVAL|C\/I|CHECKIN)\b/i.test(upper)) {
        hasArrivalTime = true;
      } else if (hasDepartureDate) {
        // Si 2 dates mais 1 seul horaire, c'est probablement l'heure de départ
        hasDepartureTime = true;
      }
    }
    
    // Détecter les infos de nuit (Nuit X/Y, Night X of Y, ou format , Nuit 2/3)
    const hasNightInfo = /(?:nuit|night)\s*\d+\s*[\/\\]\s*\d+/i.test(line) || 
                         /\d+\s*[\/\\]\s*\d+\s*(?:nuit|night)/i.test(line) ||
                         /,\s*Nuit\s+\d+\/\d+/i.test(line);
    
    return {
      statusKeywords,
      hasArrivalDate,
      hasDepartureDate,
      hasArrivalTime,
      hasDepartureTime,
      hasNightInfo
    };
  }

  /**
   * Applique les règles de combinaison à une ligne
   * @returns Le résultat de la première règle qui match, ou null si aucune
   */
  private applyCombinationRules(line: string): { cleaningType: CleaningType; status: string; reason: string } | null {
    if (this.combinationRules.length === 0) return null;
    
    const context = this.extractLineContext(line);
    this.log(`🔍 Context: dates=${context.hasArrivalDate}/${context.hasDepartureDate}, times=${context.hasArrivalTime}/${context.hasDepartureTime}, night=${context.hasNightInfo}, keywords=${context.statusKeywords.join(',')}`);
    
    for (const rule of this.combinationRules) {
      // Vérifier les mots-clés de statut
      const statusMatch = rule.status_keywords.length === 0 || 
                          rule.status_keywords.some(kw => context.statusKeywords.includes(kw));
      if (!statusMatch) continue;
      
      // Vérifier chaque condition
      const checkCondition = (ruleValue: 'present' | 'absent' | 'any', actualValue: boolean): boolean => {
        if (ruleValue === 'any') return true;
        if (ruleValue === 'present') return actualValue;
        if (ruleValue === 'absent') return !actualValue;
        return true;
      };
      
      const arrDateMatch = checkCondition(rule.arrival_date, context.hasArrivalDate);
      const depDateMatch = checkCondition(rule.departure_date, context.hasDepartureDate);
      const arrTimeMatch = checkCondition(rule.arrival_time, context.hasArrivalTime);
      const depTimeMatch = checkCondition(rule.departure_time, context.hasDepartureTime);
      const nightMatch = checkCondition(rule.night_info, context.hasNightInfo);
      
      this.log(`📋 Rule #${rule.priority} (${rule.status_keywords.join('/')}): arrDate=${arrDateMatch}, depDate=${depDateMatch}, arrTime=${arrTimeMatch}, depTime=${depTimeMatch}, night=${nightMatch}`);
      
      if (arrDateMatch && depDateMatch && arrTimeMatch && depTimeMatch && nightMatch) {
        const reason = `Règle combinaison #${rule.priority}: ${rule.status_keywords.join('/')} → ${rule.result_cleaning_type}`;
        this.log(`✅ ${reason}`);
        return {
          cleaningType: rule.result_cleaning_type,
          status: rule.result_status || (rule.result_cleaning_type === 'a_blanc' ? 'checkout' : 'stayover'),
          reason
        };
      }
    }
    
    this.log(`⚠️ Aucune règle de combinaison n'a matché`);
    return null;
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
      this.contextPatterns.clear(); // NOUVEAU: Reset patterns contextuels
      this.permanentRules.clear(); // NOUVEAU: Reset règles permanentes
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
              
              // NOUVEAU: Séparer les règles permanentes des patterns contextuels
              if (room.isPermanentRule === true) {
                // Règle permanente: cette chambre a TOUJOURS ce cleaningType
                this.permanentRules.set(normalizedNumber, {
                  roomNumber: room.roomNumber,
                  cleaningType: room.cleaningType || 'none',
                  status: room.status || 'clean',
                  isPermanentRule: true
                });
                this.log(`🔒 Règle permanente: ${room.roomNumber} → ${room.cleaningType}`);
              } else {
                // Pattern normal: la chambre existe, mais son cleaningType dépend du contexte
                this.learnedPatterns.set(normalizedNumber, {
                  roomNumber: room.roomNumber,
                  cleaningType: room.cleaningType || 'none',
                  status: room.status || 'clean'
                });
              }
            }
          }

          // NOUVEAU: Charger les patterns contextuels (keyword → cleaningType)
          const rules = pattern.detection_rules as any;
          if (rules?.contextPatterns) {
            for (const [keyword, cleaningType] of Object.entries(rules.contextPatterns)) {
              const existing = this.contextPatterns.get(keyword);
              if (existing) {
                // Renforcer si même cleaningType, sinon conflit
                if (existing.cleaningType === cleaningType) {
                  existing.count++;
                }
              } else {
                this.contextPatterns.set(keyword, {
                  keyword,
                  cleaningType: cleaningType as CleaningType,
                  count: 1
                });
              }
            }
          }

          // Extraire les mappings de statut personnalisés (ancien système)
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

      // NOUVEAU: Charger les règles de combinaison
      await this.loadCombinationRules(hotelId);

      this.log(`📚 Patterns chargés: ${this.learnedPatterns.size} chambres, ${this.contextPatterns.size} patterns contextuels, ${this.permanentRules.size} règles permanentes, ${this.customStatusMappings.size} mappings, ${this.combinationRules.length} règles combinaison`);
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
    
    // TOUJOURS recharger les patterns pour s'assurer d'avoir les dernières données d'entraînement
    // (un nouvel entraînement peut avoir été fait entre deux parsings)
    await this.loadHotelPatterns(hotelId);

    // Prétraiter le texte (centralisé)
    const preprocessResult = textPreprocessor.preprocess(text);
    const preprocessedText = preprocessResult.text;
    this.log(
      `📝 Prétraitement: ${preprocessResult.stats.linesAdded} lignes ajoutées, ${preprocessResult.stats.linesMerged} lignes fusionnées, patterns: ${preprocessResult.stats.patternsApplied.join(', ')}`
    );

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
      this.log(`🔍 Adapter a extrait: ${rooms.length} chambres`);
      
      // ======= PATTERN-FIRST LOGIC =======
      // Si l'adapter extrait peu/aucune chambre MAIS qu'on a des patterns validés,
      // utiliser les patterns comme référence et chercher les numéros dans le texte
      const patternsExist = this.learnedPatterns.size > 0;
      const adapterFoundFew = rooms.length < 5;
      
      if (patternsExist && adapterFoundFew) {
        this.log(`🎯 PATTERN-FIRST: Adapter n'a trouvé que ${rooms.length} chambres mais ${this.learnedPatterns.size} patterns existent`);
        const patternBasedRooms = this.extractFromPatterns(text, detection.pmsType);
        
        if (patternBasedRooms.length > rooms.length) {
          this.log(`✅ Pattern-first a trouvé ${patternBasedRooms.length} chambres (vs ${rooms.length} de l'adapter)`);
          rooms = patternBasedRooms;
        }
      }
      
      // ======= APPLIQUER LES RÈGLES DE COMBINAISON SUR LES RÉSULTATS DE L'ADAPTER =======
      // Si des règles de combinaison existent, les utiliser pour réanalyser chaque chambre
      if (this.combinationRules.length > 0 && rooms.length > 0) {
        this.log(`🔧 Application des ${this.combinationRules.length} règles de combinaison aux ${rooms.length} chambres`);
        const reportDate = this.extractReportDate(text);
        rooms = rooms.map(room => {
          if (!room.originalText) return room;
          
          // Essayer les règles de combinaison
          const combinationResult = this.applyCombinationRules(room.originalText);
          if (combinationResult) {
            return {
              ...room,
              cleaningType: combinationResult.cleaningType,
              status: combinationResult.status,
              debugInfo: {
                ...room.debugInfo,
                source: 'combination' as const,
                appliedRule: combinationResult.reason,
                confidence: 90
              }
            };
          }
          
          // Sinon, analyser le contexte de la ligne
          const analyzed = this.analyzeLineContext(room.originalText, detection.pmsType, reportDate);
          return {
            ...room,
            cleaningType: analyzed.cleaningType,
            status: analyzed.status,
            debugInfo: {
              ...room.debugInfo,
              source: 'context' as const,
              appliedRule: analyzed.reason,
              confidence: 85
            }
          };
        });
      }
      
      // Appliquer les patterns appris (filtrage)
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
    
    // Pattern-first pour générique aussi
    if (this.learnedPatterns.size > 0 && rooms.length < 5) {
      const patternBasedRooms = this.extractFromPatterns(text, 'generic');
      if (patternBasedRooms.length > rooms.length) {
        rooms = patternBasedRooms;
      }
    }
    
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
   * Extrait la date du rapport depuis le header Mews
   * Ex: "Statut des espaces - 01/01/2026" ou "Hôtel ... 01/01/2026 14:09:11"
   */
  private extractReportDate(text: string): Date | null {
    // Pattern 1: "Statut des espaces - DD/MM/YYYY"
    const pattern1 = /Statut des espaces\s*[-–]\s*(\d{2}\/\d{2}\/\d{4})/i;
    let match = text.match(pattern1);
    if (match) {
      const [day, month, year] = match[1].split('/').map(Number);
      return new Date(year, month - 1, day);
    }
    
    // Pattern 2: Footer "Hotel ... DD/MM/YYYY HH:MM:SS"
    const pattern2 = /(?:Hôtel|Hotel)\s+.*?(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}:\d{2}/i;
    match = text.match(pattern2);
    if (match) {
      const [day, month, year] = match[1].split('/').map(Number);
      return new Date(year, month - 1, day);
    }
    
    // Pattern 3: Any date at the beginning of the text
    const pattern3 = /^.*?(\d{2}\/\d{2}\/\d{4})/m;
    match = text.match(pattern3);
    if (match) {
      const [day, month, year] = match[1].split('/').map(Number);
      return new Date(year, month - 1, day);
    }
    
    return null;
  }

  /**
   * PATTERN-FIRST: Extrait les chambres en utilisant les patterns validés comme référence
   * Pour chaque numéro de chambre validé, cherche dans le texte et détermine le statut/cleaningType
   */
  private extractFromPatterns(text: string, pmsType: string): ExtractedRoom[] {
    const rooms: ExtractedRoom[] = [];
    const lines = text.split('\n');
    const reportDate = this.extractReportDate(text);
    
    this.log(`🔎 Pattern-first: Recherche de ${this.learnedPatterns.size} numéros dans ${lines.length} lignes`);
    if (reportDate) {
      this.log(`📅 Date du rapport détectée: ${reportDate.toLocaleDateString('fr-FR')}`);
    }
    
    // Pour chaque numéro de chambre validé dans les patterns
    for (const [normalizedNumber, pattern] of this.learnedPatterns) {
      const roomNumber = pattern.roomNumber;
      
      // Chercher ce numéro dans le texte
      const roomRegex = new RegExp(`\\b${this.escapeRegex(roomNumber)}\\b|\\b${this.escapeRegex(normalizedNumber)}\\b`, 'i');
      const shouldCombineContext = pmsType === 'mews' || pmsType === 'space_status';
      const nextRoomStartRegex = /^\s*(\d{1,4}[A-Z]?)\s+(SGL|DBL|DBS|TWS|JSU|TRP|QUA|SUI|APT|STU)\b/i;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (roomRegex.test(line)) {
          // IMPORTANT (MEWS Space status): la date / Night / Guests peut être sur les lignes suivantes.
          // Si on ne combine pas, la détection "séjour en cours" ne s'applique pas en mode pattern-first.
          let contextLine = line;
          if (shouldCombineContext) {
            let combined = line;
            for (let j = i + 1; j < lines.length && j < i + 4; j++) {
              const nextLine = lines[j];
              if (!nextLine.trim()) continue;
              if (nextRoomStartRegex.test(nextLine)) break;
              if (/^\s*\d{1,2}\s*$/.test(nextLine)) break; // changement d'étage
              combined += ' ' + nextLine;
            }
            contextLine = combined;
          }

          // PRIORITÉ AU PATTERN VALIDÉ: Utiliser le cleaningType du pattern si disponible
          // Sinon, analyser le contexte de la ligne
          let status = pattern.status;
          let cleaningType = pattern.cleaningType;
          let reason = `Pattern validé: ${status}/${cleaningType}`;

          // Analyser le contexte si le pattern n'impose pas un cleaningType (ou si "none")
          // NB: on ne force plus ici un override global vers "recouche".
          // Les règles (dates/nuit/horaire + patterns contextuels) sont gérées dans analyzeLineContext().
          if (!cleaningType || cleaningType === 'none') {
            // Vérifier si c'est vraiment "none" (propre) ou si on doit analyser
            const analyzed = this.analyzeLineContext(contextLine, pmsType, reportDate);

            // Si le pattern dit "none" mais l'analyse détecte un besoin de nettoyage,
            // on garde le pattern car il a été explicitement validé
            if (pattern.cleaningType === 'none' && analyzed.cleaningType !== 'none') {
              // Le pattern dit explicitement "pas de nettoyage", on le respecte
              this.log(`🎯 Chambre ${roomNumber}: Pattern validé dit 'none', analyse dit '${analyzed.cleaningType}' → On garde 'none'`);
              status = pattern.status || 'clean';
              cleaningType = 'none';
              reason = `Pattern validé: propre (override analyse)`;
            } else if (!pattern.cleaningType) {
              // Pas de cleaningType dans le pattern, utiliser l'analyse
              status = analyzed.status;
              cleaningType = analyzed.cleaningType;
              reason = analyzed.reason;
            }
          }

          rooms.push({
            roomNumber,
            status,
            cleaningType,
            confidence: 95, // Plus haute confiance car pattern validé
            validated: true,
            originalText: contextLine.trim(),
            debugInfo: {
              rawLine: contextLine,
              cleanedLine: contextLine.trim(),
              detectedKeywords: [],
              source: 'pattern' as const,
              confidence: 95,
              appliedRule: `Pattern-first: ${reason}`
            }
          });

          break; // Ne prendre que la première occurrence
        }
      }
    }
    
    // ====== FUSION DES CHAMBRES LIÉES (107+108) ======
    const mergedRooms = this.mergeConnectedRooms(rooms, text);
    
    this.log(`🎯 Pattern-first: ${mergedRooms.length}/${this.learnedPatterns.size} chambres trouvées (après fusion)`);
    return mergedRooms;
  }

  /**
   * Fusionne les chambres liées (format 107+108) en un seul groupe
   */
  private mergeConnectedRooms(rooms: ExtractedRoom[], text: string): ExtractedRoom[] {
    const lines = text.split('\n');
    const linkedRegex = /(\d{2,4})\s*\+\s*(\d{2,4})/g;
    
    const byNumber = new Map<string, ExtractedRoom>();
    for (const r of rooms) {
      byNumber.set(this.normalizeRoomNumber(String(r.roomNumber)), r);
    }
    
    const removed = new Set<string>();
    const merged: ExtractedRoom[] = [];
    
    const pickBest = (a?: ExtractedRoom, b?: ExtractedRoom): { status: string; cleaningType: CleaningType; confidence: number } => {
      const candidates = [a, b].filter(Boolean) as ExtractedRoom[];
      if (candidates.length === 0) return { status: 'unknown', cleaningType: 'none', confidence: 60 };
      
      // Priorité de nettoyage (du plus important au moins important)
      const priority: CleaningType[] = ['a_blanc', 'full', 'recouche', 'quick', 'none'];
      const best = [...candidates].sort((x, y) => priority.indexOf(x.cleaningType) - priority.indexOf(y.cleaningType))[0];
      
      return {
        status: best.status || 'unknown',
        cleaningType: best.cleaningType || 'none',
        confidence: Math.max(...candidates.map((c) => c.confidence ?? 70)),
      };
    };
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      // Ignorer les lignes d'en-tête
      if (line.includes('Étage') && line.includes('Espaces')) continue;
      if (line.includes('Hotel') && /\d{2}\/\d{2}\/\d{4}/.test(line)) continue;
      if (/^\s*\d\s*$/.test(line)) continue;
      
      linkedRegex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = linkedRegex.exec(line)) !== null) {
        const aRaw = match[1];
        const bRaw = match[2];
        
        const a = this.normalizeRoomNumber(aRaw);
        const b = this.normalizeRoomNumber(bRaw);
        
        if (!a || !b) continue;
        if (removed.has(a) || removed.has(b)) continue;
        
        const roomA = byNumber.get(a);
        const roomB = byNumber.get(b);
        const { status, cleaningType, confidence } = pickBest(roomA, roomB);
        
        removed.add(a);
        removed.add(b);
        
        merged.push({
          roomNumber: `${aRaw}-${bRaw}`,
          status,
          cleaningType,
          originalText: line.trim(),
          validated: true,
          confidence: Math.max(85, confidence),
          isConnected: true,
          linkedRooms: [aRaw, bRaw],
          debugInfo: {
            rawLine: line,
            cleanedLine: line.trim(),
            detectedKeywords: [],
            source: 'pattern' as const,
            confidence: Math.max(85, confidence),
            appliedRule: 'Connected rooms merge (+)',
          },
        });
      }
    }
    
    return [
      ...rooms.filter((r) => !removed.has(this.normalizeRoomNumber(String(r.roomNumber)))),
      ...merged,
    ];
  }

  /**
   * Extrait les positions des horaires dans une ligne (pour Mews)
   * - Horaire à DROITE (après le nom du client) = heure de DÉPART
   * - Horaire à GAUCHE (après email/tiret, avant client) = heure d'ARRIVÉE
   */
  private extractTimePositions(line: string): { 
    arrivalTime: string | null; 
    departureTime: string | null;
    hasDeparture: boolean;
    hasArrival: boolean;
  } {
    // Pattern pour trouver les horaires HH:MM (pas les dates DD/MM/YYYY)
    const timePattern = /(?<!\d\/)\b(\d{1,2}:\d{2})\b(?!\/\d)/g;
    const times: { time: string; index: number }[] = [];
    
    let match;
    while ((match = timePattern.exec(line)) !== null) {
      times.push({ time: match[1], index: match.index });
    }
    
    if (times.length === 0) {
      return { arrivalTime: null, departureTime: null, hasDeparture: false, hasArrival: false };
    }
    
    const lineLength = line.length;
    
    if (times.length === 1) {
      const timeMatch = times[0];
      // Si l'horaire est dans la dernière partie de la ligne (après 60%) → départ
      // Sinon → arrivée
      const isRightSide = timeMatch.index > lineLength * 0.6;
      
      return isRightSide 
        ? { arrivalTime: null, departureTime: timeMatch.time, hasDeparture: true, hasArrival: false }
        : { arrivalTime: timeMatch.time, departureTime: null, hasDeparture: false, hasArrival: true };
    }
    
    // 2+ horaires : le premier est arrivée, le dernier est départ
    return {
      arrivalTime: times[0].time,
      departureTime: times[times.length - 1].time,
      hasDeparture: true,
      hasArrival: true
    };
  }

  /**
   * Détecte un séjour "sans horaire": date d'arrivée + date de départ présentes,
   * mais aucun horaire. Règle métier: sans horaire ⇒ client encore à l'hôtel ⇒ recouche.
   */
  private isStayoverWithoutTimes(line: string): boolean {
    const datePattern = /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/g;
    const dates = line.match(datePattern) || [];
    if (dates.length < 2) return false;

    const hasTime =
      /(?<!\d\/)\b\d{1,2}:\d{2}\b(?!\/\d)/i.test(line) ||
      /\b\d{1,2}h\d{2}\b/i.test(line) ||
      /(?<!\d\/)\b\d{1,2}\.\d{2}\b(?!\/\d)/i.test(line);

    return !hasTime;
  }

  /**
   * Analyse le contexte d'une ligne pour déterminer le statut et type de nettoyage
   * LOGIQUE MEWS BASÉE SUR LA POSITION DES HORAIRES:
   * - Horaire à DROITE = départ → À blanc
   * - Horaire à GAUCHE = arrivée seule → Recouche
   * - Pas d'horaire = client reste → Recouche
   */
  private analyzeLineContext(
    line: string, 
    pmsType: string,
    reportDate: Date | null = null
  ): { status: string; cleaningType: CleaningType; reason: string } {
    const upper = line.toUpperCase();
    const stayoverNoTimes = this.isStayoverWithoutTimes(line);

    // PRIORITÉ 1: Règles de combinaison configurées par l'utilisateur
    const combinationResult = this.applyCombinationRules(line);
    if (combinationResult) {
      return combinationResult;
    }

    // PRIORITÉ 2: mots-clés de départ explicites → À blanc
    // (sinon on risque de tout classer en recouche dès qu'il y a 2 dates).
    if (/\b(PARTI|D[EÉ]PART|DEPART|CHECK\s*OUT|CHECKOUT|C\/O|DEP)\b/i.test(upper)) {
      return {
        status: 'checkout',
        cleaningType: 'a_blanc',
        reason: 'Mot-clé départ explicite → À blanc',
      };
    }


    // CORRECTION: La dernière nuit (X/X) signifie que le client est ENCORE LÀ cette nuit
    // Donc c'est une RECOUCHE, pas un départ. Le départ sera le lendemain.
    // Supporte "Night" (EN) et "Nuit" (FR)
    const lastNightMatch = upper.match(/(?:NIGHT|NUIT)\s*(\d+)\s*[\/\\]\s*(\d+)/i) || 
                           upper.match(/(\d+)\s*[\/\\]\s*(\d+)\s*(?:NIGHT|NUIT)/i);
    if (lastNightMatch) {
      const currentNight = parseInt(lastNightMatch[1]);
      const totalNights = parseInt(lastNightMatch[2]);
      
      // VÉRIFIER D'ABORD si un pattern contextuel appris existe pour DERNIERE_NUIT
      const learnedDerniereNuit = this.contextPatterns.get('DERNIERE_NUIT');
      
      if (currentNight === totalNights) {
        // DERNIÈRE NUIT: Par défaut = RECOUCHE (le client dort encore cette nuit)
        // Mais si un pattern appris dit autrement, on le respecte
        if (learnedDerniereNuit) {
          const status = this.inferStatusFromCleaningType(learnedDerniereNuit.cleaningType);
          this.log(`🎯 Dernière nuit (${currentNight}/${totalNights}) → Pattern appris: ${learnedDerniereNuit.cleaningType}`);
          return { 
            status, 
            cleaningType: learnedDerniereNuit.cleaningType, 
            reason: `Dernière nuit → Pattern appris: ${learnedDerniereNuit.cleaningType}` 
          };
        }
        
        // Par défaut: dernière nuit = recouche (le client reste cette nuit)
        this.log(`🎯 Dernière nuit (${currentNight}/${totalNights}) → Recouche (client présent)`);
        return { 
          status: 'stayover', 
          cleaningType: 'recouche', 
          reason: `Dernière nuit (${currentNight}/${totalNights}) → Recouche (client présent)` 
        };
      } else if (currentNight < totalNights) {
        // Nuit intermédiaire → recouche
        return { 
          status: 'stayover', 
          cleaningType: 'recouche', 
          reason: `Nuit ${currentNight}/${totalNights} (intermédiaire) → Recouche` 
        };
      }
    }
    
    // ====== RÈGLE PRIORITAIRE: COMPARAISON DATE DE DÉPART AVEC DATE DU RAPPORT ======
    // Si la date de départ présente dans la ligne = date du rapport → c'est un départ
    // IMPORTANT: si la ligne a une paire arrivée+dép. SANS horaire, on évite de déduire
    // un départ "probable" sans mot-clé explicite.
    if (reportDate) {
      // Chercher une date au format DD/MM/YYYY dans la ligne
      const dateMatches = line.match(/(\d{2})\/(\d{2})\/(\d{4})/g);
      if (dateMatches && dateMatches.length >= 1) {
        for (const dateStr of dateMatches) {
          const [day, month, year] = dateStr.split('/').map(Number);
          const lineDate = new Date(year, month - 1, day);

          // Si cette date correspond à la date du rapport
          if (lineDate.getTime() === reportDate.getTime()) {
            // Vérifier le contexte: est-ce une date de départ?
            // Si c'est après la date d'arrivée OU si c'est la seule date, c'est un départ
            const departureKeywords = /D[EÉ]PART|DEP|CHECKOUT|C\/O|PARTI/i;
            const arrivalKeywords = /ARRIV[EÉ]E|ARR|CHECKIN|C\/I/i;

            // Si on trouve un mot-clé de départ, c'est définitivement un départ
            if (departureKeywords.test(upper)) {
              this.log(`🎯 Date départ = Date rapport (${dateStr}) + mot-clé départ → À blanc`);
              return {
                status: 'checkout',
                cleaningType: 'a_blanc',
                reason: `Date départ (${dateStr}) = Date rapport → À blanc`,
              };
            }

            // Si la ligne ressemble à un séjour (dates sans horaire), ne pas forcer un départ
            if (stayoverNoTimes) {
              continue;
            }

            // Si pas de mot-clé d'arrivée et la date est en fin de ligne → probable départ
            if (!arrivalKeywords.test(upper) && dateMatches.length >= 2) {
              const lastDate = dateMatches[dateMatches.length - 1];
              if (lastDate === dateStr) {
                this.log(`🎯 Date fin (${dateStr}) = Date rapport → Probable départ → À blanc`);
                return {
                  status: 'checkout',
                  cleaningType: 'a_blanc',
                  reason: `Date fin (${dateStr}) = Date rapport → Départ → À blanc`,
                };
              }
            }
          }
        }
      }
    }

    // RÈGLE MÉTIER (fallback): dates arrivée+dép. SANS horaire ⇒ client encore présent ⇒ recouche
    if (stayoverNoTimes) {
      return {
        status: 'stayover',
        cleaningType: 'recouche',
        reason: 'Dates arrivée + départ sans horaire → Recouche (client présent)',
      };
    }

    // ====== RÈGLES MEWS/SPACE_STATUS SPÉCIFIQUES ======
    if (pmsType === 'mews' || pmsType === 'space_status') {
      // PRO = propre, pas de nettoyage
      if (/\bPRO\b/.test(upper)) {
        return { status: 'clean', cleaningType: 'none', reason: 'PRO (propre)' };
      }
      
      // INS = inspecté, pas de nettoyage
      if (/\bINS\b/.test(upper)) {
        return { status: 'inspected', cleaningType: 'none', reason: 'INS (inspecté)' };
      }
      
      // Checkout + Arrival (même ligne) = a_blanc prioritaire
      const hasDepOrDirty = /\b(DEP|DIRTY)\b/.test(upper);
      const hasArr = /\bARR\b/.test(upper);
      if (hasDepOrDirty && hasArr) {
        return { status: 'checkout_arrival', cleaningType: 'a_blanc', reason: 'DEP+ARR' };
      }
      
      // ====== LOGIQUE DIR/SAL - BASÉE SUR PRÉSENCE DE DATES/HORAIRES ======
      if (/\b(DIR|SAL)\b/.test(upper)) {
        const { hasDeparture, hasArrival } = this.extractTimePositions(line);
        
        // CAS 1: Horaires présents (checkout/checkin) → À blanc
        if (hasDeparture && hasArrival) {
          return { status: 'checkout_checkin', cleaningType: 'a_blanc', reason: 'DIR/SAL + 2 horaires → À blanc' };
        }
        
        // CAS 2: Horaire à droite = départ → À blanc
        if (hasDeparture) {
          this.log(`🔍 MEWS: Départ détecté (horaire droite) → À blanc`);
          return { status: 'checkout', cleaningType: 'a_blanc', reason: 'DIR/SAL + horaire droite → Départ → À blanc' };
        }
        
        // CAS 3: Vérifier si dates présentes SANS horaires (client en séjour) → Recouche
        const datePattern = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g;
        const dates = line.match(datePattern) || [];
        const hasOccupancy = /\d+\s*[×x]\s*(Adults?|Adultes?)/i.test(line);
        
        if (dates.length > 0 && !hasDeparture) {
          // Dates présentes SANS horaire de départ = client en séjour = Recouche
          this.log(`🔍 MEWS: Dates sans horaire départ → Recouche (client en séjour)`);
          return { status: 'stayover', cleaningType: 'recouche', reason: 'DIR/SAL + dates sans horaire → Recouche' };
        }
        
        if (hasOccupancy && !hasDeparture) {
          return { status: 'stayover', cleaningType: 'recouche', reason: 'DIR/SAL + occupation (Adultes) → Recouche' };
        }
        
        // CAS 4: DIR/SAL sans dates ni horaires = chambre vide sale → À blanc
        return { status: 'dirty', cleaningType: 'a_blanc', reason: 'DIR/SAL sans séjour → À blanc' };
      }
      
      // DEP seul = départ, a_blanc
      if (/\b(DEP|CHECKOUT|DÉPART)\b/.test(upper)) {
        return { status: 'checkout', cleaningType: 'a_blanc', reason: 'DEP/CHECKOUT' };
      }
    }
    
    // ====== RÈGLES GÉNÉRIQUES ======
    const hasDirtyKeyword = /\b(DIRTY|SALE|SAL|DIR)\b/.test(upper);

    // Checkout/Départ
    if (/\b(CHECKOUT|DÉPART|DEPARTURE|DEP|C\/O)\b/.test(upper)) {
      return { status: 'checkout', cleaningType: 'a_blanc', reason: 'checkout keyword' };
    }

    // Apaleo: arrivée + sale = à blanc
    if (pmsType === 'apaleo') {
      const hasArrivalKeyword = /\b(ARR|ARRIVAL|CHECKIN|C\/I|DUE IN)\b/.test(upper);
      if (hasArrivalKeyword && hasDirtyKeyword) {
        return { status: 'arrival', cleaningType: 'a_blanc', reason: 'Apaleo: arrivée + sale → À blanc' };
      }
    }
    
    // Stayover/Recouche
    // Important: ne PAS laisser OCC/OCCUPIED écraser une chambre sale (ex: "OCC DIR")
    // et ne pas interpréter OCC comme stayover pour Apaleo.
    const allowOccStayover = pmsType !== 'apaleo';
    if (
      /\b(STAYOVER|RECOUCHE|STAY)\b/.test(upper) ||
      (allowOccStayover && !hasDirtyKeyword && /\b(OCC|OCCUPIED)\b/.test(upper))
    ) {
      return { status: 'stayover', cleaningType: 'recouche', reason: 'stayover keyword' };
    }
    
    // Propre/Clean
    if (/\b(CLEAN|PROPRE|READY|INSPECTED|PRO|INS)\b/.test(upper)) {
      return { status: 'clean', cleaningType: 'none', reason: 'clean keyword' };
    }
    
    // Sale/Dirty → À blanc (chambre vide sale)
    if (hasDirtyKeyword) {
      return { status: 'dirty', cleaningType: 'a_blanc', reason: 'dirty keyword → À blanc' };
    }
    
    // Par défaut, ne pas forcer a_blanc → recouche plus conservateur
    return { status: 'unknown', cleaningType: 'recouche', reason: 'default' };
  }

  /**
   * Échappe les caractères spéciaux pour une regex
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
   * ET on applique le cleaningType appris lors de l'entraînement IA (PRIORITÉ sur la détection dynamique)
   */
  private applyLearnedPatterns(rooms: ExtractedRoom[]): ExtractedRoom[] {
    // Si aucun pattern appris, retourner tel quel (pas de filtrage)
    if (this.learnedPatterns.size === 0 && this.permanentRules.size === 0) {
      this.log(`📋 Aucun pattern appris, toutes les chambres conservées`);
      return rooms;
    }

    // Créer un Set des numéros de chambres validés lors de l'entraînement (déjà normalisés)
    const validRoomNumbers = new Set([
      ...this.learnedPatterns.keys(),
      ...this.permanentRules.keys()
    ]);
    this.log(`🎓 Filtrage par patterns appris: ${validRoomNumbers.size} chambres validées (${this.permanentRules.size} règles permanentes, ${this.learnedPatterns.size} patterns)`);
    this.log(`📋 Chambres validées: ${Array.from(validRoomNumbers).slice(0, 20).join(', ')}${validRoomNumbers.size > 20 ? '...' : ''}`);

    // FILTRER pour ne garder que les chambres qui sont dans les patterns appris
    const filteredRooms = rooms.filter(room => {
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

    // Appliquer les cleaningTypes appris (PRIORITÉ: pattern appris > détection dynamique)
    return filteredRooms.map(room => {
      const normalizedNumber = this.normalizeRoomNumber(room.roomNumber);
      
      // ======= PRIORITÉ 1: RÈGLES PERMANENTES =======
      // Si cette chambre a une règle permanente, l'appliquer TOUJOURS
      const permanentRule = this.permanentRules.get(normalizedNumber);
      if (permanentRule) {
        this.log(`🔒 Chambre ${room.roomNumber}: Règle permanente = '${permanentRule.cleaningType}'`);
        return {
          ...room,
          cleaningType: permanentRule.cleaningType,
          status: permanentRule.status,
          confidence: 98,
          validated: true,
          debugInfo: {
            ...room.debugInfo!,
            source: 'pattern' as const,
            appliedRule: `Règle permanente: ${permanentRule.cleaningType}`,
            confidence: 98
          }
        };
      }
      
      // ======= PRIORITÉ 2: PATTERNS CONTEXTUELS (DISCRIMINANTS UNIQUEMENT) =======
      // N'appliquer QUE les patterns contextuels spécifiques/discriminants:
      // - DEPART, DERNIERE_NUIT, NUIT_INTERMEDIAIRE, NUIT_SANS_HORAIRE
      // Ignorer les patterns trop génériques (SALE, STAYOVER, ARRIVEE, PROPRE)
      // car ils écrasent la détection dynamique correcte
      const DISCRIMINANT_KEYWORDS = ['DEPART', 'DERNIERE_NUIT', 'NUIT_INTERMEDIAIRE', 'NUIT_SANS_HORAIRE'];
      
      if (this.contextPatterns.size > 0 && room.originalText) {
        const lineKeywords = this.extractLineKeywords(room.originalText);
        
        // Chercher un pattern contextuel DISCRIMINANT qui correspond
        for (const keyword of lineKeywords) {
          // Ignorer les patterns génériques qui ne doivent pas décider du cleaningType
          if (!DISCRIMINANT_KEYWORDS.includes(keyword)) {
            continue;
          }
          
          const contextPattern = this.contextPatterns.get(keyword);
          if (contextPattern) {
            this.log(`🎯 Chambre ${room.roomNumber}: Pattern contextuel discriminant '${keyword}' → ${contextPattern.cleaningType}`);
            return {
              ...room,
              cleaningType: contextPattern.cleaningType,
              status: this.inferStatusFromCleaningType(contextPattern.cleaningType),
              confidence: 90,
              validated: true,
              debugInfo: {
                ...room.debugInfo!,
                source: 'pattern' as const,
                appliedRule: `Pattern contextuel: ${keyword} → ${contextPattern.cleaningType}`,
                confidence: 90
              }
            };
          }
        }
      }
      
      // ======= PRIORITÉ 2.5: PATTERN APPRIS (cleaningType de l'entraînement IA) =======
      // Si cette chambre a un pattern appris avec un cleaningType défini, L'UTILISER
      // C'est le cleaningType validé par l'utilisateur lors de l'entraînement
      const learnedPattern = this.learnedPatterns.get(normalizedNumber);
      if (learnedPattern && learnedPattern.cleaningType) {
        // Log si le pattern appris diffère de la détection dynamique
        if (room.cleaningType !== learnedPattern.cleaningType) {
          this.log(`🎓 Chambre ${room.roomNumber}: Pattern IA appris '${learnedPattern.cleaningType}' (override détection dynamique: '${room.cleaningType}')`);
        } else {
          this.log(`✅ Chambre ${room.roomNumber}: Pattern IA confirme '${learnedPattern.cleaningType}'`);
        }
        return {
          ...room,
          cleaningType: learnedPattern.cleaningType,
          status: learnedPattern.status || this.inferStatusFromCleaningType(learnedPattern.cleaningType),
          confidence: 92,
          validated: true,
          debugInfo: {
            ...room.debugInfo!,
            source: 'pattern' as const,
            appliedRule: `Pattern IA appris: ${learnedPattern.cleaningType}`,
            confidence: 92
          }
        };
      }
      
      // ======= PRIORITÉ 3: DÉTECTION DYNAMIQUE EXISTANTE =======
      // Si aucun pattern appris, utiliser la détection dynamique
      return {
        ...room,
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
   * Extrait les mots-clés d'une ligne pour correspondre aux patterns contextuels
   */
  private extractLineKeywords(text: string): string[] {
    const upper = text.toUpperCase();
    const keywords: string[] = [];
    
    // Dernière nuit - supporte "Night" (EN) et "Nuit" (FR)
    const lastNightMatch = upper.match(/(?:NIGHT|NUIT)\s*(\d+)\s*[\/\\]\s*(\d+)/);
    if (lastNightMatch && lastNightMatch[1] === lastNightMatch[2]) {
      keywords.push('DERNIERE_NUIT');
    } else if (lastNightMatch) {
      keywords.push('NUIT_INTERMEDIAIRE');
    }
    
    // Départ
    if (/\bDEP\b|DÉPART|DEPARTURE|CHECKOUT|C\/O/.test(upper)) {
      keywords.push('DEPART');
    }
    
    // Stayover
    if (/\bSTAYOVER|RECOUCHE|STAY|OCC\b/.test(upper)) {
      keywords.push('STAYOVER');
    }
    
    // Propre
    if (/\bPRO\b|PROPRE|CLEAN|READY|INS\b/.test(upper)) {
      keywords.push('PROPRE');
    }
    
    // Sale
    if (/\bSAL\b|SALE|DIRTY|DIR\b/.test(upper)) {
      keywords.push('SALE');
    }
    
    // Arrivée
    if (/\bARR\b|ARRIVÉE|ARRIVAL|CHECKIN|C\/I/.test(upper)) {
      keywords.push('ARRIVEE');
    }
    
    return keywords;
  }

  /**
   * Infère le statut depuis le type de nettoyage
   */
  private inferStatusFromCleaningType(cleaningType: CleaningType): string {
    switch (cleaningType) {
      case 'a_blanc':
      case 'full':
        return 'checkout';
      case 'recouche':
      case 'quick':
        return 'stayover';
      case 'none':
        return 'clean';
      default:
        return 'unknown';
    }
  }

  /**
   * Applique les mappings de statut personnalisés
   */
  private applyCustomMappings(rooms: ExtractedRoom[], text: string): ExtractedRoom[] {
    if (this.customStatusMappings.size === 0) return rooms;

    return rooms.map(room => {
      // NE PAS écraser le cleaningType des chambres validées comme "propres"
      // Si le pattern validé dit "none", on le respecte
      const normalizedNumber = this.normalizeRoomNumber(room.roomNumber);
      const learnedPattern = this.learnedPatterns.get(normalizedNumber);
      
      if (learnedPattern && learnedPattern.cleaningType === 'none') {
        // Chambre validée comme propre, ne pas écraser
        return room;
      }
      
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
