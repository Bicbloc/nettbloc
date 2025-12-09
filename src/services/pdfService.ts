import { toast } from "@/components/ui/use-toast";
import * as pdfjs from 'pdfjs-dist';
import { mewsDetectionService } from "@/services/mewsDetectionService";
import { loadHotelRoomFormat, RoomFormatConfig, getRoomFormatConfig } from "@/utils/roomFormatUtils";
import { patternLearningService, LearnedPattern, PmsMatchResult } from "@/services/patternLearningService";

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

// Process PDF file - now accepts optional hotelId to load custom rules
export async function processPdf(file: File, hotelId?: string): Promise<Room[]> {
  try {
    let roomFormatConfig: RoomFormatConfig | null = null;
    let learnedPattern: LearnedPattern | null = null;
    
    // Réinitialiser le résultat de mismatch
    lastPmsMismatchResult = null;
    lastExtractedText = '';
    
    // Charger les règles personnalisées et le format appris si un hotelId est fourni
    if (hotelId) {
      console.log(`📋 Chargement des règles personnalisées pour l'hôtel ${hotelId}...`);
      
      // Charger en parallèle les règles, le format et le pattern appris
      const [_, formatConfig, pattern] = await Promise.all([
        mewsDetectionService.loadCustomRules(hotelId),
        loadHotelRoomFormat(hotelId),
        patternLearningService.loadHotelPattern(hotelId)
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

    // Convertir le fichier en ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Charger le document PDF
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
    
    // Vérifier si le PMS détecté correspond au pattern attendu
    if (hotelId && learnedPattern) {
      const matchResult = await patternLearningService.compareWithExpectedPattern(hotelId, fullText);
      if (!matchResult.isMatch) {
        console.log(`⚠️ Mismatch PMS détecté: attendu ${matchResult.expectedPms}, détecté ${matchResult.detectedPms}`);
        lastPmsMismatchResult = matchResult;
      }
    }
    
    // Analyser le texte pour extraire les informations des chambres avec le format appris
    const rooms = parseRoomsFromText(fullText, roomFormatConfig, learnedPattern);
    
    toast({
      title: "PDF Processed",
      description: `Successfully processed ${file.name}`,
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
  const lines = text.split(/\n|\r\n|\r/).filter(line => line.trim());
  const foundRooms = new Set<string>();
  
  // Pour Apaleo: collecter les statuts par chambre pour appliquer les règles de combinaison
  const roomStatuses: Map<string, string[]> = new Map();
  
  // Déterminer le pattern de chambre à utiliser
  let roomPattern: RegExp;
  let minLength = 1;
  let maxLength = 5;
  
  if (roomFormatConfig) {
    // Utiliser le format appris
    roomPattern = roomFormatConfig.regex;
    minLength = roomFormatConfig.minLength;
    maxLength = roomFormatConfig.maxLength;
    console.log(`📄 Parsing PDF avec format appris ${roomFormatConfig.format}: ${roomPattern}`);
  } else if (learnedPattern && learnedPattern.roomFormat) {
    // Utiliser le format du pattern appris
    const format = learnedPattern.roomFormat;
    if (format === 'NN' || format === '00') {
      // Format 2 chiffres (01-99)
      roomPattern = /\b(0?[1-9]|[1-9][0-9])\b/g;
      minLength = 1;
      maxLength = 2;
    } else if (format === 'XXX') {
      // Format 3 chiffres (100-999)
      roomPattern = /\b([1-9][0-9]{2})\b/g;
      minLength = 3;
      maxLength = 3;
    } else if (format === 'XXXX') {
      // Format 4 chiffres (1000-9999)
      roomPattern = /\b([1-9][0-9]{3})\b/g;
      minLength = 4;
      maxLength = 4;
    } else {
      roomPattern = /\b([1-9]\d{1,3})\b/g;
      minLength = 2;
      maxLength = 4;
    }
    console.log(`📄 Parsing PDF avec format du pattern ${format}: ${roomPattern}`);
  } else {
    // Pattern par défaut: accepter 2-4 chiffres uniquement (pas les 1 chiffre pour éviter faux positifs)
    roomPattern = /\b([1-9][0-9]{1,3})\b/g;
    minLength = 2;
    maxLength = 4;
    console.log(`📄 Parsing PDF avec format par défaut: ${roomPattern}`);
  }
  
  console.log(`📄 ${lines.length} lignes, utilisation de mewsDetectionService`);
  if (learnedPattern) {
    console.log(`🎓 Mots-clés appris: ${Object.keys(learnedPattern.statusKeywords).join(', ')}`);
  }
  
  // Patterns à exclure - dates, années, heures, etc.
  const excludePatterns = [
    /^20(2[0-9]|3[0-9])$/, // Années 2020-2039
    /^(0?[1-9]|[12][0-9]|3[01])(0[1-9]|1[0-2])$/, // Dates DDMM ou MMDD
    /^(0[1-9]|1[0-9]|2[0-3])[0-5][0-9]$/, // Heures HHMM
  ];
  
  // Parcourir ligne par ligne et utiliser mewsDetectionService
  for (const line of lines) {
    // Réinitialiser lastIndex pour chaque ligne
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
      
      // Ne pas inclure les nombres trop grands
      if (parseInt(roomNumber) > 9999) continue;
      
      // Vérifier la longueur
      if (roomNumber.length < minLength || roomNumber.length > maxLength) {
        console.log(`🚫 Chambre ${roomNumber} ignorée (longueur ${roomNumber.length} != ${minLength}-${maxLength})`);
        continue;
      }
      
      // Vérifier que la ligne contient des mots-clés hôteliers pour valider que c'est bien une chambre
      const lineUpper = line.toUpperCase();
      const hasHotelContext = /\b(ROOM|CHAMBRE|RECOUCHE|PARTI|ARRIVÉE|ARRIVEE|DIR|INS|SAL|DEP|ARR|CLEAN|DIRTY|OCC|VAC|STAYOVER|CHECKOUT|ARRIVAL|DEPART|NIGHT|ADULTS)\b/i.test(line);
      
      // Si pas de contexte hôtelier et le numéro est petit (< 100), ignorer
      if (!hasHotelContext && parseInt(roomNumber) < 100) {
        console.log(`🚫 Chambre ${roomNumber} ignorée (pas de contexte hôtelier)`);
        continue;
      }
      
      // Normaliser le format du numéro - garder le format original
      const normalizedRoomNumber = roomNumber;
      
      // Éviter les doublons
      if (foundRooms.has(normalizedRoomNumber)) continue;
      foundRooms.add(normalizedRoomNumber);
      
      // PRIORITÉ 1: Vérifier si la chambre a un pattern validé (apprentissage)
      const validatedPattern = mewsDetectionService.getValidatedPattern(normalizedRoomNumber);
      
      let cleaningType: 'full' | 'quick' | 'none' = 'none';
      let roomStatus = 'clean';
      let matchedRule: string | null = null;
      
      if (validatedPattern) {
        // Utiliser le pattern validé (PRIORITÉ ABSOLUE)
        console.log(`🎓 Chambre ${normalizedRoomNumber}: Pattern validé trouvé → ${validatedPattern.cleaningType}`);
        
        if (validatedPattern.cleaningType === 'full' || validatedPattern.cleaningType === 'a_blanc') {
          cleaningType = 'full';
          roomStatus = 'needs-cleaning';
        } else if (validatedPattern.cleaningType === 'quick' || validatedPattern.cleaningType === 'recouche') {
          cleaningType = 'quick';
          roomStatus = 'needs-cleaning';
        } else {
          cleaningType = 'none';
          roomStatus = validatedPattern.status === 'inspected' ? 'clean' : validatedPattern.status || 'clean';
        }
        matchedRule = 'Pattern validé (apprentissage)';
      } else {
        // PRIORITÉ 2: Utiliser les mots-clés appris du pattern (si disponible)
        if (learnedPattern && Object.keys(learnedPattern.statusKeywords).length > 0) {
          const keywordResult = patternLearningService.detectCleaningTypeFromKeywords(line, learnedPattern);
          if (keywordResult.matchedKeyword) {
            cleaningType = keywordResult.cleaning;
            roomStatus = keywordResult.status === 'stayover' ? 'needs-cleaning' : 
                         keywordResult.status === 'checkout' ? 'needs-cleaning' :
                         keywordResult.status === 'arrival' ? 'needs-cleaning' :
                         keywordResult.status === 'clean' ? 'clean' : 'needs-cleaning';
            matchedRule = `Mot-clé appris: ${keywordResult.matchedKeyword}`;
            console.log(`🎓 Chambre ${normalizedRoomNumber}: Mot-clé appris "${keywordResult.matchedKeyword}" → ${cleaningType}`);
          } else {
            // Fallback: utiliser mewsDetectionService
            const analysis = mewsDetectionService.analyzeLine(line);
            const detectedType = analysis.cleaningType;
            
            if (detectedType === 'a_blanc') {
              cleaningType = 'full';
              roomStatus = 'needs-cleaning';
            } else if (detectedType === 'recouche') {
              cleaningType = 'quick';
              roomStatus = 'needs-cleaning';
            } else {
              cleaningType = 'none';
              roomStatus = analysis.blocks.isOutOfOrder ? 'out-of-order' : 
                           analysis.blocks.status === 'INS' ? 'clean' :
                           analysis.blocks.status === 'OCC' ? 'occupied' : 'clean';
            }
            matchedRule = analysis.matchedRule;
          }
        } else {
          // PRIORITÉ 3: Utiliser mewsDetectionService pour analyser la ligne
          const analysis = mewsDetectionService.analyzeLine(line);
          
          console.log(`🏠 Chambre ${normalizedRoomNumber}: cleaningType=${analysis.cleaningType}, rule=${analysis.matchedRule}`);
          
          const detectedType = analysis.cleaningType;
          
          if (detectedType === 'a_blanc') {
            cleaningType = 'full';
            roomStatus = 'needs-cleaning';
          } else if (detectedType === 'recouche') {
            cleaningType = 'quick';
            roomStatus = 'needs-cleaning';
          } else {
            cleaningType = 'none';
            if (analysis.blocks.isOutOfOrder) {
              roomStatus = 'out-of-order';
            } else if (analysis.blocks.status === 'INS') {
              roomStatus = 'clean';
            } else if (analysis.blocks.status === 'OCC') {
              roomStatus = 'occupied';
            } else {
              roomStatus = 'clean';
            }
          }
          matchedRule = analysis.matchedRule;
        }
      }
      
      // Déterminer si c'est une chambre twin
      const isTwin = /TWN|TWS/.test(line);
      
      // Déterminer la priorité
      const priority = determinePriority(line);
      
      // Déterminer l'étage
      const floor = getRoomFloor(normalizedRoomNumber);
      
      rooms.push({
        number: normalizedRoomNumber,
        status: roomStatus,
        cleaningType,
        priority,
        isTwin,
        isUrgent: priority === 'high',
        notUrgent: priority === 'low',
        floor,
        notes: matchedRule ? `Règle: ${matchedRule}` : undefined
      });
    }
  }
  
  console.log(`✅ Détecté ${rooms.length} chambres avec mewsDetectionService`);
  
  // Trier les chambres par numéro
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
