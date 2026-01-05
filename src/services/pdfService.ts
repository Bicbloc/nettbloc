import { toast } from "@/components/ui/use-toast";
import * as pdfjs from 'pdfjs-dist';
import { unifiedParserService, ExtractedRoom, textPreprocessor } from "@/services/pms";

// Initialiser le worker PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// Store for last extracted text (for debugging/mismatch detection)
let lastExtractedText: string = '';

export function getLastExtractedText(): string {
  return lastExtractedText;
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
 * Process PDF file - utilise le service unifié avec prétraitement centralisé
 * @param file Le fichier PDF à traiter
 * @param hotelId L'identifiant de l'hôtel (optionnel)
 * @param forceAi Force l'utilisation de l'IA même si le parsing local est suffisant
 */
export async function processPdf(file: File, hotelId?: string, forceAi: boolean = false): Promise<Room[]> {
  try {
    // Extraire le texte du PDF
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

    // Prétraitement centralisé
    const preprocessResult = textPreprocessor.preprocess(fullText);
    fullText = preprocessResult.text;
    
    console.log(`📄 PDF extrait: ${preprocessResult.stats.originalLength} → ${preprocessResult.stats.processedLength} chars`);
    console.log(`📝 Patterns appliqués: ${preprocessResult.stats.patternsApplied.join(', ') || 'aucun'}`);
    if (forceAi) console.log(`🤖 Extraction IA forcée par l'utilisateur`);
    lastExtractedText = fullText;
    
    let rooms: Room[] = [];
    
    // Utiliser le service unifié
    if (hotelId) {
      console.log(`🔄 Parsing avec unifiedParserService pour hôtel ${hotelId}...`);
      
      // IMPORTANT: Charger explicitement les patterns appris pour cet hôtel
      // avant le parsing (sinon la logique "recouche vs a_blanc" ne sera pas utilisée)
      await unifiedParserService.loadHotelPatterns(hotelId);
      
      const result = await unifiedParserService.parseReport(fullText, hotelId, forceAi);
      
      console.log(`✅ PMS: ${result.pmsType} (confiance: ${result.confidence.toFixed(1)}%)`);
      console.log(`📊 ${result.rooms.length} chambres extraites (AI: ${result.usedAi}, Patterns: ${result.usedLearnedPatterns})`);
      console.log(`⏱️ Temps: ${result.processingTime}ms`);
      
      rooms = convertExtractedRoomsToRooms(result.rooms);
      
      if (rooms.length > 0) {
        toast({
          title: "Extraction réussie",
          description: `${rooms.length} chambres extraites (${result.pmsType}${result.usedAi ? ' + IA' : ''})`,
        });
        return rooms;
      }
    } else {
      // Sans hotelId, utiliser la détection simple
      console.log('🔄 Parsing sans hotelId...');
      
      const detection = unifiedParserService.detectPmsType(fullText);
      console.log(`🔍 PMS détecté: ${detection.pmsType} (confiance: ${detection.confidence.toFixed(1)}%)`);
      
      const result = await unifiedParserService.parseReport(fullText, 'default', forceAi);
      rooms = convertExtractedRoomsToRooms(result.rooms);
    }

    
    toast({
      title: "PDF Processed",
      description: `${rooms.length} chambres traitées depuis ${file.name}`,
    });
    
    // Si aucune chambre trouvée, retourner un tableau vide avec un message explicatif
    if (rooms.length === 0) {
      console.log("⚠️ Aucune chambre détectée dans le PDF");
      toast({
        variant: "destructive",
        title: "Aucune chambre détectée",
        description: "Le format du rapport n'est pas reconnu. Utilisez l'onglet 'Entraînement IA' pour apprendre ce format.",
      });
      return [];
    }
    
    return rooms;
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
