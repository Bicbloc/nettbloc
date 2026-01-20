import { toast } from "@/components/ui/use-toast";
import * as pdfjs from 'pdfjs-dist';
import { unifiedParserService, ExtractedRoom, textPreprocessor } from "@/services/pms";
import { parseRoomLines, RoomLine } from "@/services/pms/RoomLineParser";
import { detectReportFormat, ParsedRow, type FormatDetection } from "@/services/training/ReportFormatDetector";

// Initialiser le worker PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// Store for last extracted text (for debugging/mismatch detection)
let lastExtractedText: string = '';
let lastParsedLines: RoomLine[] = [];

export function getLastExtractedText(): string {
  return lastExtractedText;
}

export function getLastParsedLines(): RoomLine[] {
  return lastParsedLines;
}

export interface Room {
  number: string;
  status: string;
  cleaningType?: 'a_blanc' | 'recouche' | 'none' | 'full' | 'quick';
  priority?: 'high' | 'medium' | 'low';
  assignedTo?: string;
  isTwin?: boolean;
  isUrgent?: boolean;
  notUrgent?: boolean;
  floor?: number;
  notes?: string;
  remark?: string;
  linkedRooms?: string[];
  inspectedAt?: string;
  inspectedBy?: string;
  // Extended IA data
  guestName?: string;
  arrivalDate?: string;
  departureDate?: string;
  checkInTime?: string;
  checkOutTime?: string;
  nightInfo?: { current: number; total: number };
  adults?: number;
  children?: number;
  roomType?: string;
  cleaningReason?: string;
}

export interface CleaningConfig {
  fullCleaningTime: number;
  quickCleaningTime: number;
  minRoomsPerHousekeeper: number;
  maxRoomsPerHousekeeper: number;
}

export const getDefaultCleaningConfig = (isPremium: boolean = false): CleaningConfig => ({
  fullCleaningTime: 30,
  quickCleaningTime: 15,
  minRoomsPerHousekeeper: isPremium ? 15 : 10,
  maxRoomsPerHousekeeper: isPremium ? 50 : 18
});

export const defaultCleaningConfig: CleaningConfig = getDefaultCleaningConfig(false);

/**
 * Charge la liste d'exclusion depuis localStorage
 */
function loadExclusionList(hotelId?: string): string[] {
  try {
    const key = hotelId ? `exclusion_list_${hotelId}` : 'exclusion_list';
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Convertit RoomLine du parser intelligent vers Room de l'application
 */
function convertRoomLineToRoom(line: RoomLine): Room {
  // Mapper le cleaningType
  const cleaningType: Room['cleaningType'] =
    line.cleaningType === 'a_blanc' ? 'a_blanc' :
    line.cleaningType === 'recouche' ? 'recouche' :
    line.cleaningType === 'inspection' ? 'none' :
    'none';

  // Déterminer la priorité
  const priority: Room['priority'] =
    cleaningType === 'a_blanc' ? 'high' :
    cleaningType === 'recouche' ? 'medium' :
    'low';

  // Déterminer le statut
  const status =
    line.cleaningType === 'inspection' || line.cleaningType === 'none' ? 'clean' :
    cleaningType === 'a_blanc' ? 'checkout' :
    'stayover';

  // Parser l'étage
  const floor = line.floor ? parseInt(line.floor) : undefined;

  // Construire les notes enrichies
  const noteParts: string[] = [];
  if (line.cleaningReason) noteParts.push(line.cleaningReason);
  if (line.statusLabel) noteParts.push(`Statut: ${line.statusLabel}`);
  if (line.checkOutTime) noteParts.push(`Départ: ${line.checkOutTime}`);
  if (line.checkInTime) noteParts.push(`Arrivée: ${line.checkInTime}`);
  if (line.notes && line.notes.length > 0) noteParts.push(...line.notes);

  return {
    number: line.roomNumber,
    status,
    cleaningType,
    priority,
    isUrgent: cleaningType === 'a_blanc',
    notUrgent: cleaningType === 'none',
    floor,
    linkedRooms: line.linkedRooms,
    notes: noteParts.length > 0 ? noteParts.join(' | ') : undefined,
    // Extended IA data
    guestName: line.guestName,
    arrivalDate: line.arrivalDate,
    departureDate: line.departureDate,
    checkInTime: line.checkInTime,
    checkOutTime: line.checkOutTime,
    nightInfo: line.nightInfo,
    adults: line.adults,
    children: line.children,
    roomType: line.roomType,
    cleaningReason: line.cleaningReason,
  };
}

/**
 * Convertit ParsedRow du ReportFormatDetector (entraînement IA) vers Room
 * Ceci permet d'utiliser la même logique que l'entraînement IA dans PdfWorkflowDialog
 */
function convertParsedRowToRoom(row: ParsedRow): Room {
  // Mapper le cleaningType
  let cleaningType: Room['cleaningType'] = 'a_blanc';
  if (row.detectedCleaningType === 'quick') {
    cleaningType = 'recouche';
  } else if (row.detectedCleaningType === 'full') {
    cleaningType = 'a_blanc';
  } else if (row.detectedCleaningType === 'none' || row.detectedCleaningType === 'out_of_service') {
    cleaningType = 'none';
  }

  // Déterminer la priorité
  const priority: Room['priority'] =
    cleaningType === 'a_blanc' ? 'high' :
    cleaningType === 'recouche' ? 'medium' :
    'low';

  // Déterminer le statut
  const status =
    cleaningType === 'none' ? 'clean' :
    cleaningType === 'a_blanc' ? 'checkout' :
    'stayover';

  // Parser l'étage depuis le numéro de chambre
  const floor = getRoomFloor(row.roomNumber);

  // Construire les notes enrichies
  const noteParts: string[] = [];
  if (row.statusIndicator) noteParts.push(`Statut: ${row.statusIndicator}`);
  if (row.guestName) noteParts.push(`Client: ${row.guestName}`);
  if (row.departureTime) noteParts.push(`Départ: ${row.departureTime}`);
  if (row.arrivalTime) noteParts.push(`Arrivée: ${row.arrivalTime}`);

  // Parser nightInfo
  let nightInfo: { current: number; total: number } | undefined = undefined;
  if (row.nightInfo) {
    const match = row.nightInfo.match(/(\d+)\/(\d+)/);
    if (match) {
      nightInfo = { current: parseInt(match[1]), total: parseInt(match[2]) };
    }
  }

  return {
    number: row.roomNumber,
    status,
    cleaningType,
    priority,
    isUrgent: cleaningType === 'a_blanc',
    notUrgent: cleaningType === 'none',
    floor,
    notes: noteParts.length > 0 ? noteParts.join(' | ') : undefined,
    // Extended IA data from training
    guestName: row.guestName,
    arrivalDate: row.arrivalDate,
    departureDate: row.departureDate,
    checkInTime: row.arrivalTime,
    checkOutTime: row.departureTime,
    nightInfo,
    roomType: row.roomType,
    cleaningReason: row.statusIndicator,
  };
}

function normalizeStatusToken(token: string): string {
  const u = String(token).trim().toUpperCase();
  if (u === 'CO') return 'C/O';
  if (u === 'CI') return 'C/I';
  return u;
}

function buildStatusNote(er: ExtractedRoom): string | undefined {
  const parts: string[] = [];
  
  // Statuts bruts
  if (er.rawStatuses && er.rawStatuses.length > 0) {
    const pretty = er.rawStatuses.map(normalizeStatusToken).join(' + ');
    parts.push(`Statut: ${pretty}`);
  }
  
  // Horaires
  if (er.departureTime) {
    parts.push(`Départ: ${er.departureTime}`);
  }
  if (er.arrivalTime) {
    parts.push(`Arrivée: ${er.arrivalTime}`);
  }
  
  if (parts.length > 0) {
    return parts.join(' | ');
  }

  if (er.inferenceReason) return er.inferenceReason;
  if (er.status) return `Statut: ${er.status}`;
  return undefined;
}

/**
 * Convertit ExtractedRoom[] du service unifié vers Room[] de l'application
 */
function convertExtractedRoomsToRooms(extractedRooms: ExtractedRoom[]): Room[] {
  return extractedRooms
    .map((er) => {
      // Le système PMS supporte 2 formats: ancien (full/quick) et nouveau (a_blanc/recouche)
      const cleaningType: Room['cleaningType'] =
        er.cleaningType === 'a_blanc' || er.cleaningType === 'full'
          ? 'a_blanc'
          : er.cleaningType === 'recouche' || er.cleaningType === 'quick'
            ? 'recouche'
            : 'none';

      const priority: Room['priority'] =
        cleaningType === 'a_blanc' ? 'high' : cleaningType === 'recouche' ? 'medium' : 'low';

      return {
        number: er.roomNumber,
        status: mapStatus(er.status),
        cleaningType,
        priority,
        isUrgent: cleaningType === 'a_blanc',
        notUrgent: cleaningType === 'none',
        floor: getRoomFloor(er.roomNumber),
        linkedRooms: er.linkedRooms,
        notes: er.originalText ? buildStatusNote(er) : undefined,
      } as Room;
    })
    .filter((room) => room.number && room.number.length > 0);
}

/**
 * Mappe les statuts du service unifié vers les statuts de l'application
 */
function mapStatus(status: string): string {
  const lower = status.toLowerCase();
  
  if (lower.includes('needs') || lower.includes('dirty') || lower.includes('sale') || lower.includes('checkout')) {
    return 'needs-cleaning';
  }
  if (lower.includes('occupied') || lower.includes('stayover') || lower.includes('recouche')) {
    return 'needs-cleaning';
  }
  if (lower.includes('clean') || lower.includes('propre') || lower.includes('inspected') || lower.includes('ins')) {
    return 'clean';
  }
  if (lower.includes('maintenance') || lower.includes('out') || lower.includes('ooo')) {
    return 'maintenance';
  }
  
  return 'needs-cleaning';
}

/**
 * Détermine l'étage à partir du numéro de chambre
 */
function getRoomFloor(roomNumber: string): number {
  if (/^20(2[5-8])$/.test(roomNumber)) {
    return 0;
  }
  
  if (roomNumber.length <= 2) {
    return 0;
  }
  
  const firstDigit = parseInt(roomNumber[0]);
  return isNaN(firstDigit) ? 0 : firstDigit;
}

/**
 * Extract text from PDF file
 */
export async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Reconstruire des lignes à partir des coordonnées (Y puis X)
    const items = (textContent.items as any[])
      .map((item) => ({
        str: String(item.str ?? ''),
        x: Array.isArray(item.transform) ? Number(item.transform[4]) : 0,
        y: Array.isArray(item.transform) ? Number(item.transform[5]) : 0,
      }))
      .filter((it) => it.str.trim().length > 0);

    // PDF.js: Y décroissant ~ lignes de haut en bas
    items.sort((a, b) => (b.y - a.y) || (a.x - b.x));

    let lastY: number | null = null;
    let lineParts: string[] = [];

    const flushLine = () => {
      const line = lineParts.join(' ').replace(/\s+/g, ' ').trim();
      if (line) fullText += line + '\n';
      lineParts = [];
    };

    for (const it of items) {
      const currentY = it.y;
      if (lastY !== null && Math.abs(currentY - lastY) > 3.5) {
        flushLine();
      }
      lineParts.push(it.str);
      lastY = currentY;
    }
    flushLine();
    fullText += '\n'; // séparateur de page
  }
  
  return fullText;
}

/**
 * Process PDF file with intelligent parsing
 * PRIORITÉ: Utilise ReportFormatDetector (entraînement IA) pour Apaleo/Mews
 * Fallback: RoomLineParser puis UnifiedParserService
 */
export async function processPdf(file: File, hotelId?: string, forceAi: boolean = false): Promise<Room[]> {
  try {
    // Extraire le texte du PDF
    const rawText = await extractPdfText(file);
    
    // Prétraitement centralisé
    const preprocessResult = textPreprocessor.preprocess(rawText);
    const fullText = preprocessResult.text;
    
    console.log(`📄 PDF extrait: ${preprocessResult.stats.originalLength} → ${preprocessResult.stats.processedLength} chars`);
    console.log(`📝 Patterns appliqués: ${preprocessResult.stats.patternsApplied.join(', ') || 'aucun'}`);
    
    lastExtractedText = fullText;
    
    // ===== PHASE 0: Détection du format avec ReportFormatDetector (COMME ENTRAÎNEMENT IA) =====
    const formatDetection = detectReportFormat(fullText);
    console.log(`🔍 Format détecté: ${formatDetection.format} (confiance: ${formatDetection.confidence}%)`);
    
    // Si format Apaleo/Mews détecté avec bonne confiance, utiliser le parser dédié
    if (['apaleo_housekeeping', 'mews_space_status', 'medialog_etat'].includes(formatDetection.format) && 
        formatDetection.confidence >= 50 && 
        formatDetection.parsedData.rows.length > 0) {
      
      console.log(`🎯 Utilisation du parser ${formatDetection.format} (comme entraînement IA)`);
      
      const parsedRows = formatDetection.parsedData.rows;
      const rooms = parsedRows.map(convertParsedRowToRoom);
      
      // Statistiques
      const aBlancCount = rooms.filter(r => r.cleaningType === 'a_blanc').length;
      const recoucheCount = rooms.filter(r => r.cleaningType === 'recouche').length;
      const noneCount = rooms.filter(r => r.cleaningType === 'none').length;
      
      console.log(`📊 Résultat: ${rooms.length} chambres`);
      console.log(`🔵 À blanc: ${aBlancCount} | 🟢 Recouche: ${recoucheCount} | ⚪ Aucun: ${noneCount}`);
      
      // Créer des RoomLines synthétiques pour la prévisualisation
      lastParsedLines = parsedRows.map(row => ({
        roomNumber: row.roomNumber,
        rawText: row.rawLine,
        fullText: row.rawLine,
        cleaningType: row.detectedCleaningType === 'full' ? 'a_blanc' : 
                      row.detectedCleaningType === 'quick' ? 'recouche' : 
                      row.detectedCleaningType === 'none' ? 'none' : 'a_blanc',
        cleaningReason: row.statusIndicator,
        statusCode: row.cleaningStatus,
        statusLabel: row.statusIndicator,
        roomType: row.roomType,
        guestName: row.guestName,
        arrivalDate: row.arrivalDate,
        departureDate: row.departureDate,
        checkInTime: row.arrivalTime,
        checkOutTime: row.departureTime,
        confidence: row.confidence * 100,
        linkedRooms: [],
        notes: [],
        isLastNight: row.hasDepartingGuest,
        isFirstNight: row.hasArrivingGuest,
      } as RoomLine));
      
      toast({
        title: "Extraction IA réussie",
        description: `${rooms.length} chambres (${aBlancCount} à blanc, ${recoucheCount} recouches) - Format ${formatDetection.format}`,
      });
      
      return rooms;
    }
    
    // ===== PHASE 1: Parser intelligent (fallback) =====
    const excludeList = loadExclusionList(hotelId);
    const roomLines = parseRoomLines(fullText, excludeList);
    lastParsedLines = roomLines;
    
    console.log(`🧠 RoomLineParser: ${roomLines.length} chambres détectées`);
    
    if (roomLines.length > 0) {
      // Statistiques de confiance
      const avgConfidence = roomLines.reduce((sum, l) => sum + l.confidence, 0) / roomLines.length;
      const aBlancCount = roomLines.filter(l => l.cleaningType === 'a_blanc').length;
      const recoucheCount = roomLines.filter(l => l.cleaningType === 'recouche').length;
      
      console.log(`📊 Confiance moyenne: ${avgConfidence.toFixed(1)}%`);
      console.log(`🔵 À blanc: ${aBlancCount} | 🟢 Recouche: ${recoucheCount}`);
      
      // Convertir les RoomLines en Rooms
      const rooms = roomLines.map(convertRoomLineToRoom);
      
      toast({
        title: "Extraction IA réussie",
        description: `${rooms.length} chambres (${aBlancCount} à blanc, ${recoucheCount} recouches)`,
      });
      
      return rooms;
    }
    
    // ===== PHASE 2: Fallback vers unifiedParserService =====
    console.log('🔄 Fallback vers unifiedParserService...');
    
    let rooms: Room[] = [];
    
    if (hotelId) {
      await unifiedParserService.loadHotelPatterns(hotelId);
      const result = await unifiedParserService.parseReport(fullText, hotelId, forceAi);
      
      console.log(`✅ PMS: ${result.pmsType} (confiance: ${result.confidence.toFixed(1)}%)`);
      console.log(`📊 ${result.rooms.length} chambres extraites (AI: ${result.usedAi})`);
      
      rooms = convertExtractedRoomsToRooms(result.rooms);
      
      if (rooms.length > 0) {
        toast({
          title: "Extraction réussie",
          description: `${rooms.length} chambres extraites (${result.pmsType}${result.usedAi ? ' + IA' : ''})`,
        });
        return rooms;
      }
    } else {
      const detection = unifiedParserService.detectPmsType(fullText);
      console.log(`🔍 PMS détecté: ${detection.pmsType} (confiance: ${detection.confidence.toFixed(1)}%)`);
      
      const result = await unifiedParserService.parseReport(fullText, 'default', forceAi);
      rooms = convertExtractedRoomsToRooms(result.rooms);
    }
    
    if (rooms.length > 0) {
      toast({
        title: "PDF traité",
        description: `${rooms.length} chambres depuis ${file.name}`,
      });
      return rooms;
    }
    
    // Aucune chambre trouvée
    console.log("⚠️ Aucune chambre détectée dans le PDF");
    toast({
      variant: "destructive",
      title: "Aucune chambre détectée",
      description: "Le format du rapport n'est pas reconnu. Utilisez l'entraînement IA pour apprendre ce format.",
    });
    return [];
    
  } catch (error) {
    console.error("❌ Error processing PDF:", error);
    toast({
      variant: "destructive",
      title: "Erreur de traitement",
      description: "Impossible de lire le fichier PDF. Vérifiez qu'il n'est pas protégé.",
    });
    throw error;
  }
}
