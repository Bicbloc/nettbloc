import { toast } from "@/components/ui/use-toast";
import * as pdfjs from 'pdfjs-dist';
import { unifiedParserService, ExtractedRoom, textPreprocessor } from "@/services/pms";
import { parseRoomLines, RoomLine } from "@/services/pms/RoomLineParser";
import { detectReportFormat, ParsedRow, type FormatDetection } from "@/services/training/ReportFormatDetector";
import { supabase } from "@/integrations/supabase/client";

// =========== TYPES POUR LES RÈGLES DE COMBINAISON ===========
interface HotelCombinationRule {
  id: string;
  hotel_id: string;
  rule_name: string;
  status_keywords: string[] | null;
  arrival_date: string; // 'present' | 'absent' | 'any'
  departure_date: string;
  arrival_time: string;
  departure_time: string;
  night_info: string;
  result_cleaning_type: string; // 'full' | 'quick' | 'none'
  priority: number;
  is_active: boolean;
}

interface RoomContext {
  hasArrivalDate: boolean;
  hasDepartureDate: boolean;
  hasArrivalTime: boolean;
  hasDepartureTime: boolean;
  hasNightInfo: boolean;
  statusKeywords: string[];
  rawLine: string;
}

// Initialiser le worker PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// Store for last extracted text (for debugging/mismatch detection)
let lastExtractedText: string = '';
let lastParsedLines: RoomLine[] = [];

// Coverage metadata from last parse
export interface CoverageMetadata {
  phase0RoomCount: number;
  trainedModelRoomCount: number;
  finalRoomCount: number;
  supplementedByTraining: number;
  trainedModelUsed: boolean;
  formatDetected: string;
  formatConfidence: number;
  trainedPatternCount: number;
  missingFromPhase0: string[];   // rooms found by training but not by phase0
  missingFromTraining: string[]; // rooms found by phase0 but not by training
  perPatternStats: { keyword: string; matchedCount: number; totalRooms: number }[];
  // NEW: confidence breakdown for 99% accuracy tracking
  confidenceBreakdown?: { high: number; medium: number; low: number };
  crossValidationMatches?: number;
  crossValidationDivergences?: { roomNumber: string; phase0Type: string; trainedType: string }[];
}

let lastCoverageMetadata: CoverageMetadata | null = null;

export function getLastCoverageMetadata(): CoverageMetadata | null {
  return lastCoverageMetadata;
}

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
  cleaningStartedAt?: string; // Timestamp when cleaning started
  cleaningFinishedAt?: string; // Timestamp when cleaning finished
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

// =========== FONCTIONS POUR LES RÈGLES DE COMBINAISON ===========

/**
 * Charge les règles de combinaison depuis la base de données
 */
async function loadHotelCombinationRules(hotelId: string): Promise<HotelCombinationRule[]> {
  try {
    const { data, error } = await supabase
      .from('hotel_combination_rules')
      .select('*')
      .eq('hotel_id', hotelId)
      .eq('is_active', true)
      .order('priority', { ascending: false });
    
    if (error) {
      return [];
    }
    
    return (data || []) as HotelCombinationRule[];
  } catch (err) {
    return [];
  }
}

/**
 * Extrait le contexte d'une ligne parsée pour le matching des règles
 */
function extractRoomContext(row: ParsedRow): RoomContext {
  // Extraire les mots-clés de statut de la ligne brute
  const statusKeywords: string[] = [];
  const rawLineUpper = row.rawLine.toUpperCase();
  
  // Détecter les statuts courants
  const knownStatuses = ['DIR', 'INS', 'PRO', 'SAL', 'PARTI', 'RECOUCHE', 'ARRIVÉE', 'ARRIVEE', 'DEPART', 'CHECKOUT', 'CHECKIN'];
  for (const status of knownStatuses) {
    if (rawLineUpper.includes(status)) {
      statusKeywords.push(status);
    }
  }
  
  // Ajouter le statut détecté si présent
  if (row.cleaningStatus && !statusKeywords.includes(row.cleaningStatus.toUpperCase())) {
    statusKeywords.push(row.cleaningStatus.toUpperCase());
  }
  
  return {
    hasArrivalDate: !!row.arrivalDate && row.arrivalDate.length > 0,
    hasDepartureDate: !!row.departureDate && row.departureDate.length > 0,
    hasArrivalTime: !!row.arrivalTime && row.arrivalTime.length > 0,
    hasDepartureTime: !!row.departureTime && row.departureTime.length > 0,
    hasNightInfo: !!row.nightInfo && row.nightInfo.length > 0,
    statusKeywords,
    rawLine: row.rawLine,
  };
}

/**
 * Vérifie si une règle de combinaison correspond au contexte d'une chambre
 */
function matchesCombinationRule(rule: HotelCombinationRule, context: RoomContext): boolean {
  // Vérifier les mots-clés de statut
  if (rule.status_keywords && rule.status_keywords.length > 0) {
    const hasMatchingKeyword = rule.status_keywords.some(keyword => 
      context.statusKeywords.some(ctxKw => 
        ctxKw.toUpperCase().includes(keyword.toUpperCase()) ||
        keyword.toUpperCase().includes(ctxKw.toUpperCase())
      )
    );
    if (!hasMatchingKeyword) return false;
  }
  
  // Vérifier la date d'arrivée
  if (rule.arrival_date === 'present' && !context.hasArrivalDate) return false;
  if (rule.arrival_date === 'absent' && context.hasArrivalDate) return false;
  
  // Vérifier la date de départ
  if (rule.departure_date === 'present' && !context.hasDepartureDate) return false;
  if (rule.departure_date === 'absent' && context.hasDepartureDate) return false;
  
  // Vérifier l'heure d'arrivée
  if (rule.arrival_time === 'present' && !context.hasArrivalTime) return false;
  if (rule.arrival_time === 'absent' && context.hasArrivalTime) return false;
  
  // Vérifier l'heure de départ
  if (rule.departure_time === 'present' && !context.hasDepartureTime) return false;
  if (rule.departure_time === 'absent' && context.hasDepartureTime) return false;
  
  // Vérifier l'info nuit
  if (rule.night_info === 'present' && !context.hasNightInfo) return false;
  if (rule.night_info === 'absent' && context.hasNightInfo) return false;
  
  return true;
}

/**
 * Applique les règles de combinaison de l'hôtel aux chambres parsées
 */
function applyHotelCombinationRules(
  rooms: Room[], 
  rules: HotelCombinationRule[], 
  parsedRows: ParsedRow[]
): Room[] {
  if (rules.length === 0) return rooms;
  
  // Créer un map des contextes par numéro de chambre
  const contextMap = new Map<string, RoomContext>();
  for (const row of parsedRows) {
    contextMap.set(row.roomNumber, extractRoomContext(row));
  }
  
  let appliedCount = 0;
  
  const updatedRooms = rooms.map(room => {
    const context = contextMap.get(room.number);
    if (!context) return room;
    
    // Trier les règles par priorité décroissante et chercher la première qui matche
    const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);
    
    for (const rule of sortedRules) {
      if (matchesCombinationRule(rule, context)) {
        // Appliquer le type de nettoyage de la règle
        const newCleaningType = 
          rule.result_cleaning_type === 'full' ? 'a_blanc' :
          rule.result_cleaning_type === 'quick' ? 'recouche' :
          rule.result_cleaning_type === 'none' ? 'none' :
          rule.result_cleaning_type === 'a_blanc' ? 'a_blanc' :
          rule.result_cleaning_type === 'recouche' ? 'recouche' :
          room.cleaningType;
        
        if (newCleaningType !== room.cleaningType) {
          appliedCount++;
          
          return {
            ...room,
            cleaningType: newCleaningType as Room['cleaningType'],
            priority: 'normal' as Room['priority'], // Toujours normal - seul l'admin définit la priorité
            isUrgent: false,
            notUrgent: newCleaningType === 'none',
            status: newCleaningType === 'none' ? 'clean' : 'dirty', // Jamais checkout automatique
            notes: '', // Toujours vide - seul l'admin ajoute des commentaires
          } as Room;
        }
        break; // Première règle qui matche, on arrête
      }
    }
    
    return room;
  });
  
  if (appliedCount > 0) {
  }
  
  return updatedRooms;
}

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
    linkedRooms: row.linkedRooms,
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
 * Filtre de cohérence d'étage pour les Room[]: si >70% ont 3+ chiffres, rejeter les 2 chiffres suspects
 */
function applyFloorCoherenceFilterRooms(rooms: Room[]): Room[] {
  if (rooms.length < 3) return rooms.filter(r => r.number.replace(/\D/g, '').length > 1);

  const threeDigitCount = rooms.filter(r => r.number.replace(/\D/g, '').length >= 3).length;
  const ratio = threeDigitCount / rooms.length;

  return rooms.filter(room => {
    const digits = room.number.replace(/\D/g, '');
    if (digits.length <= 1) return false; // Always reject 1-digit
    if (digits.length >= 3) return true; // Always keep 3+ digits
    if (ratio < 0.7) return true; // Not enough 3-digit rooms to filter

    // 2-digit room in a 3-digit dominant set: only keep if it has meaningful status
    const hasStatus = room.cleaningType && room.cleaningType !== 'none';
    if (!hasStatus) {
    }
    return hasStatus;
  });
}

/**
 * Propage les linkedRooms entre chambres communicantes.
 * Si 107+108 crée des entrées liées, mais 107 et 108 existent aussi individuellement,
 * cette fonction s'assure que les chambres individuelles héritent du lien.
 */
function propagateLinkedRooms(rooms: Room[]): Room[] {
  const linkedGroupMap = new Map<string, Set<string>>();
  
  for (const room of rooms) {
    if (room.linkedRooms && room.linkedRooms.length > 0) {
      const group = new Set([room.number, ...room.linkedRooms]);
      for (const member of group) {
        if (linkedGroupMap.has(member)) {
          const existing = linkedGroupMap.get(member)!;
          for (const m of group) existing.add(m);
          for (const m of existing) linkedGroupMap.set(m, existing);
        }
      }
      for (const member of group) linkedGroupMap.set(member, group);
    }
  }
  
  for (const room of rooms) {
    const group = linkedGroupMap.get(room.number);
    if (group && group.size > 1) {
      room.linkedRooms = Array.from(group).filter(r => r !== room.number);
    }
  }
  
  // Deduplicate: keep first occurrence, merge linkedRooms
  const seen = new Map<string, Room>();
  for (const room of rooms) {
    if (!seen.has(room.number)) {
      seen.set(room.number, room);
    } else {
      const existing = seen.get(room.number)!;
      if (room.linkedRooms && room.linkedRooms.length > 0) {
        const merged = new Set([...(existing.linkedRooms || []), ...room.linkedRooms]);
        existing.linkedRooms = Array.from(merged);
      }
      if (room.cleaningType && room.cleaningType !== 'none' && existing.cleaningType === 'none') {
        Object.assign(existing, { ...room, linkedRooms: existing.linkedRooms });
      }
    }
  }
  
  return Array.from(seen.values());
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
 * Calcule un seuil Y dynamique basé sur la taille de police médiane des items
 * Au lieu d'un seuil fixe de 3.5px, on s'adapte au PDF
 */
function computeDynamicYThreshold(items: { str: string; x: number; y: number; fontSize: number }[]): number {
  if (items.length === 0) return 3.5;
  
  // Collecter les tailles de police
  const fontSizes = items.map(it => it.fontSize).filter(s => s > 0);
  if (fontSizes.length === 0) return 3.5;
  
  // Taille médiane
  fontSizes.sort((a, b) => a - b);
  const median = fontSizes[Math.floor(fontSizes.length / 2)];
  
  // Le seuil = ~40% de la taille médiane de police (empirique)
  // Pour une police 10pt → seuil ~4px, pour 8pt → ~3.2px, pour 12pt → ~4.8px
  const threshold = Math.max(2, Math.min(8, median * 0.4));
  return threshold;
}

/**
 * Détecte les colonnes par clustering des positions X (mode table-aware)
 * Retourne les bordures de colonnes triées
 */
function detectColumnBoundaries(items: { x: number }[]): number[] {
  if (items.length < 10) return [];
  
  // Collecter toutes les positions X arrondies
  const xPositions = items.map(it => Math.round(it.x));
  
  // Clustering simple: regrouper les X proches (< 5px d'écart)
  const sorted = [...new Set(xPositions)].sort((a, b) => a - b);
  const clusters: number[] = [];
  let lastCluster = sorted[0];
  let clusterCount = 1;
  
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - lastCluster < 15) {
      // Même cluster
      clusterCount++;
    } else {
      // Nouveau cluster si au moins 3 items s'alignent ici
      if (clusterCount >= 3) {
        clusters.push(lastCluster);
      }
      lastCluster = sorted[i];
      clusterCount = 1;
    }
  }
  if (clusterCount >= 3) {
    clusters.push(lastCluster);
  }
  
  return clusters;
}

/**
 * Extract text from PDF file with dynamic Y threshold and table-aware mode
 */
export async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Reconstruire des lignes à partir des coordonnées (Y puis X)
    // AMÉLIORATION: inclure la taille de police pour le seuil dynamique
    const items = (textContent.items as any[])
      .map((item) => ({
        str: String(item.str ?? ''),
        x: Array.isArray(item.transform) ? Number(item.transform[4]) : 0,
        y: Array.isArray(item.transform) ? Number(item.transform[5]) : 0,
        fontSize: item.height || (Array.isArray(item.transform) ? Math.abs(Number(item.transform[3])) : 0),
      }))
      .filter((it) => it.str.trim().length > 0);

    // Calculer le seuil Y dynamique basé sur la taille de police
    const yThreshold = computeDynamicYThreshold(items);
    
    // Détecter les colonnes pour le mode table-aware
    const columnBoundaries = detectColumnBoundaries(items);
    const isTableMode = columnBoundaries.length >= 3;

    // PDF.js: Y décroissant ~ lignes de haut en bas
    items.sort((a, b) => (b.y - a.y) || (a.x - b.x));

    let lastY: number | null = null;
    let lineParts: string[] = [];

    const flushLine = () => {
      let line: string;
      if (isTableMode && lineParts.length > 1) {
        // En mode table, ajouter un séparateur de tabulation entre les colonnes
        line = lineParts.join('\t').replace(/\t+/g, '\t').trim();
      } else {
        line = lineParts.join(' ').replace(/\s+/g, ' ').trim();
      }
      if (line) fullText += line + '\n';
      lineParts = [];
    };

    for (const it of items) {
      const currentY = it.y;
      if (lastY !== null && Math.abs(currentY - lastY) > yThreshold) {
        flushLine();
      }
      
      // En mode table, ajouter un séparateur si on saute une colonne
      if (isTableMode && lineParts.length > 0 && lastY !== null && Math.abs(currentY - lastY) <= yThreshold) {
        const lastX = items.find(item => item.str === lineParts[lineParts.length - 1])?.x || 0;
        if (it.x - lastX > 30) {
          lineParts.push('\t');
        }
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
    
    
    lastExtractedText = fullText;
    
    // Reset coverage metadata
    lastCoverageMetadata = null;

    // ===== PHASE 0: Vérifier d'abord si l'hôtel a un modèle entraîné =====
    let useTrainedModel = false;
    
    if (hotelId) {
      try {
        // Check if hotel has trained patterns via unifiedParserService
        await unifiedParserService.loadHotelPatterns(hotelId);
        const patternCount = unifiedParserService.getLearnedPatternCount();
        
        if (patternCount > 0) {
          useTrainedModel = true;
        }
      } catch (err) {
      }
    }
    
    // ===== Si modèle entraîné existe, l'utiliser en PRIORITÉ ABSOLUE =====
    if (useTrainedModel && hotelId) {
      
      try {
        await unifiedParserService.loadHotelPatterns(hotelId);
        const trainedResult = await unifiedParserService.parseReportHybrid(fullText, hotelId, false);
        
        if (trainedResult.rooms.length > 0) {
          let rooms = propagateLinkedRooms(convertExtractedRoomsToRooms(trainedResult.rooms));
          const trainedPatternCount = unifiedParserService.getLearnedPatternCount();
          
          // Build coverage metadata
          lastCoverageMetadata = {
            phase0RoomCount: 0,
            trainedModelRoomCount: rooms.length,
            finalRoomCount: rooms.length,
            supplementedByTraining: 0,
            trainedModelUsed: true,
            formatDetected: 'trained_model',
            formatConfidence: 95,
            trainedPatternCount,
            missingFromPhase0: [],
            missingFromTraining: [],
            perPatternStats: [],
          };
          
          // Appliquer les règles de combinaison
          const combinationRules = await loadHotelCombinationRules(hotelId);
          if (combinationRules.length > 0) {
            rooms = applyHotelCombinationRules(rooms, combinationRules, []);
          }
          
          // Post-extraction filter: reject 1-digit rooms + floor coherence
          rooms = applyFloorCoherenceFilterRooms(rooms);
          
          // Créer des RoomLines pour la prévisualisation
          lastParsedLines = rooms.map(room => ({
            roomNumber: room.number,
            rawText: `${room.number} ${room.cleaningType}`,
            fullText: `${room.number} ${room.cleaningType}`,
            cleaningType: room.cleaningType === 'a_blanc' ? 'a_blanc' : room.cleaningType === 'recouche' ? 'recouche' : 'none',
            cleaningReason: room.cleaningReason || '',
            statusCode: '',
            statusLabel: room.cleaningReason || '',
            roomType: room.roomType || '',
            guestName: room.guestName || '',
            arrivalDate: room.arrivalDate || '',
            departureDate: room.departureDate || '',
            checkInTime: room.checkInTime || '',
            checkOutTime: room.checkOutTime || '',
            confidence: 90,
            linkedRooms: room.linkedRooms || [],
            notes: [],
            isLastNight: false,
            isFirstNight: false,
          } as RoomLine));
          
          toast({
            title: "Extraction via modèle entraîné",
            description: `${rooms.length} chambres extraites avec le modèle personnalisé de votre établissement`,
          });
          
          return rooms;
        }
      } catch (err) {
      }
    }

    // ===== PHASE 0b: Détection du format avec ReportFormatDetector =====
    const formatDetection = detectReportFormat(fullText);
    
    // Utiliser le parser dédié si format reconnu avec bonne confiance ET résultats non vides
    if (['apaleo_housekeeping', 'mews_space_status', 'medialog_etat'].includes(formatDetection.format) && 
        formatDetection.confidence >= 50 && 
        formatDetection.parsedData.rows.length > 0) {
      
      
      const parsedRows = formatDetection.parsedData.rows;
      let rooms = parsedRows.map(convertParsedRowToRoom);
      
      // Post-processing: propager les liaisons chambres communicantes
      rooms = propagateLinkedRooms(rooms);

      // ===== SUPPLEMENTER AVEC LES PATTERNS ENTRAINÉS =====
      const phase0RoomCount = rooms.length;
      const phase0Numbers = new Set(rooms.map(r => r.number));
      let trainedModelRoomCount = 0;
      let supplementedCount = 0;
      let trainedModelUsed = false;
      let trainedPatternCount = 0;
      let missingFromPhase0: string[] = [];
      let missingFromTraining: string[] = [];
      let perPatternStats: CoverageMetadata['perPatternStats'] = [];
      let trainedRoomsForCrossValidation: Room[] = [];

      if (hotelId) {
        try {
          await unifiedParserService.loadHotelPatterns(hotelId);
          const trainedResult = await unifiedParserService.parseReportHybrid(fullText, hotelId, false);
          trainedPatternCount = unifiedParserService.getLearnedPatternCount();
          
          if (trainedResult.rooms.length > 0) {
            trainedModelUsed = true;
            const trainedRooms = convertExtractedRoomsToRooms(trainedResult.rooms);
            trainedRoomsForCrossValidation = trainedRooms;
            trainedModelRoomCount = trainedRooms.length;
            const trainedNumbers = new Set(trainedRooms.map(r => r.number));
            const existingNumbers = new Set(rooms.map(r => r.number));
            
            // Gap analysis
            missingFromPhase0 = trainedRooms.filter(r => !existingNumbers.has(r.number)).map(r => r.number);
            missingFromTraining = rooms.filter(r => !trainedNumbers.has(r.number)).map(r => r.number);
            
            // Add rooms found by trained model but not by Phase 0
            for (const trainedRoom of trainedRooms) {
              if (!existingNumbers.has(trainedRoom.number)) {
                rooms.push(trainedRoom);
                existingNumbers.add(trainedRoom.number);
                supplementedCount++;
              }
            }
            
            if (supplementedCount > 0) {
            }
            
            // If trained model found MORE rooms, use its results as base
            if (trainedRooms.length > rooms.length) {
              const phase0Map = new Map(rooms.map(r => [r.number, r]));
              rooms = trainedRooms.map(tr => {
                const phase0Room = phase0Map.get(tr.number);
                if (phase0Room) {
                  return { ...tr, ...phase0Room };
                }
                return tr;
              });
            }

            // Per-pattern stats: check keyword hit rates
            const statusCodes = new Map<string, number>();
            for (const line of parsedRows) {
              const code = (line.cleaningStatus || '').toUpperCase();
              if (code) statusCodes.set(code, (statusCodes.get(code) || 0) + 1);
            }
            perPatternStats = Array.from(statusCodes.entries()).map(([keyword, matchedCount]) => ({
              keyword,
              matchedCount,
              totalRooms: rooms.length,
            }));
          }
        } catch (err) {
        }
      }

      // Cross-validation: compare Phase 0 vs Trained model cleaning types
      const crossValidationDivergences: CoverageMetadata['crossValidationDivergences'] = [];
      let crossValidationMatches = 0;
      if (trainedModelUsed) {
        const trainedRoomsMap = new Map(trainedRoomsForCrossValidation.map(r => [r.number, r]));
        for (const room of rooms) {
          const trainedRoom = trainedRoomsMap.get(room.number);
          if (trainedRoom) {
            if (trainedRoom.cleaningType === room.cleaningType) {
              crossValidationMatches++;
            } else {
              crossValidationDivergences.push({
                roomNumber: room.number,
                phase0Type: room.cleaningType || 'unknown',
                trainedType: trainedRoom.cleaningType || 'unknown',
              });
              // If trained model has higher confidence, use its cleaning type
            }
          }
        }
        if (crossValidationDivergences.length > 0) {
        }
      }

      // Confidence breakdown
      const confidenceBreakdown = { high: 0, medium: 0, low: 0 };
      for (const line of parsedRows) {
        const conf = (line.confidence || 0) * 100;
        if (conf >= 90) confidenceBreakdown.high++;
        else if (conf >= 70) confidenceBreakdown.medium++;
        else confidenceBreakdown.low++;
      }

      // Build coverage metadata
      lastCoverageMetadata = {
        phase0RoomCount,
        trainedModelRoomCount,
        finalRoomCount: rooms.length,
        supplementedByTraining: supplementedCount,
        trainedModelUsed,
        formatDetected: formatDetection.format,
        formatConfidence: formatDetection.confidence,
        trainedPatternCount,
        missingFromPhase0,
        missingFromTraining,
        perPatternStats,
        confidenceBreakdown,
        crossValidationMatches,
        crossValidationDivergences,
      };
      
      // ===== APPLIQUER LES RÈGLES DE COMBINAISON DE L'HÔTEL =====
      if (hotelId) {
        const combinationRules = await loadHotelCombinationRules(hotelId);
        if (combinationRules.length > 0) {
          rooms = applyHotelCombinationRules(rooms, combinationRules, parsedRows);
        }
      }
      
      // ===== POST-EXTRACTION FILTER: Reject false positives =====
      rooms = rooms.filter(room => {
        const roomNumDigits = room.number.replace(/\D/g, '');
        const roomNumInt = parseInt(roomNumDigits);
        
        // Reject single-digit room numbers (1-9) — these are almost always false positives
        // (e.g. "Nb pers" column values, page counters, table indices)
        if (roomNumDigits.length === 1) {
          return false;
        }
        
        // Reject 2-digit room numbers < 20 without strong context
        const hasCleaningInfo = room.cleaningType && room.cleaningType !== 'none';
        const hasNotes = room.notes && room.notes.length > 0;
        const hasGuestData = room.guestName || room.arrivalDate || room.departureDate;
        
        if (roomNumDigits.length <= 2 && roomNumInt < 20 && !hasCleaningInfo && !hasGuestData && !hasNotes) {
          return false;
        }
        
        return true;
      });
      
      // Statistiques après application des règles
      const aBlancCount = rooms.filter(r => r.cleaningType === 'a_blanc').length;
      const recoucheCount = rooms.filter(r => r.cleaningType === 'recouche').length;
      const noneCount = rooms.filter(r => r.cleaningType === 'none').length;
      
      
      // Créer des RoomLines synthétiques pour la prévisualisation
      // Inclure TOUTES les chambres (Phase 0 + patterns entraînés)
      lastParsedLines = rooms.map(room => {
        // Chercher la parsedRow correspondante pour les données enrichies
        const matchingRow = parsedRows.find(r => r.roomNumber === room.number);
        return {
          roomNumber: room.number,
          rawText: matchingRow?.rawLine || `${room.number} ${room.cleaningType}`,
          fullText: matchingRow?.rawLine || `${room.number} ${room.cleaningType}`,
          cleaningType: room.cleaningType === 'a_blanc' ? 'a_blanc' : 
                        room.cleaningType === 'recouche' ? 'recouche' : 
                        room.cleaningType === 'none' ? 'none' : 'a_blanc',
          cleaningReason: room.cleaningReason || matchingRow?.statusIndicator || '',
          statusCode: matchingRow?.cleaningStatus || '',
          statusLabel: matchingRow?.statusIndicator || room.cleaningReason || '',
          roomType: room.roomType || matchingRow?.roomType || '',
          guestName: room.guestName || matchingRow?.guestName || '',
          arrivalDate: room.arrivalDate || matchingRow?.arrivalDate || '',
          departureDate: room.departureDate || matchingRow?.departureDate || '',
          checkInTime: room.checkInTime || matchingRow?.arrivalTime || '',
          checkOutTime: room.checkOutTime || matchingRow?.departureTime || '',
          confidence: matchingRow ? matchingRow.confidence * 100 : 75,
          linkedRooms: room.linkedRooms || [],
          notes: [],
          isLastNight: matchingRow?.hasDepartingGuest || false,
          isFirstNight: matchingRow?.hasArrivingGuest || false,
        } as RoomLine;
      });
      
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
    
    
    if (roomLines.length > 0) {
      // Statistiques de confiance
      const avgConfidence = roomLines.reduce((sum, l) => sum + l.confidence, 0) / roomLines.length;
      const aBlancCount = roomLines.filter(l => l.cleaningType === 'a_blanc').length;
      const recoucheCount = roomLines.filter(l => l.cleaningType === 'recouche').length;
      
      
      // Convertir les RoomLines en Rooms
      const rooms = roomLines.map(convertRoomLineToRoom);
      
      toast({
        title: "Extraction IA réussie",
        description: `${rooms.length} chambres (${aBlancCount} à blanc, ${recoucheCount} recouches)`,
      });
      
      return rooms;
    }
    
    // ===== PHASE 2: Fallback vers unifiedParserService =====
    
    let rooms: Room[] = [];
    
    if (hotelId) {
      await unifiedParserService.loadHotelPatterns(hotelId);
      const result = await unifiedParserService.parseReport(fullText, hotelId, forceAi);
      
      
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
