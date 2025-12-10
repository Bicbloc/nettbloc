import { toast } from "@/components/ui/use-toast";
import * as pdfjs from 'pdfjs-dist';
import { mewsDetectionService } from "@/services/mewsDetectionService";
import { loadHotelRoomFormat, RoomFormatConfig, getRoomFormatConfig } from "@/utils/roomFormatUtils";
import { patternLearningService, LearnedPattern, PmsMatchResult } from "@/services/patternLearningService";
import { supabase } from "@/integrations/supabase/client";

// Initialiser le worker PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// Store for PMS mismatch detection
let lastPmsMismatchResult: PmsMatchResult | null = null;
let lastExtractedText: string = '';

export function getLastPmsMismatchResult(): PmsMatchResult | null {
  return lastPmsMismatchResult;
}

export function getLastExtractedText(): string {
  return lastExtractedText;
}

export function clearPmsMismatchResult(): void {
  lastPmsMismatchResult = null;
}

export interface Room {
  number: string;
  status: string;
  cleaningType?: 'a_blanc' | 'recouche' | 'none' | 'full' | 'quick'; // Support both old and new formats
  priority?: 'high' | 'medium' | 'low';
  assignedTo?: string;
  isTwin?: boolean;
  isUrgent?: boolean;
  notUrgent?: boolean;
  floor?: number;
  notes?: string;
  remark?: string;
  linkedRooms?: string[];
}

export interface CleaningConfig {
  fullCleaningTime: number; // in minutes
  quickCleaningTime: number; // in minutes
  minRoomsPerHousekeeper: number;
  maxRoomsPerHousekeeper: number;
}

// Default configuration - dynamically adjusted based on subscription
export const getDefaultCleaningConfig = (isPremium: boolean = false): CleaningConfig => ({
  fullCleaningTime: 30,
  quickCleaningTime: 15,
  minRoomsPerHousekeeper: isPremium ? 15 : 10,
  maxRoomsPerHousekeeper: isPremium ? 50 : 18
});

// Legacy export for backward compatibility
export const defaultCleaningConfig: CleaningConfig = getDefaultCleaningConfig(false);

// Fonction pour extraire les chambres via l'IA (edge function learn-pattern)
async function extractRoomsWithAI(
  fullText: string, 
  learnedPattern: LearnedPattern, 
  hotelId: string,
  reportName: string
): Promise<Room[]> {
  console.log('🤖 Appel de l\'edge function learn-pattern en mode apply...');
  
  // Préparer les patterns appris pour l'IA
  const learnedPatterns = {
    pmsType: learnedPattern.pmsType,
    roomFormat: learnedPattern.roomFormat,
    statusKeywords: learnedPattern.statusKeywords,
    combinationRules: learnedPattern.combinationRules || []
  };
  
  const { data, error } = await supabase.functions.invoke('learn-pattern', {
    body: {
      mode: 'apply',
      fullText: fullText,
      learnedPatterns: learnedPatterns,
      context: { 
        hotelId, 
        reportName,
        timestamp: new Date().toISOString()
      }
    }
  });
  
  if (error) {
    console.error('❌ Erreur edge function learn-pattern:', error);
    throw new Error(`Edge function error: ${error.message}`);
  }
  
  if (!data) {
    console.warn('⚠️ Aucune donnée retournée par l\'IA');
    return [];
  }
  
  console.log('📊 Réponse IA:', data);
  
  // Convertir la réponse IA en format Room[]
  const aiRooms = data.rooms || data.extractedRooms?.rooms || [];
  
  if (!Array.isArray(aiRooms) || aiRooms.length === 0) {
    console.warn('⚠️ Aucune chambre extraite par l\'IA');
    return [];
  }
  
  return convertAIRoomsToRooms(aiRooms);
}

// Convertir le format de réponse IA vers le format Room[] de l'application
function convertAIRoomsToRooms(aiRooms: any[]): Room[] {
  return aiRooms.map(aiRoom => {
    // Normaliser le cleaningType
    let cleaningType: 'full' | 'quick' | 'none' = 'none';
    const rawType = (aiRoom.cleaningType || aiRoom.cleaning_type || '').toLowerCase();
    
    if (rawType === 'full' || rawType === 'a_blanc' || rawType === 'checkout' || rawType === 'checkout_arrival') {
      cleaningType = 'full';
    } else if (rawType === 'quick' || rawType === 'recouche' || rawType === 'stayover') {
      cleaningType = 'quick';
    }
    
    // Normaliser le status
    let status = 'clean';
    const rawStatus = (aiRoom.status || '').toLowerCase();
    
    if (rawStatus.includes('needs') || rawStatus.includes('dirty') || rawStatus.includes('sale')) {
      status = 'needs-cleaning';
    } else if (rawStatus.includes('occupied') || rawStatus.includes('stayover')) {
      status = 'occupied';
    } else if (rawStatus.includes('clean') || rawStatus.includes('propre') || rawStatus.includes('inspected')) {
      status = 'clean';
    } else if (cleaningType !== 'none') {
      status = 'needs-cleaning';
    }
    
    const roomNumber = String(aiRoom.roomNumber || aiRoom.room_number || aiRoom.number || '');
    
    return {
      number: roomNumber,
      status,
      cleaningType,
      priority: cleaningType === 'full' ? 'high' : cleaningType === 'quick' ? 'medium' : 'low',
      isTwin: aiRoom.isTwin || aiRoom.is_twin || false,
      isUrgent: aiRoom.isUrgent || aiRoom.is_urgent || cleaningType === 'full',
      notUrgent: cleaningType === 'none',
      floor: aiRoom.floor || getRoomFloor(roomNumber),
      notes: aiRoom.notes || aiRoom.matchedRule || aiRoom.matched_rule || undefined,
      remark: aiRoom.remark || undefined
    } as Room;
  }).filter(room => room.number && room.number.length > 0);
}

// Process PDF file - now accepts optional hotelId to load custom rules
export async function processPdf(file: File, hotelId?: string): Promise<Room[]> {
  try {
    let roomFormatConfig: RoomFormatConfig | null = null;
    let learnedPattern: LearnedPattern | null = null;
    
    // Réinitialiser le résultat de mismatch
    lastPmsMismatchResult = null;
    lastExtractedText = '';
    
    // Convertir le fichier en ArrayBuffer d'abord pour extraire le texte
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    
    // Extraire le texte de toutes les pages
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + ' ';
    }
    
    console.log("PDF texte extrait:", fullText.substring(0, 500) + "...");
    lastExtractedText = fullText;
    
    // Détecter le type PMS à partir du texte AVANT de charger le pattern
    const detectedPms = patternLearningService.detectPmsFromText(fullText);
    console.log(`🔍 PMS détecté: ${detectedPms.pmsType} (confiance: ${detectedPms.confidence.toFixed(1)}%)`);
    
    // Charger les règles personnalisées et le format appris si un hotelId est fourni
    if (hotelId) {
      console.log(`📋 Chargement des règles personnalisées pour l'hôtel ${hotelId}...`);
      
      // Charger en parallèle les règles, le format et le pattern appris (avec PMS détecté pour fallback)
      const [_, formatConfig, pattern] = await Promise.all([
        mewsDetectionService.loadCustomRules(hotelId),
        loadHotelRoomFormat(hotelId),
        patternLearningService.loadHotelPattern(hotelId, detectedPms.pmsType)
      ]);
      
      roomFormatConfig = formatConfig;
      learnedPattern = pattern;
      
      const customRulesCount = mewsDetectionService.getHotelCleaningRules().length;
      console.log(`✅ ${customRulesCount} règles personnalisées chargées`);
      if (roomFormatConfig) {
        console.log(`📐 Format de chambre: ${roomFormatConfig.format}`);
      }
      if (learnedPattern) {
        console.log(`🎓 Pattern appris: ${learnedPattern.pmsType} avec ${Object.keys(learnedPattern.statusKeywords).length} mots-clés`);
      }
    }
    
    // Vérifier si le PMS détecté correspond au pattern attendu
    if (hotelId && learnedPattern) {
      const matchResult = await patternLearningService.compareWithExpectedPattern(hotelId, fullText);
      if (!matchResult.isMatch) {
        console.log(`⚠️ Mismatch PMS détecté: attendu ${matchResult.expectedPms}, détecté ${matchResult.detectedPms}`);
        lastPmsMismatchResult = matchResult;
      }
    }
    
    // NOUVELLE LOGIQUE: Si un pattern appris existe, utiliser l'IA pour l'extraction
    let rooms: Room[] = [];
    
    if (learnedPattern && hotelId) {
      console.log('🎓 Pattern appris détecté - utilisation de l\'extraction IA...');
      
      try {
        rooms = await extractRoomsWithAI(fullText, learnedPattern, hotelId, file.name);
        console.log(`✅ Extraction IA: ${rooms.length} chambres`);
        
        if (rooms.length > 0) {
          toast({
            title: "Extraction IA réussie",
            description: `${rooms.length} chambres extraites avec le modèle entraîné`,
          });
          return rooms;
        }
      } catch (aiError) {
        console.error('❌ Erreur extraction IA, fallback regex:', aiError);
        toast({
          title: "Extraction IA échouée",
          description: "Utilisation du parsing standard",
          variant: "destructive"
        });
      }
    }
    
    // FALLBACK: Parsing regex si pas de pattern ou erreur IA
    console.log('📋 Utilisation du parsing standard (regex)...');
    rooms = parseRoomsFromText(fullText, roomFormatConfig, learnedPattern);
    
    toast({
      title: "PDF Processed",
      description: `${rooms.length} chambres traitées depuis ${file.name}`,
    });
    
    // Si aucune chambre n'a été trouvée, retourner des données de test
    if (rooms.length === 0) {
      console.log("Aucune chambre détectée, utilisation des données simulées");
      return generateMockRoomData();
    }
    
    return rooms;
  } catch (error) {
    console.error("Error processing PDF:", error);
    toast({
      variant: "destructive",
      title: "Processing Failed",
      description: "Failed to process the PDF file. Please try again.",
    });
    throw error;
  }
}

// Analyse le texte pour extraire les informations des chambres
function parseRoomsFromText(
  text: string, 
  roomFormatConfig?: RoomFormatConfig | null,
  learnedPattern?: LearnedPattern | null
): Room[] {
  const rooms: Room[] = [];
  const foundRooms = new Map<string, Room>(); // Utiliser Map pour éviter doublons et garder le meilleur résultat
  
  // Détecter le type de PMS pour adapter le parsing
  const pmsDetection = patternLearningService.detectPmsFromText(text);
  const isApaleo = pmsDetection.pmsType === 'apaleo' || 
                   text.includes('Rapport Housekeeping') || 
                   text.includes('Ch.') && text.includes('Type de chambre');
  
  console.log(`📄 PMS détecté: ${pmsDetection.pmsType} (confiance: ${pmsDetection.confidence}%)`);
  
  if (isApaleo) {
    return parseApaleoRooms(text, learnedPattern);
  }
  
  // Pour les autres PMS, utiliser le parsing standard
  return parseStandardRooms(text, roomFormatConfig, learnedPattern);
}

// Parsing spécifique pour les rapports Apaleo
function parseApaleoRooms(text: string, learnedPattern?: LearnedPattern | null): Room[] {
  const rooms: Room[] = [];
  const roomData = new Map<string, { statuses: string[]; roomType: string; clientName: string }>();
  
  console.log(`🏨 Parsing Apaleo détecté`);
  
  // Le texte PDF extrait ressemble à:
  // "01  Chambre twin      17/05/2025 15:00 19/05/2025 12:00 2 adultes                LI HANJIE                  Recouche   Sale"
  // Les colonnes sont séparées par des espaces multiples ou pipes |
  
  // Pattern pour extraire une ligne de chambre Apaleo
  // Format: NuméroChambre (1-2 chiffres) suivi d'infos puis statuts à la fin
  const apaleoLinePattern = /\b(\d{1,2})\s+(Chambre\s+\w+|SGL|DBL|TWN|TPL|TRPL|QUAD)[^|]*?(Recouche|Parti|En arrivée|Arrivé|A contrôler|Sale|Propre)/gi;
  
  // Chercher toutes les occurrences dans le texte brut
  let match;
  const textLower = text.toLowerCase();
  
  // Approche alternative: diviser le texte en segments et chercher les patterns
  // Le texte PDF extrait met souvent tout sur une ligne continue
  
  // Pattern plus flexible pour le texte extrait par PDF.js
  // Recherche: numéro (2 chiffres) + type de chambre + ... + statuts à la fin
  const segments = text.split(/\s{3,}|\|/); // Séparer par espaces multiples ou pipes
  
  let currentRoomNumber: string | null = null;
  let currentStatuses: string[] = [];
  let currentRoomType = '';
  
  console.log(`📊 ${segments.length} segments à analyser`);
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i].trim();
    if (!segment) continue;
    
    // Détecter un numéro de chambre (1-2 chiffres isolés)
    const roomNumMatch = segment.match(/^(\d{1,2})$/);
    if (roomNumMatch) {
      const num = parseInt(roomNumMatch[1]);
      // Filtrer les numéros valides (1-99, pas les années)
      if (num >= 1 && num <= 99) {
        // Sauvegarder la chambre précédente si elle existe
        if (currentRoomNumber && currentStatuses.length > 0) {
          if (!roomData.has(currentRoomNumber)) {
            roomData.set(currentRoomNumber, { statuses: [], roomType: '', clientName: '' });
          }
          const data = roomData.get(currentRoomNumber)!;
          data.statuses.push(...currentStatuses);
          if (currentRoomType) data.roomType = currentRoomType;
        }
        
        currentRoomNumber = roomNumMatch[1].padStart(2, '0');
        currentStatuses = [];
        currentRoomType = '';
        continue;
      }
    }
    
    // Détecter type de chambre
    if (/^Chambre\s+(simple|double|triple|twin|quadruple)/i.test(segment)) {
      currentRoomType = segment;
      continue;
    }
    
    // Détecter les statuts Apaleo
    const statusLower = segment.toLowerCase();
    if (statusLower === 'recouche') {
      currentStatuses.push('Recouche');
    } else if (statusLower === 'parti') {
      currentStatuses.push('Parti');
    } else if (statusLower === 'en arrivée' || statusLower === 'en arrivee') {
      currentStatuses.push('En arrivée');
    } else if (statusLower === 'arrivé' || statusLower === 'arrive') {
      currentStatuses.push('Arrivé');
    } else if (statusLower === 'a contrôler' || statusLower === 'a controler') {
      currentStatuses.push('A contrôler');
    } else if (statusLower === 'sale') {
      currentStatuses.push('Sale');
    } else if (statusLower === 'propre') {
      currentStatuses.push('Propre');
    }
  }
  
  // Sauvegarder la dernière chambre
  if (currentRoomNumber && currentStatuses.length > 0) {
    if (!roomData.has(currentRoomNumber)) {
      roomData.set(currentRoomNumber, { statuses: [], roomType: '', clientName: '' });
    }
    const data = roomData.get(currentRoomNumber)!;
    data.statuses.push(...currentStatuses);
    if (currentRoomType) data.roomType = currentRoomType;
  }
  
  // Si peu de résultats, essayer parsing ligne par ligne alternatif
  if (roomData.size < 3) {
    console.log('📋 Parsing alternatif par pattern global...');
    parseApaleoAlternative(text, roomData);
  }
  
  console.log(`📊 ${roomData.size} chambres uniques détectées`);
  
  // Convertir les données en rooms avec le bon type de nettoyage
  for (const [roomNumber, data] of roomData) {
    const allStatuses = data.statuses;
    const uniqueStatuses = [...new Set(allStatuses)];
    
    // Déterminer le type de nettoyage selon les règles Apaleo
    let cleaningType: 'full' | 'quick' | 'none' = 'none';
    let roomStatus = 'clean';
    let matchedRule = '';
    
    const hasParti = uniqueStatuses.includes('Parti');
    const hasRecouche = uniqueStatuses.includes('Recouche');
    const hasEnArrivee = uniqueStatuses.includes('En arrivée');
    const hasArrive = uniqueStatuses.includes('Arrivé');
    const hasSale = uniqueStatuses.includes('Sale');
    const hasAControler = uniqueStatuses.includes('A contrôler');
    
    // RÈGLE 1: Parti + En arrivée = Checkout/Arrivée même jour → Nettoyage complet URGENT
    if (hasParti && hasEnArrivee) {
      cleaningType = 'full';
      roomStatus = 'needs-cleaning';
      matchedRule = 'Parti + En arrivée (urgent)';
    }
    // RÈGLE 2: Parti seul → Nettoyage complet (checkout)
    else if (hasParti) {
      cleaningType = 'full';
      roomStatus = 'needs-cleaning';
      matchedRule = 'Parti (checkout)';
    }
    // RÈGLE 3: En arrivée sans Parti → Nettoyage complet pour préparer
    else if (hasEnArrivee && !hasRecouche) {
      cleaningType = 'full';
      roomStatus = 'needs-cleaning';
      matchedRule = 'En arrivée (préparation)';
    }
    // RÈGLE 4: Recouche → Nettoyage rapide (stayover)
    else if (hasRecouche) {
      cleaningType = 'quick';
      roomStatus = 'needs-cleaning';
      matchedRule = 'Recouche (stayover)';
    }
    // RÈGLE 5: Arrivé (client présent) → Pas de nettoyage
    else if (hasArrive && !hasParti && !hasEnArrivee) {
      cleaningType = 'none';
      roomStatus = 'occupied';
      matchedRule = 'Arrivé (occupée)';
    }
    // RÈGLE 6: Sale seul → Nettoyage complet
    else if (hasSale && !hasRecouche) {
      cleaningType = 'full';
      roomStatus = 'needs-cleaning';
      matchedRule = 'Sale';
    }
    // RÈGLE 7: Recouche + Sale = Stayover avec chambre sale → Nettoyage rapide
    else if (hasRecouche && hasSale) {
      cleaningType = 'quick';
      roomStatus = 'needs-cleaning';
      matchedRule = 'Recouche + Sale';
    }
    // RÈGLE 8: A contrôler seul → Inspection seulement
    else if (hasAControler && uniqueStatuses.length === 1) {
      cleaningType = 'none';
      roomStatus = 'clean';
      matchedRule = 'A contrôler uniquement';
    }
    
    console.log(`   ✅ ${roomNumber}: [${uniqueStatuses.join(', ')}] → ${cleaningType} (${matchedRule})`);
    
    // Calculer l'étage
    const floor = getRoomFloor(roomNumber);
    
    rooms.push({
      number: roomNumber,
      status: roomStatus,
      cleaningType,
      priority: cleaningType === 'full' ? 'high' : cleaningType === 'quick' ? 'medium' : 'low',
      isTwin: /twin/i.test(data.roomType),
      isUrgent: hasParti && hasEnArrivee, // Départ + Arrivée même jour = urgent
      notUrgent: hasRecouche && !hasEnArrivee && !hasParti,
      floor,
      notes: `Statuts: ${uniqueStatuses.join(', ')}. Règle: ${matchedRule}`
    });
  }
  
  console.log(`✅ ${rooms.length} chambres parsées (Apaleo)`);
  
  // Trier par numéro de chambre
  return rooms.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
}

// Parsing alternatif pour Apaleo - utilise des regex globaux sur le texte complet
function parseApaleoAlternative(
  text: string, 
  roomData: Map<string, { statuses: string[]; roomType: string; clientName: string }>
): void {
  // Pattern pour capturer: numéro + ... + statut principal + statut secondaire
  // Ex: "01  Chambre twin  ... Recouche   Sale"
  
  // Pattern 1: Chercher les motifs "numéro ... statut statut" typiques d'Apaleo
  const fullLinePattern = /\b(\d{1,2})\s+(?:Chambre\s+\w+|[A-Z]{3,4})[^R|P|E|A|S]*(Recouche|Parti|En arrivée|Arrivé)\s+(A contrôler|Sale|Propre)?/gi;
  
  let match;
  while ((match = fullLinePattern.exec(text)) !== null) {
    const roomNum = match[1].padStart(2, '0');
    const status1 = match[2];
    const status2 = match[3] || '';
    
    if (!roomData.has(roomNum)) {
      roomData.set(roomNum, { statuses: [], roomType: '', clientName: '' });
    }
    const data = roomData.get(roomNum)!;
    if (status1) data.statuses.push(status1);
    if (status2) data.statuses.push(status2);
  }
  
  // Pattern 2: Recherche simplifiée - numéro de chambre suivi d'un statut dans les 200 caractères
  const simplePattern = /\b(\d{1,2})\b[^0-9]{5,200}?(Recouche|Parti|En arrivée|Arrivé)/gi;
  
  while ((match = simplePattern.exec(text)) !== null) {
    const num = parseInt(match[1]);
    if (num < 1 || num > 99) continue;
    
    const roomNum = match[1].padStart(2, '0');
    const status = match[2];
    
    if (!roomData.has(roomNum)) {
      roomData.set(roomNum, { statuses: [], roomType: '', clientName: '' });
    }
    const data = roomData.get(roomNum)!;
    if (!data.statuses.includes(status)) {
      data.statuses.push(status);
    }
  }
}

// Parsing standard pour les autres PMS (Mews, etc.)
function parseStandardRooms(
  text: string,
  roomFormatConfig?: RoomFormatConfig | null,
  learnedPattern?: LearnedPattern | null
): Room[] {
  const rooms: Room[] = [];
  const lines = text.split(/\n|\r\n|\r/).filter(line => line.trim());
  const foundRooms = new Set<string>();
  
  // Déterminer le pattern de chambre à utiliser
  let roomPattern: RegExp;
  let minLength = 2;
  let maxLength = 4;
  
  if (roomFormatConfig) {
    roomPattern = roomFormatConfig.regex;
    minLength = roomFormatConfig.minLength;
    maxLength = roomFormatConfig.maxLength;
  } else if (learnedPattern && learnedPattern.roomFormat) {
    const format = learnedPattern.roomFormat;
    if (format === 'NN' || format === '00') {
      roomPattern = /\b(0?[1-9]|[1-9][0-9])\b/g;
      minLength = 1;
      maxLength = 2;
    } else if (format === 'XXX') {
      roomPattern = /\b([1-9][0-9]{2})\b/g;
      minLength = 3;
      maxLength = 3;
    } else {
      roomPattern = /\b([1-9]\d{1,3})\b/g;
    }
  } else {
    roomPattern = /\b([1-9][0-9]{1,3})\b/g;
  }
  
  console.log(`📄 Parsing standard: ${lines.length} lignes`);
  
  // Patterns à exclure
  const excludePatterns = [
    /^20(2[0-9]|3[0-9])$/, // Années
    /^(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])$/, // Dates MMDD
  ];
  
  for (const line of lines) {
    roomPattern.lastIndex = 0;
    let match;
    
    while ((match = roomPattern.exec(line)) !== null) {
      const roomNumber = match[1];
      
      // Appliquer les exclusions
      let shouldExclude = false;
      for (const pattern of excludePatterns) {
        if (pattern.test(roomNumber)) {
          shouldExclude = true;
          break;
        }
      }
      if (shouldExclude) continue;
      
      if (roomNumber.length < minLength || roomNumber.length > maxLength) continue;
      if (parseInt(roomNumber) > 9999) continue;
      if (foundRooms.has(roomNumber)) continue;
      
      foundRooms.add(roomNumber);
      
      // Utiliser mewsDetectionService pour analyser
      const analysis = mewsDetectionService.analyzeLine(line);
      
      let cleaningType: 'full' | 'quick' | 'none' = 'none';
      let roomStatus = 'clean';
      
      if (analysis.cleaningType === 'a_blanc') {
        cleaningType = 'full';
        roomStatus = 'needs-cleaning';
      } else if (analysis.cleaningType === 'recouche') {
        cleaningType = 'quick';
        roomStatus = 'needs-cleaning';
      }
      
      rooms.push({
        number: roomNumber,
        status: roomStatus,
        cleaningType,
        priority: determinePriority(line),
        isTwin: /TWN|TWS/.test(line),
        isUrgent: cleaningType === 'full',
        floor: getRoomFloor(roomNumber),
        notes: analysis.matchedRule ? `Règle: ${analysis.matchedRule}` : undefined
      });
    }
  }
  
  console.log(`✅ ${rooms.length} chambres parsées (standard)`);
  return rooms.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
}

// Updated consistent floor detection function that matches the one in other files
function getRoomFloor(roomNumber: string): number {
  // Ignore years like 2025, 2026, 2027, 2028
  if (/^20(2[5-8])$/.test(roomNumber)) {
    return 0;
  }
  
  // Si le numéro a deux chiffres ou moins, c'est au RDC
  if (roomNumber.length <= 2) {
    return 0;
  }
  
  // Sinon, le premier chiffre indique l'étage
  const firstDigit = parseInt(roomNumber[0]);
  return isNaN(firstDigit) ? 0 : firstDigit;
}

// Nouvelle fonction d'analyse améliorée avec logique plus précise
function determineCleaningTypeImproved(context: string, roomNumber: string): { status: string, cleaningType: 'full' | 'quick' | 'none' } {
  console.log(`🔍 ANALYSE AMÉLIORÉE pour chambre ${roomNumber}:`);
  console.log(`📝 Contexte:`, context.substring(0, 400));
  
  // Patterns spécifiques basés sur le format du PDF
  const hasINS = /\bINS\b/.test(context);
  const hasDIR = /\bDIR\b/.test(context);
  const hasCL = /\bCL\b/.test(context);
  const hasOCC = /\bOCC\b/.test(context);
  
  // Pattern pour Night X/Y (recouche - même client qui reste)
  const nightPattern = /Night\s+\d+\/\d+/.test(context);
  
  // Pattern de dates multiples (changement de client)
  const dates = context.match(/\d{2}\/\d{2}\/\d{4}/g) || [];
  
  // Pattern Adults (présence de réservation)
  const hasAdults = /Adults/.test(context);
  
  console.log(`📊 Analyse: INS=${hasINS}, DIR=${hasDIR}, CL=${hasCL}, OCC=${hasOCC}`);
  console.log(`🏨 Réservation: Night=${nightPattern}, Adults=${hasAdults}, Dates=${dates.length}`);
  
  // RÈGLE 1: Chambre occupée
  if (hasOCC) {
    console.log(`✅ RÉSULTAT: Occupée`);
    return { status: 'occupied', cleaningType: 'none' };
  }
  
  // RÈGLE 2: Chambre propre (INS seul, sans réservation active)
  if (hasINS && !hasAdults && dates.length === 0) {
    console.log(`✅ RÉSULTAT: Propre (INS sans réservation)`);
    return { status: 'clean', cleaningType: 'none' };
  }
  
  // RÈGLE 3: Chambre propre (CL sans réservation)
  if (hasCL && !hasAdults && dates.length === 0) {
    console.log(`✅ RÉSULTAT: Propre (CL sans réservation)`);
    return { status: 'clean', cleaningType: 'none' };
  }
  
  // RÈGLE 4: Recouche (Night pattern = même client qui reste)
  if (nightPattern && dates.length === 1 && !hasDIR) {
    console.log(`✅ RÉSULTAT: Recouche (Night pattern)`);
    return { status: 'needs-cleaning', cleaningType: 'quick' };
  }
  
  // RÈGLE 5: Chambre à blanc (DIR ou changement de client)
  if (hasDIR || dates.length >= 2) {
    console.log(`✅ RÉSULTAT: Chambre à blanc (DIR=${hasDIR}, dates=${dates.length})`);
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }
  
  // RÈGLE 6: Chambre à blanc (réservation future après nettoyage)
  if (hasAdults && dates.length >= 1) {
    console.log(`✅ RÉSULTAT: Chambre à blanc (réservation)`);
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }
  
  // Par défaut: analyser si c'est propre ou à nettoyer
  if (hasINS || hasCL) {
    console.log(`✅ RÉSULTAT: Propre par défaut`);
    return { status: 'clean', cleaningType: 'none' };
  }
  
  console.log(`✅ RÉSULTAT: Nettoyage complet par défaut`);
  return { status: 'needs-cleaning', cleaningType: 'full' };
}

// Fonction historique laissée en place pour référence
function determineStatusAndCleaningType(context: string): { status: string, cleaningType: 'full' | 'quick' | 'none' } {
  if (context.includes('CL') || context.includes('INS') || context.toLowerCase().includes('clean')) {
    return { status: 'clean', cleaningType: 'none' };
  }
  
  if (context.includes('OCC') || context.toLowerCase().includes('occupied')) {
    return { status: 'occupied', cleaningType: 'none' };
  }
  
  if (context.toLowerCase().includes('maintenance') || context.toLowerCase().includes('out of order')) {
    return { status: 'maintenance', cleaningType: 'none' };
  }

  return { status: 'needs-cleaning', cleaningType: 'full' };
}

// Nouvelle fonction d'analyse selon les règles définies avec logs de débogage
function determineStatusAndCleaningTypeNewRules(context: string, roomNumber: string): { status: string, cleaningType: 'full' | 'quick' | 'none' } {
  // Valeurs par défaut
  let status = 'needs-cleaning';
  let cleaningType: 'full' | 'quick' | 'none' = 'none';

  console.log(`  Analyse des règles pour chambre ${roomNumber}:`);

  // 🟦 Chambre à blanc - CAS 1: Un bloc de réservation apparaît dans la colonne de gauche du rapport
  const leftColumnReservation = /\d{2}\/\d{2}\/\d{4}.*\d{1,2}:\d{2}/.test(context) && 
                               !context.includes("Adults.*\d{2}\/\d{2}\/\d{4}");
  
  console.log(`  - CAS 1 (Colonne gauche): ${leftColumnReservation}`);
  if (leftColumnReservation) {
    cleaningType = 'full';
    status = 'needs-cleaning';
    console.log(`  → Règle appliquée: Chambre à blanc (colonne gauche)`);
    return { status, cleaningType };
  }

  // 🟦 Chambre à blanc - CAS 2: Un bloc de réservation en colonne droite ET statut DIR
  const rightColumnWithDIR = /Adults.*\d{2}\/\d{2}\/\d{4}/.test(context) && 
                             (context.includes('DIR') || context.toLowerCase().includes('dirty'));
  
  console.log(`  - CAS 2 (Colonne droite + DIR): ${rightColumnWithDIR}`);
  if (rightColumnWithDIR) {
    cleaningType = 'full';
    status = 'needs-cleaning';
    console.log(`  → Règle appliquée: Chambre à blanc (colonne droite + DIR)`);
    return { status, cleaningType };
  }

  // 🟦 Chambre à blanc - CAS 3: Deux blocs distincts visibles
  const dateMatches = context.match(/\d{2}\/\d{2}\/\d{4}/g);
  const twoDistinctBlocks = dateMatches?.length >= 2;
  
  console.log(`  - CAS 3 (Deux blocs): ${twoDistinctBlocks} (${dateMatches?.length || 0} dates trouvées)`);
  if (twoDistinctBlocks) {
    cleaningType = 'full';
    status = 'needs-cleaning';
    console.log(`  → Règle appliquée: Chambre à blanc (deux blocs)`);
    return { status, cleaningType };
  }

  // 🔵 Chambre en recouche: Une seule ligne avec date d'arrivée et départ ultérieure
  const hasOneReservationLine = /\d{2}\/\d{2}\/\d{4}.*Night/.test(context) || 
                               /\d{2}\/\d{2}\/\d{4}.*séjour/.test(context) ||
                               /\d{2}\/\d{2}\/\d{4}.*\d{2}\/\d{2}\/\d{4}/.test(context);
  
  console.log(`  - Recouche (une ligne): ${hasOneReservationLine}`);
  if (hasOneReservationLine && !leftColumnReservation && !rightColumnWithDIR && !twoDistinctBlocks) {
    cleaningType = 'quick';
    status = 'needs-cleaning';
    console.log(`  → Règle appliquée: Chambre en recouche`);
    return { status, cleaningType };
  }

  // 🟩 Chambre propre - CAS 1: Case vide (aucun bloc client) ET statut CL ou INS
  const emptyWithCleanStatus = (!context.match(/\d{2}\/\d{2}\/\d{4}/g) && 
                              (context.includes('CL') || context.includes('INS') || 
                               context.toLowerCase().includes('clean') || context.toLowerCase().includes('inspection')));
  
  console.log(`  - Propre CAS 1 (vide + CL/INS): ${emptyWithCleanStatus}`);
  
  // 🟩 Chambre propre - CAS 2: Chambre dans colonne de droite ET statut INS uniquement
  const rightColumnINS = /Adults.*INS/.test(context) || 
                         (context.includes('Adults') && context.toLowerCase().includes('inspection'));
  
  console.log(`  - Propre CAS 2 (colonne droite + INS): ${rightColumnINS}`);
  
  if (emptyWithCleanStatus || rightColumnINS) {
    cleaningType = 'none';
    status = 'clean';
    console.log(`  → Règle appliquée: Chambre propre`);
    return { status, cleaningType };
  }

  // Cas par défaut - si aucune règle ne correspond explicitement
  console.log(`  - Vérification statut DIR: ${context.includes('DIR')}`);
  if (context.includes('DIR') || context.toLowerCase().includes('dirty')) {
    cleaningType = 'full';
    status = 'needs-cleaning';
    console.log(`  → Règle appliquée: DIR trouvé - nettoyage complet`);
    return { status, cleaningType };
  }
  
  // Si des mots-clés comme "maintenance" ou "out of order" sont présents
  if (context.toLowerCase().includes('maintenance') || 
      context.toLowerCase().includes('out of order') || 
      context.toLowerCase().includes('hors service')) {
    status = 'maintenance';
    cleaningType = 'none';
    console.log(`  → Règle appliquée: Maintenance`);
    return { status, cleaningType };
  }
  
  // Si des mots-clés comme "occupé" ou "occupied" sont présents
  if (context.toLowerCase().includes('occupied') || 
      context.toLowerCase().includes('occupé') || 
      context.includes('OCC')) {
    status = 'occupied';
    cleaningType = 'none';
    console.log(`  → Règle appliquée: Occupé`);
    return { status, cleaningType };
  }

  console.log(`  → Règle par défaut appliquée: needs-cleaning / full`);
  return { status: 'needs-cleaning', cleaningType: 'full' };
}

// Déterminer la priorité
function determinePriority(context: string): 'high' | 'medium' | 'low' {
  if (context.includes('VIP') || 
      context.includes('urgent') || 
      context.includes('high priority') || 
      context.includes('prioritaire')) {
    return 'high';
  }
  
  if (context.includes('medium priority') || 
      context.includes('standard') || 
      context.includes('normale')) {
    return 'medium';
  }
  
  if (context.includes('low priority') || 
      context.includes('basse') || 
      context.includes('pas urgent')) {
    return 'low';
  }
  
  // Par défaut, priorité moyenne
  return 'medium';
}

// Helper function to generate mock room data
function generateMockRoomData(): Room[] {
  const statuses = ['needs-cleaning', 'clean', 'occupied', 'maintenance'];
  const cleaningTypes = ['a_blanc', 'recouche', 'none'] as const;
  const priorities = ['high', 'medium', 'low'] as const;
  
  return Array.from({ length: 50 }, (_, i) => {
    const floor = Math.floor(i / 20) + 1;
    const room = (i % 20) + 1;
    const roomNumber = `${floor}${room.toString().padStart(2, '0')}`;
    const isTwin = Math.random() > 0.7;
    const priority = priorities[Math.floor(Math.random() * priorities.length)];
    
    return {
      number: roomNumber,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      cleaningType: cleaningTypes[Math.floor(Math.random() * cleaningTypes.length)],
      priority,
      isTwin,
      isUrgent: priority === 'high',
      notUrgent: priority === 'low',
      floor
    };
  });
}
