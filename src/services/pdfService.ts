import { toast } from "@/components/ui/use-toast";
import * as pdfjs from 'pdfjs-dist';
import { unifiedParserService, ExtractedRoom } from "@/services/pms";

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
 * Convertit ExtractedRoom[] du service unifié vers Room[] de l'application
 */
function convertExtractedRoomsToRooms(extractedRooms: ExtractedRoom[]): Room[] {
  return extractedRooms.map(er => {
    const cleaningType: Room['cleaningType'] = er.cleaningType === 'full' ? 'a_blanc' : 
                         er.cleaningType === 'quick' ? 'recouche' : 'none';
    
    const priority: Room['priority'] = er.cleaningType === 'full' ? 'high' : 
                     er.cleaningType === 'quick' ? 'medium' : 'low';
    
    return {
      number: er.roomNumber,
      status: mapStatus(er.status),
      cleaningType,
      priority,
      isUrgent: er.cleaningType === 'full',
      notUrgent: er.cleaningType === 'none',
      floor: getRoomFloor(er.roomNumber),
      linkedRooms: er.linkedRooms,
      notes: er.originalText ? `Statut: ${er.status}` : undefined
    } as Room;
  }).filter(room => room.number && room.number.length > 0);
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
 * Prétraite le texte PDF pour séparer les chambres concaténées
 * Gère le format tableau Apaleo où les chambres sont concaténées
 */
function preprocessPdfText(text: string): string {
  let processed = text;
  
  // Pattern 1: Début de ligne ou après espace - numéro + "Chambre" (format tableau Apaleo)
  // Ex: "01   Chambre twin" ou " 02 Chambre triple"
  processed = processed.replace(/(^|\s)(0?\d{1,2})\s+(Chambre\s+(?:twin|triple|double|simple|quadruple|standard))/gim, '\n$2 $3');
  
  // Pattern 2: Statut suivi d'un numéro de chambre et "Chambre"
  // Ex: "Sale 02 Chambre triple" → "Sale\n02 Chambre triple"
  processed = processed.replace(/(Sale|Parti|Recouche|Arrivé|Arrivée|En arrivée|A contrôler|Propre|A blanc)\s+(0?\d{1,3})\s+(Chambre)/gi, '$1\n$2 $3');
  
  // Pattern 3: Statut2 suivi directement d'un numéro (format "A contrôler 02 Chambre")
  // Ex: "TW // NR Formulaire... A contrôler 02" → séparer avant le 02
  processed = processed.replace(/(Sale|A contrôler|Propre)\s+(0?\d{1,2})\s+(Chambre)/gi, '$1\n$2 $3');
  
  // Pattern 4: Pagination (ex: "1", "2", "3") suivie d'un numéro de chambre
  // Ex: "1 02 Chambre triple" → "1\n02 Chambre triple"
  processed = processed.replace(/(\s)(\d{1})\s+(0?\d{1,2})\s+(Chambre\s+(?:twin|triple|double|simple|quadruple|standard))/gi, '$1$2\n$3 $4');
  
  // Pattern 5: "Ch. NN" format  
  processed = processed.replace(/(Ch\.?\s*)(0?\d{1,3})(\s+(?:Chambre|Type))/gi, '\n$1$2$3');
  
  // Pattern 6: Format numéro seul en début apparent (après info facture, etc.)
  // Ex: "...250518012) 02 Chambre triple" → séparer avant 02
  processed = processed.replace(/(\))\s*(0?\d{1,2})\s+(Chambre\s+(?:twin|triple|double|simple|quadruple|standard))/gi, '$1\n$2 $3');
  
  // Pattern 7: Format avec statut "Sale" ou autre juste avant le numéro suivant
  // Ex: "...Sale TW // NR 02 Chambre" 
  processed = processed.replace(/(NR|RO|BB|FLEX)\s+(0?\d{1,2})\s+(Chambre)/gi, '$1\n$2 $3');
  
  return processed;
}

/**
 * Process PDF file - utilise le service unifié
 */

export async function processPdf(file: File, hotelId?: string): Promise<Room[]> {
  try {
    // Extraire le texte du PDF
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n'; // Ajouter newline entre pages
    }
    
    // Prétraiter le texte pour séparer les chambres
    fullText = preprocessPdfText(fullText);
    
    console.log("📄 PDF texte extrait et prétraité:", fullText.substring(0, 500) + "...");
    lastExtractedText = fullText;
    
    let rooms: Room[] = [];
    
    // Utiliser le service unifié
    if (hotelId) {
      console.log(`🔄 Parsing avec unifiedParserService pour hôtel ${hotelId}...`);
      
      const result = await unifiedParserService.parseReport(fullText, hotelId);
      
      console.log(`✅ PMS détecté: ${result.pmsType} (confiance: ${result.confidence.toFixed(1)}%)`);
      console.log(`📊 ${result.rooms.length} chambres extraites`);
      console.log(`🎓 Patterns appris utilisés: ${result.usedLearnedPatterns}`);
      
      rooms = convertExtractedRoomsToRooms(result.rooms);
      
      if (rooms.length > 0) {
        toast({
          title: "Extraction réussie",
          description: `${rooms.length} chambres extraites (${result.pmsType})`,
        });
        return rooms;
      }
    } else {
      // Sans hotelId, utiliser la détection simple
      console.log('🔄 Parsing sans hotelId...');
      
      const detection = unifiedParserService.detectPmsType(fullText);
      console.log(`🔍 PMS détecté: ${detection.pmsType} (confiance: ${detection.confidence.toFixed(1)}%)`);
      
      // Utiliser le service sans charger les patterns spécifiques
      const result = await unifiedParserService.parseReport(fullText, 'default');
      rooms = convertExtractedRoomsToRooms(result.rooms);
    }
    
    toast({
      title: "PDF Processed",
      description: `${rooms.length} chambres traitées depuis ${file.name}`,
    });
    
    // Si aucune chambre trouvée, retourner des données de test
    if (rooms.length === 0) {
      console.log("⚠️ Aucune chambre détectée, utilisation des données simulées");
      return generateMockRoomData();
    }
    
    return rooms;
  } catch (error) {
    console.error("❌ Error processing PDF:", error);
    toast({
      variant: "destructive",
      title: "Processing Failed",
      description: "Failed to process the PDF file. Please try again.",
    });
    throw error;
  }
}

/**
 * Génère des données de test
 */
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
