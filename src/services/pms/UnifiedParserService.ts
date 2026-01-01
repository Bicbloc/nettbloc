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
      for (const line of lines) {
        // Regex pour trouver le numéro de chambre dans la ligne
        // Gère les formats: "100", "100+101", "100-101", etc.
        const roomRegex = new RegExp(`\\b${this.escapeRegex(roomNumber)}\\b|\\b${this.escapeRegex(normalizedNumber)}\\b`, 'i');
        
        if (roomRegex.test(line)) {
          // Déterminer le statut et type de nettoyage à partir du contexte de la ligne
          const { status, cleaningType, reason } = this.analyzeLineContext(line, pmsType, reportDate);
          
          rooms.push({
            roomNumber,
            status,
            cleaningType,
            confidence: 90,
            validated: true,
            originalText: line.trim(),
            debugInfo: {
              rawLine: line,
              cleanedLine: line.trim(),
              detectedKeywords: [],
              source: 'pattern' as const,
              confidence: 90,
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
   * Analyse le contexte d'une ligne pour déterminer le statut et type de nettoyage
   * Utilise la date du rapport pour comparer avec les dates de départ
   */
  private analyzeLineContext(
    line: string, 
    pmsType: string,
    reportDate: Date | null = null
  ): { status: string; cleaningType: CleaningType; reason: string } {
    const upper = line.toUpperCase();
    
    // ====== RÈGLES MEWS SPÉCIFIQUES ======
    if (pmsType === 'mews') {
      // Checkout + Arrival (même ligne) = a_blanc prioritaire
      const hasDepOrDirty = /\b(DEP|DIR|DIRTY)\b/.test(upper);
      const hasArr = /\bARR\b/.test(upper);
      if (hasDepOrDirty && hasArr) {
        return { status: 'checkout_arrival', cleaningType: 'a_blanc', reason: 'DEP+ARR' };
      }
      
      // PRO = propre, pas de nettoyage
      if (/\bPRO\b/.test(upper)) {
        return { status: 'clean', cleaningType: 'none', reason: 'PRO (propre)' };
      }
      
      // INS = inspecté, pas de nettoyage
      if (/\bINS\b/.test(upper)) {
        return { status: 'inspected', cleaningType: 'none', reason: 'INS (inspecté)' };
      }
      
      // ====== LOGIQUE SAL (SALE) - AMÉLIORATION PRINCIPALE ======
      if (/\bSAL\b/.test(upper)) {
        // 1) Vérifier Nuit X/Y pour stayover vs checkout
        const nightMatch = upper.match(/NUIT\s*(\d+)\s*[\/\\]\s*(\d+)/i) || 
                          upper.match(/(\d+)\s*[\/\\]\s*(\d+)\s*NUIT/i);
        if (nightMatch) {
          const currentNight = parseInt(nightMatch[1]);
          const totalNights = parseInt(nightMatch[2]);
          if (currentNight < totalNights) {
            return { status: 'stayover', cleaningType: 'recouche', reason: `SAL + Nuit ${currentNight}/${totalNights} (recouche)` };
          } else {
            return { status: 'checkout', cleaningType: 'a_blanc', reason: `SAL + Nuit ${currentNight}/${totalNights} (départ)` };
          }
        }
        
        // 2) Utiliser la date de départ vs date du rapport
        // Mews affiche généralement la date d'arrivée dans le format "DD/MM/YYYY"
        const dateMatch = line.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (dateMatch && reportDate) {
          const [, day, month, year] = dateMatch;
          const foundDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          
          // Calculer la différence en jours
          const diffDays = Math.floor((reportDate.getTime() - foundDate.getTime()) / (1000 * 60 * 60 * 24));
          
          // Si la date trouvée est AVANT la date du rapport (client arrivé il y a X jours)
          // ET il n'y a pas d'heure de départ explicite → recouche
          // Si date == date du rapport → a_blanc (arrivée ou départ du jour)
          
          // Heuristique heure de départ: une heure en fin de ligne comme "12:00"
          const hasCheckoutTime = /\d{2}:\d{2}\s*$/.test(line.trim());
          
          if (diffDays === 0) {
            // Date = date du rapport → départ ou arrivée du jour
            if (hasCheckoutTime) {
              return { status: 'checkout', cleaningType: 'a_blanc', reason: `SAL + Date=${dateMatch[0]} (départ jour) + heure départ` };
            }
            // Date d'arrivée le jour même → recouche si client présent, sinon a_blanc
            const hasOccupancy = /\d+\s*×\s*Adultes/i.test(line);
            if (hasOccupancy && !hasCheckoutTime) {
              return { status: 'stayover', cleaningType: 'recouche', reason: `SAL + Date=${dateMatch[0]} (arrivée jour) + occupation` };
            }
            return { status: 'dirty', cleaningType: 'a_blanc', reason: `SAL + Date=${dateMatch[0]} (jour même)` };
          } else if (diffDays > 0) {
            // Date dans le passé → client en séjour (arrivé il y a X jours)
            if (hasCheckoutTime) {
              // Heure de départ présente → c'est un checkout prévu
              return { status: 'checkout', cleaningType: 'a_blanc', reason: `SAL + Date passée + heure départ → À blanc` };
            }
            return { status: 'stayover', cleaningType: 'recouche', reason: `SAL + Arrivée ${dateMatch[0]} (il y a ${diffDays}j) → Recouche` };
          } else {
            // Date dans le futur → arrivée prévue
            return { status: 'arrival', cleaningType: 'a_blanc', reason: `SAL + Arrivée future ${dateMatch[0]} → À blanc` };
          }
        }
        
        // 3) Heuristique: heure en fin de ligne = checkout prévu
        const hasCheckoutTimeSimple = /\d{2}:\d{2}\s*$/.test(line.trim());
        if (hasCheckoutTimeSimple) {
          return { status: 'checkout', cleaningType: 'a_blanc', reason: 'SAL + heure départ → À blanc' };
        }
        
        // 4) Heuristique: occupation sans heure = recouche
        const hasOccupancy = /\d+\s*×\s*Adultes/i.test(line);
        if (hasOccupancy) {
          return { status: 'stayover', cleaningType: 'recouche', reason: 'SAL + occupation (Adultes) → Recouche' };
        }
        
        // Default SAL sans plus d'info → recouche (plus conservateur)
        return { status: 'dirty', cleaningType: 'recouche', reason: 'SAL (défaut) → Recouche' };
      }
      
      // DEP seul = départ, a_blanc
      if (/\b(DEP|CHECKOUT|DÉPART)\b/.test(upper)) {
        return { status: 'checkout', cleaningType: 'a_blanc', reason: 'DEP/CHECKOUT' };
      }
      
      // DIR (dirty) = sale → recouche par défaut (pas a_blanc)
      if (/\bDIR\b/.test(upper)) {
        return { status: 'dirty', cleaningType: 'recouche', reason: 'DIR (sale)' };
      }
    }
    
    // ====== RÈGLES GÉNÉRIQUES ======
    // Checkout/Départ
    if (/\b(CHECKOUT|DÉPART|DEPARTURE|DEP|C\/O)\b/.test(upper)) {
      return { status: 'checkout', cleaningType: 'a_blanc', reason: 'checkout keyword' };
    }
    
    // Stayover/Recouche
    if (/\b(STAYOVER|RECOUCHE|STAY|OCC|OCCUPIED)\b/.test(upper)) {
      return { status: 'stayover', cleaningType: 'recouche', reason: 'stayover keyword' };
    }
    
    // Propre/Clean
    if (/\b(CLEAN|PROPRE|READY|INSPECTED|PRO|INS)\b/.test(upper)) {
      return { status: 'clean', cleaningType: 'none', reason: 'clean keyword' };
    }
    
    // Sale/Dirty
    if (/\b(DIRTY|SALE|SAL|DIR)\b/.test(upper)) {
      return { status: 'dirty', cleaningType: 'recouche', reason: 'dirty keyword' };
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
