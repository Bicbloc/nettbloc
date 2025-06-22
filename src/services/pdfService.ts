import { toast } from "@/components/ui/use-toast";
import * as pdfjs from 'pdfjs-dist';
import { processImageWithDonut, parseDonutOutput } from './donutService';

// Initialiser le worker PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export interface Room {
  number: string;
  status: string;
  cleaningType: 'full' | 'quick' | 'none';
  priority: 'high' | 'medium' | 'low';
  assignedTo?: string;
  isTwin?: boolean;
  isUrgent?: boolean;
  notUrgent?: boolean;
  floor?: number;
  notes?: string; // Added notes property
}

export interface CleaningConfig {
  fullCleaningTime: number; // in minutes
  quickCleaningTime: number; // in minutes
  minRoomsPerHousekeeper: number;
  maxRoomsPerHousekeeper: number;
}

// Interface pour l'analyse détaillée des blocs
interface BlockAnalysis {
  layout: 'empty' | 'centered' | 'left_only' | 'right_only' | 'left_and_right' | 'left_center_right';
  blocks: string[];
  departureDate?: Date | null;
  arrivalDate?: Date | null;
  hasMaintenanceKeywords: boolean;
  hasCleaningKeyword: boolean;
}

// Default configuration
export const defaultCleaningConfig: CleaningConfig = {
  fullCleaningTime: 30,
  quickCleaningTime: 15,
  minRoomsPerHousekeeper: 10,
  maxRoomsPerHousekeeper: 18
};

// Date du rapport (configurable)
const REPORT_DATE_STRING = "06/05/2025";
const reportDate = new Date(
  parseInt(REPORT_DATE_STRING.split("/")[2]),
  parseInt(REPORT_DATE_STRING.split("/")[1]) - 1,
  parseInt(REPORT_DATE_STRING.split("/")[0])
);

// Process PDF file
export async function processPdf(file: File): Promise<Room[]> {
  try {
    // Convertir le fichier en ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Essayer d'abord avec le modèle Donut pour une meilleure reconnaissance
    try {
      console.log("Tentative de reconnaissance avec le modèle Donut...");
      const donutText = await processImageWithDonut(arrayBuffer);
      const donutResult = parseDonutOutput(donutText);
      
      if (donutResult.rooms && donutResult.rooms.length > 0) {
        console.log(`Détecté ${donutResult.rooms.length} chambres avec Donut`);
        return donutResult.rooms;
      }
    } catch (donutError) {
      console.warn("Échec de la reconnaissance Donut, repli sur PDF.js:", donutError);
    }
    
    // Méthode de repli avec PDF.js
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
    
    // Détecter le type de rapport
    const isHotelKornerFormat = fullText.includes("Rapport Housekeeping - Hôtel Korner") || 
                               fullText.includes("Toutes les chambres en statut tous") ||
                               (fullText.includes("Ch.") && fullText.includes("Type de chambre") && fullText.includes("Arrivée") && fullText.includes("Départ"));
    
    console.log("Format détecté:", isHotelKornerFormat ? "Hôtel Korner" : "Format standard");
    
    // Analyser le texte pour extraire les informations des chambres selon le format
    let rooms: Room[] = [];
    
    if (isHotelKornerFormat) {
      rooms = parseHotelKornerFormat(fullText);
    } else {
      rooms = parseRoomsFromText(fullText);
    }
    
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

// Nouveau parser pour le format Hôtel Korner
function parseHotelKornerFormat(text: string): Room[] {
  const rooms: Room[] = [];
  console.log("Analyse du format Hôtel Korner...");
  
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  
  let currentRoom: Partial<Room> | null = null;
  let currentRoomNumber = '';
  let additionalNotes = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.includes("Rapport Housekeeping") || line.includes("Ch.  Type de chambre") || line === '') {
      continue;
    }
    
    const roomMatch = line.match(/^(\d{2})\s+/);
    
    if (roomMatch) {
      if (currentRoom) {
        if (additionalNotes.length > 0) {
          currentRoom.notes = additionalNotes.join(' ');
        }
        rooms.push(currentRoom as Room);
        additionalNotes = [];
      }
      
      const roomNumber = roomMatch[1].padStart(3, '0');
      currentRoomNumber = roomNumber;
      
      const isTwin = line.toLowerCase().includes('twin');
      
      // Utiliser la nouvelle logique de classification
      const { status, cleaningType } = determineStatusAndCleaningType(line);
      const priority = determinePriority(line);
      const floor = getRoomFloor(roomNumber);
      
      currentRoom = {
        number: roomNumber,
        status: status,
        cleaningType: cleaningType,
        priority: priority,
        isTwin: isTwin,
        isUrgent: priority === 'high',
        notUrgent: priority === 'low',
        floor: floor
      };
      
      console.log(`Chambre ${roomNumber}: Status=${status}, CleaningType=${cleaningType}, Line="${line}"`);
    } else if (currentRoom) {
      additionalNotes.push(line);
    }
  }
  
  if (currentRoom) {
    if (additionalNotes.length > 0) {
      currentRoom.notes = additionalNotes.join(' ');
    }
    rooms.push(currentRoom as Room);
  }
  
  console.log(`Détecté ${rooms.length} chambres avec le format Hôtel Korner`);
  return rooms.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
}

// Analyse le texte pour extraire les informations des chambres
function parseRoomsFromText(text: string): Room[] {
  const rooms: Room[] = [];
  
  // Patterns améliorés pour détecter les numéros de chambre dans différents formats
  // Ajout de nouveaux patterns pour capturer plus de formats de numéros de chambre
  const patterns = [
    /\b(Spaces|Espace)\s+(\d{3})\b/gi,
    /\b([1-9]\d{2})\s+(SGL|DBL|TWN|DIR|CL|INS|SP|DX|CB|TWS|DBS)\b/gi,  // Ajout de TWS et DBS au pattern
    /\b([1-9]\d{2})\b(?=\s*[A-Z]{2,3})/g,
    /\b(Room|Chambre)\s+(\d{3})\b/gi,
    /\b([1-9]\d{2})\s*-\s*[A-Z]/gi, // Format 101-A
    /\b(No\.|N°)\s*(\d{3})\b/gi,     // Format No. 101 ou N° 101
    /\b(\d{3})\s*\(/gi,              // Format 101 (quelque chose)
    /\b(\d{1,2})(\d{2})\b(?!\d)/g,   // Capture numéro de chambre simple comme 101
    /^(\d{2})\s+Chambre/mi,          // Nouveau pattern pour format Hotel Korner: "01 Chambre..."
    /^Ch\.\s+(\d{2})\b/mi            // Nouveau pattern pour "Ch. 01" en début de ligne
  ];
  
  // Utiliser chaque pattern pour trouver les numéros de chambre
  const foundRooms = new Set();
  
  for (const pattern of patterns) {
    let match;
    pattern.lastIndex = 0; // Réinitialiser l'index pour chaque nouvelle recherche
    
    while ((match = pattern.exec(text)) !== null) {
      // Récupérer le numéro de chambre correctement selon le pattern utilisé
      let roomNumber;
      
      if (match[1] === 'Spaces' || match[1] === 'Espace' || match[1] === 'Room' || match[1] === 'Chambre' || match[1] === 'No.' || match[1] === 'N°' || match[1] === 'Ch.') {
        roomNumber = match[2] || match[1];
      } else if (pattern.source.includes('\\d{1,2})(\\d{2})')) {
        // Pour le pattern qui capture le numéro de chambre directement
        roomNumber = match[0];
      } else {
        roomNumber = match[1];
      }
      
      // Vérifier que le numéro de chambre est un nombre valide
      if (!/^\d+$/.test(roomNumber)) continue;
      
      // Ne pas inclure les années comme 2025, 2026, 2027, 2028 comme chambres
      if (/^20(2[5-8])$/.test(roomNumber)) continue;
      
      // Normaliser le format du numéro (éliminer les zéros au début mais assurer au moins 3 chiffres)
      roomNumber = String(parseInt(roomNumber, 10)).padStart(3, '0');
      
      // Éviter les doublons
      if (foundRooms.has(roomNumber)) continue;
      foundRooms.add(roomNumber);
      
      // Extraire le contexte autour du numéro de chambre (un plus grand contexte pour mieux analyser)
      const start = Math.max(0, match.index - 200);
      const end = Math.min(text.length, match.index + 200);
      const context = text.substring(start, end);
      
      // Analyser le statut et le type de nettoyage selon les règles définies
      const { status, cleaningType } = determineStatusAndCleaningType(context);
      
      // Déterminer si c'est une chambre twin
      const isTwin = context.includes('TWN') || context.toLowerCase().includes('twin') || context.includes('TWIN') || context.includes('TWS');
      
      // Déterminer la priorité
      const priority = determinePriority(context);
      
      // Déterminer l'étage
      const floor = getRoomFloor(roomNumber);
      
      rooms.push({
        number: roomNumber,
        status,
        cleaningType,
        priority,
        isTwin,
        isUrgent: priority === 'high',
        notUrgent: priority === 'low',
        floor
      });
    }
  }
  
  console.log(`Détecté ${rooms.length} chambres avec le parsing avancé`);
  
  // Deuxième passe pour essayer de trouver plus de numéros de chambres
  // Cette fois avec un pattern très générique mais qui vérifie si le nombre pourrait être une chambre
  const genericRoomPattern = /\b(\d{2,3})\b/g;
  let genericMatch;
  
  while ((genericMatch = genericRoomPattern.exec(text)) !== null) {
    const potentialRoomNumber = genericMatch[1];
    
    // Vérifier que ce n'est pas un nombre qui fait partie d'une date, heure, etc.
    const beforeText = text.substring(Math.max(0, genericMatch.index - 10), genericMatch.index);
    const afterText = text.substring(genericMatch.index + potentialRoomNumber.length, Math.min(text.length, genericMatch.index + potentialRoomNumber.length + 10));
    
    // Ignorer si ce semble être une date, heure, prix, etc.
    if (beforeText.match(/\d[\/\-\.:]$/) || afterText.match(/^[\/\-\.:]/) || 
        beforeText.match(/\$|€|£|\d+[.,]\d+$/) || afterText.match(/^[.,]\d+/)) {
      continue;
    }
    
    // Ne pas inclure les années comme 2025, 2026, 2027, 2028 comme chambres
    if (/^20(2[5-8])$/.test(potentialRoomNumber)) continue;
    
    // Normaliser le format et vérifier qu'il n'est pas déjà trouvé
    const roomNumber = String(parseInt(potentialRoomNumber, 10)).padStart(3, '0');
    if (foundRooms.has(roomNumber)) continue;
    
    // Inclure seulement si le premier chiffre est 0-9 (étage plausible)
    const firstDigit = parseInt(roomNumber[0]);
    if (firstDigit > 9) continue;
    
    foundRooms.add(roomNumber);
    
    // Extraire le contexte pour l'analyse
    const start = Math.max(0, genericMatch.index - 200);
    const end = Math.min(text.length, genericMatch.index + 200);
    const context = text.substring(start, end);
    
    const { status, cleaningType } = determineStatusAndCleaningType(context);
    const isTwin = context.includes('TWN') || context.toLowerCase().includes('twin') || context.includes('TWIN') || context.includes('TWS');
    const priority = determinePriority(context);
    const floor = getRoomFloor(roomNumber);
    
    rooms.push({
      number: roomNumber,
      status,
      cleaningType,
      priority,
      isTwin,
      isUrgent: priority === 'high',
      notUrgent: priority === 'low',
      floor
    });
  }
  
  console.log(`Détecté ${rooms.length} chambres avec le parsing avancé`);
  
  // Trier les chambres par numéro
  return rooms.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
}

// Updated consistent floor detection function that matches the one in other files
function getRoomFloor(roomNumber: string): number {
  // Ignore years like 2025, 2026, 2027, 2028
  if (/^20(2[5-8])$/.test(roomNumber)) {
    return 0; // Considérer comme RDC
  }
  
  // Si le numéro a deux chiffres ou moins, c'est au RDC
  if (roomNumber.length <= 2) {
    return 0;
  }
  
  // Sinon, le premier chiffre indique l'étage
  const firstDigit = parseInt(roomNumber[0]);
  return isNaN(firstDigit) ? 0 : firstDigit;
}

// Fonction améliorée pour extraire les informations de réservation après l'assigné
function extractReservationInfoAfterAssignee(context: string): string {
  // Chercher après le nom de l'assigné (format: "NOM Prenom")
  const assigneePattern = /([A-Z][A-Z]+\s+[A-Z][a-z]+)\s+(.+)$/;
  const match = context.match(assigneePattern);
  
  if (match && match[2]) {
    return match[2].trim();
  }
  
  // Fallback: chercher après les patterns de dates ou heures
  const fallbackPattern = /(?=\s*\d{1,2}\/\d{1,2}\/\d{4}|\s*\d{2}:\d{2}|\s*Night|\s*Cleaning)(.+)$/;
  const fallbackMatch = context.match(fallbackPattern);
  
  if (fallbackMatch && fallbackMatch[1]) {
    return fallbackMatch[1].trim();
  }
  
  return "";
}

// Fonction pour segmenter les informations de réservation
function segmentReservationInfo(reservationInfo: string): string[] {
  if (!reservationInfo.trim()) return [];
  
  // Patterns pour identifier les segments
  const patterns = [
    /Night\s+\d+\/\d+\s+\d{1,2}\/\d{1,2}\/\d{4}/gi, // Night X/Y DD/MM/YYYY
    /\d{1,2}\/\d{1,2}\/\d{4}\s+\d+\s*[x×]\s*Adults.*?\d{2}:\d{2}/gi, // Date + Adults + Heure (départ)
    /\d{2}:\d{2}.*?\d+\s*[x×]\s*Adults.*?\d{1,2}\/\d{1,2}\/\d{4}/gi, // Heure + Adults + Date (arrivée)
    /Cleaning/gi,
    /Out of order/gi
  ];
  
  const segments = [];
  let remaining = reservationInfo;
  
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(remaining)) !== null) {
      segments.push(match[0]);
      remaining = remaining.replace(match[0], '').trim();
      pattern.lastIndex = 0;
    }
  }
  
  // Si il reste du texte non matché, l'ajouter
  if (remaining.trim()) {
    segments.push(remaining.trim());
  }
  
  return segments.filter(s => s.trim() !== '');
}

// Fonctions d'analyse des types de blocs
function isLikelyCenteredBlock(segmentText: string): boolean {
  return /Night\s+\d+\/\d+\s+\d{1,2}\/\d{1,2}\/\d{4}/i.test(segmentText);
}

function isLikelyLeftBlockDeparture(segmentText: string): boolean {
  // Pattern pour départ: commence par date, contient adults, finit par heure
  return /^\d{1,2}\/\d{1,2}\/\d{4}.*\d+\s*[x×]\s*Adults.*\d{2}:\d{2}$/i.test(segmentText);
}

function isLikelyRightBlockArrival(segmentText: string): boolean {
  // Pattern pour arrivée: commence par heure, contient adults, finit par date
  return /^\d{2}:\d{2}.*\d+\s*[x×]\s*Adults.*\d{1,2}\/\d{1,2}\/\d{4}$/i.test(segmentText);
}

// Fonctions d'extraction de dates
function extractDepartureDateFromCenteredBlock(segmentText: string): Date | null {
  const nightPattern = /Night\s+\d+\/\d+\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i;
  const match = segmentText.match(nightPattern);
  
  if (match) {
    const day = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    const year = parseInt(match[3]);
    return new Date(year, month, day);
  }
  
  return extractDepartureDateFromGenericBlock(segmentText);
}

function extractDateFromLeftBlock(segmentText: string): Date | null {
  const datePattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
  const match = segmentText.match(datePattern);
  
  if (match) {
    const day = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    const year = parseInt(match[3]);
    return new Date(year, month, day);
  }
  
  return null;
}

function extractDateFromRightBlock(segmentText: string): Date | null {
  const dates = segmentText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g);
  if (dates && dates.length > 0) {
    const lastDate = dates[dates.length - 1];
    const match = lastDate.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]) - 1;
      const year = parseInt(match[3]);
      return new Date(year, month, day);
    }
  }
  
  return null;
}

function extractDepartureDateFromGenericBlock(segmentText: string): Date | null {
  const dates = segmentText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g);
  if (dates && dates.length > 0) {
    const lastDate = dates[dates.length - 1];
    const match = lastDate.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]) - 1;
      const year = parseInt(match[3]);
      return new Date(year, month, day);
    }
  }
  
  return null;
}

// Nouvelle fonction améliorée pour analyser les blocs de réservation
function analyzeReservationBlocks(context: string): BlockAnalysis {
  console.log("=== ANALYSE DES BLOCS ===");
  console.log("Contexte:", context.substring(0, 300));
  
  const maintenanceKeywords = ['out of order', 'hors d\'usage', 'punaises de lit', 'inutilisable', 'block', 'maintenance'];
  const hasMaintenanceKeywords = maintenanceKeywords.some(keyword => 
    context.toLowerCase().includes(keyword.toLowerCase())
  );
  
  const hasCleaningKeyword = /\bcleaning\b/i.test(context);
  
  if (hasMaintenanceKeywords || hasCleaningKeyword) {
    console.log("→ Détecté: Maintenance ou Cleaning explicite");
    return {
      layout: 'centered',
      blocks: [context],
      departureDate: null,
      arrivalDate: null,
      hasMaintenanceKeywords,
      hasCleaningKeyword
    };
  }
  
  // Extraction des informations client après l'assigné
  const reservationInfo = extractReservationInfoAfterAssignee(context);
  console.log("Info réservation extraite:", reservationInfo);
  
  if (!reservationInfo.trim()) {
    console.log("→ Layout: EMPTY (pas d'info client)");
    return {
      layout: 'empty',
      blocks: [],
      departureDate: null,
      arrivalDate: null,
      hasMaintenanceKeywords: false,
      hasCleaningKeyword: false
    };
  }
  
  // Analyser les patterns dans les informations de réservation
  const segments = segmentReservationInfo(reservationInfo);
  console.log("Segments détectés:", segments);
  
  let layout: BlockAnalysis['layout'] = 'centered';
  let departureDate: Date | null = null;
  let arrivalDate: Date | null = null;
  
  if (segments.length === 1) {
    const segment = segments[0];
    
    // Pattern "Night X/Y DD/MM/YYYY" = bloc centré avec départ
    if (/Night\s+\d+\/\d+\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i.test(segment)) {
      layout = 'centered';
      departureDate = extractDepartureDateFromCenteredBlock(segment);
      console.log("→ Layout: CENTERED (Night pattern), Départ:", departureDate?.toLocaleDateString());
    }
    // Pattern départ: "DD/MM/YYYY ... HH:MM"
    else if (/^\d{1,2}\/\d{1,2}\/\d{4}.*\d{2}:\d{2}$/.test(segment)) {
      layout = 'left_only';
      departureDate = extractDateFromLeftBlock(segment);
      console.log("→ Layout: LEFT_ONLY (départ), Départ:", departureDate?.toLocaleDateString());
    }
    // Pattern arrivée: "HH:MM ... DD/MM/YYYY"
    else if (/^\d{2}:\d{2}.*\d{1,2}\/\d{1,2}\/\d{4}$/.test(segment)) {
      layout = 'right_only';
      arrivalDate = extractDateFromRightBlock(segment);
      console.log("→ Layout: RIGHT_ONLY (arrivée), Arrivée:", arrivalDate?.toLocaleDateString());
    }
    else {
      layout = 'centered';
      departureDate = extractDepartureDateFromGenericBlock(segment);
      console.log("→ Layout: CENTERED (générique), Départ:", departureDate?.toLocaleDateString());
    }
  } else if (segments.length === 2) {
    layout = 'left_and_right';
    departureDate = extractDateFromLeftBlock(segments[0]);
    arrivalDate = extractDateFromRightBlock(segments[1]);
    console.log("→ Layout: LEFT_AND_RIGHT, Départ:", departureDate?.toLocaleDateString(), "Arrivée:", arrivalDate?.toLocaleDateString());
  } else if (segments.length >= 3) {
    layout = 'left_center_right';
    console.log("→ Layout: LEFT_CENTER_RIGHT");
  }
  
  return {
    layout,
    blocks: segments,
    departureDate,
    arrivalDate,
    hasMaintenanceKeywords: false,
    hasCleaningKeyword: false
  };
}

// Fonction principale de détermination du statut et type de nettoyage
function determineStatusAndCleaningType(context: string): { status: string, cleaningType: 'full' | 'quick' | 'none' } {
  console.log("=== CLASSIFICATION CHAMBRE ===");
  console.log("Contexte analysé:", context.substring(0, 200));

  const analysis: BlockAnalysis = analyzeReservationBlocks(context);
  console.log("Analyse des blocs:", {
    layout: analysis.layout,
    departureDate: analysis.departureDate?.toLocaleDateString(),
    arrivalDate: analysis.arrivalDate?.toLocaleDateString(),
    maintenance: analysis.hasMaintenanceKeywords,
    cleaning: analysis.hasCleaningKeyword
  });

  // RÈGLES PRIORITAIRES
  if (analysis.hasMaintenanceKeywords) {
    console.log("→ RÉSULTAT: MAINTENANCE");
    return { status: 'maintenance', cleaningType: 'none' };
  }
  
  if (analysis.hasCleaningKeyword) {
    console.log("→ RÉSULTAT: À BLANC (Cleaning explicite)");
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }

  // Détection du statut de la chambre
  const isDirty = /\b(DIR|SALE|SAL)\b/i.test(context);
  const isCleanInspected = /\b(INS|CL|PROPRE|PRO|CLEAN)\b/i.test(context);
  
  console.log("Statuts détectés:", { isDirty, isCleanInspected });

  // APPLICATION DES RÈGLES SPÉCIFIQUES
  
  // Bloc vide
  if (analysis.layout === 'empty') {
    if (isDirty) {
      console.log("→ RÉSULTAT: À BLANC (Vide + DIR/SALE)");
      return { status: 'needs-cleaning', cleaningType: 'full' };
    }
    if (isCleanInspected) {
      console.log("→ RÉSULTAT: PROPRE (Vide + INS/CL)");
      return { status: 'clean', cleaningType: 'none' };
    }
  }

  // Bloc centré
  if (analysis.layout === 'centered') {
    if (analysis.departureDate) {
      const today = new Date(reportDate);
      const departure = new Date(analysis.departureDate);
      
      // Normaliser les dates pour comparaison (ignorer l'heure)
      today.setHours(0, 0, 0, 0);
      departure.setHours(0, 0, 0, 0);
      
      if (departure > today) {
        console.log("→ RÉSULTAT: RECOUCHE (Bloc centré, départ futur)");
        return { status: 'needs-cleaning', cleaningType: 'quick' };
      } else if (departure.getTime() === today.getTime()) {
        console.log("→ RÉSULTAT: À BLANC (Bloc centré, départ aujourd'hui)");
        return { status: 'needs-cleaning', cleaningType: 'full' };
      } else {
        console.log("→ RÉSULTAT: À BLANC (Bloc centré, départ passé)");
        return { status: 'needs-cleaning', cleaningType: 'full' };
      }
    } else {
      console.log("→ RÉSULTAT: À BLANC (Bloc centré sans date claire)");
      return { status: 'needs-cleaning', cleaningType: 'full' };
    }
  }

  // Bloc droite seulement (arrivée)
  if (analysis.layout === 'right_only') {
    if (isCleanInspected) {
      console.log("→ RÉSULTAT: PROPRE (Bloc droite + INS/CL)");
      return { status: 'clean', cleaningType: 'none' };
    }
    if (isDirty) {
      console.log("→ RÉSULTAT: À BLANC (Bloc droite + DIR/SALE)");
      return { status: 'needs-cleaning', cleaningType: 'full' };
    }
  }

  // Bloc gauche seulement (départ)
  if (analysis.layout === 'left_only') {
    console.log("→ RÉSULTAT: À BLANC (Bloc gauche/départ)");
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }

  // Deux ou trois blocs (turnaround)
  if (analysis.layout === 'left_and_right' || analysis.layout === 'left_center_right') {
    console.log("→ RÉSULTAT: À BLANC (Turnaround - plusieurs blocs)");
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }

  // CAS PAR DÉFAUT
  if (isDirty) {
    console.log("→ RÉSULTAT: À BLANC (Défaut - DIR/SALE)");
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }
  if (isCleanInspected) {
    console.log("→ RÉSULTAT: PROPRE (Défaut - INS/CL)");
    return { status: 'clean', cleaningType: 'none' };
  }

  console.log("→ RÉSULTAT: À BLANC (Défaut général)");
  return { status: 'needs-cleaning', cleaningType: 'full' };
}

// Déterminer la priorité
function determinePriority(context: string): 'high' | 'medium' | 'low' {
  // Vérifier d'abord les termes spécifiques pour haute priorité
  if (context.includes('VIP') || 
      context.toLowerCase().includes('urgent') || 
      context.toLowerCase().includes('très urgent') ||
      context.toLowerCase().includes('high priority') || 
      context.toLowerCase().includes('prioritaire')) {
    return 'high';
  }
  
  // Ensuite vérifier les termes spécifiques pour priorité moyenne
  if (context.toLowerCase().includes('medium priority') || 
      context.toLowerCase().includes('standard') || 
      context.toLowerCase().includes('normale')) {
    return 'medium';
  }
  
  // Enfin vérifier les termes spécifiques pour priorité basse
  if (context.toLowerCase().includes('low priority') || 
      context.toLowerCase().includes('basse') || 
      context.toLowerCase().includes('pas urgent')) {
    return 'low';
  }
  
  // Par défaut, priorité moyenne
  return 'medium';
}

// Helper function to generate mock room data
function generateMockRoomData(): Room[] {
  const statuses = ['needs-cleaning', 'clean', 'occupied', 'maintenance'];
  const cleaningTypes = ['full', 'quick', 'none'] as const;
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
      floor // Ajout du numéro d'étage
    };
  });
}
