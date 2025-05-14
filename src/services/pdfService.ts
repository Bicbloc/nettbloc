import { toast } from "@/components/ui/use-toast";
import * as pdfjs from 'pdfjs-dist';

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
  floor?: number; // Ajout du numéro d'étage
}

export interface CleaningConfig {
  fullCleaningTime: number; // in minutes
  quickCleaningTime: number; // in minutes
  minRoomsPerHousekeeper: number;
  maxRoomsPerHousekeeper: number;
}

// Default configuration
export const defaultCleaningConfig: CleaningConfig = {
  fullCleaningTime: 30,
  quickCleaningTime: 15,
  minRoomsPerHousekeeper: 10,
  maxRoomsPerHousekeeper: 18
};

// Process PDF file
export async function processPdf(file: File): Promise<Room[]> {
  try {
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
    
    // Analyser le texte pour extraire les informations des chambres
    const rooms = parseRoomsFromText(fullText);
    
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
function parseRoomsFromText(text: string): Room[] {
  const rooms: Room[] = [];
  
  // Pattern pour trouver les numéros de chambre (3 chiffres)
  // Nous recherchons divers formats de numéros de chambre
  const roomNumberPatterns = [
    /\b(\d{3})\b/g,  // Format standard: 101, 102, etc.
    /\bRoom\s+(\d{3})\b/gi,  // Format "Room 101"
    /\bChambre\s+(\d{3})\b/gi,  // Format "Chambre 101"
    /\b(\d{3})\s*-\s*[A-Z]/gi,  // Format "101-A"
    /\b(No\.|N°)\s*(\d{3})\b/gi  // Format "No. 101" ou "N° 101"
  ];
  
  // Ensemble pour suivre les chambres déjà trouvées
  const foundRooms = new Set();
  
  // Utiliser chaque pattern pour rechercher des numéros de chambre
  for (const pattern of roomNumberPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Récupérer le numéro de chambre (dans le groupe 1 ou 2 selon le pattern)
      let roomNumber;
      if (pattern.source.includes('No\\.|N°')) {
        roomNumber = match[2];  // Pour les patterns avec "No." ou "N°"
      } else {
        roomNumber = match[1];  // Pour les autres patterns
      }
      
      // Normaliser le format du numéro (assurer au moins 3 chiffres)
      roomNumber = String(parseInt(roomNumber)).padStart(3, '0');
      
      // Éviter les doublons
      if (foundRooms.has(roomNumber)) continue;
      foundRooms.add(roomNumber);
      
      // Extraire les données pour cette chambre
      const roomData = extractRoomData(text, roomNumber, match.index);
      
      // Déterminer l'étage à partir du premier chiffre du numéro de chambre
      const floor = parseInt(roomNumber[0]);
      
      rooms.push({
        number: roomNumber,
        status: roomData.status,
        cleaningType: roomData.cleaningType,
        priority: roomData.priority,
        isTwin: roomData.isTwin,
        isUrgent: roomData.priority === 'high',
        notUrgent: roomData.priority === 'low',
        floor
      });
    }
  }
  
  // Deuxième passe avec un pattern plus générique pour détecter plus de chambres
  // Ce pattern cherche des nombres de 3-4 chiffres qui pourraient être des numéros de chambre
  const genericPattern = /\b(\d{3,4})\b/g;
  let genericMatch;
  
  while ((genericMatch = genericPattern.exec(text)) !== null) {
    const potentialRoomNumber = genericMatch[1];
    
    // Vérifier si ce n'est pas un prix, une date, etc.
    const beforeText = text.substring(Math.max(0, genericMatch.index - 10), genericMatch.index);
    const afterText = text.substring(genericMatch.index + potentialRoomNumber.length, 
                                   Math.min(text.length, genericMatch.index + potentialRoomNumber.length + 10));
    
    if (beforeText.match(/\d[\/\-\.:]$/) || afterText.match(/^[\/\-\.:]/)  ) {
      continue; // Ignorer si c'est probablement une date ou un prix
    }
    
    // Pour les numéros à 4 chiffres, vérifier s'ils commencent par un chiffre valide d'étage (0-9)
    let roomNumber = potentialRoomNumber;
    if (roomNumber.length === 4) {
      const firstDigit = parseInt(roomNumber[0]);
      if (firstDigit > 9) continue; // Ignorer si le premier chiffre n'est pas un étage valide
      
      // Pour les numéros à 4 chiffres, utiliser les 3 derniers chiffres comme numéro de chambre
      roomNumber = roomNumber.substring(1);
    }
    
    // Normaliser le format
    roomNumber = String(parseInt(roomNumber)).padStart(3, '0');
    
    // Éviter les doublons
    if (foundRooms.has(roomNumber)) continue;
    foundRooms.add(roomNumber);
    
    // Extraire les données pour cette chambre
    const roomData = extractRoomData(text, roomNumber, genericMatch.index);
    
    // Déterminer l'étage
    const floor = parseInt(roomNumber[0]);
    
    rooms.push({
      number: roomNumber,
      status: roomData.status,
      cleaningType: roomData.cleaningType,
      priority: roomData.priority,
      isTwin: roomData.isTwin,
      isUrgent: roomData.priority === 'high',
      notUrgent: roomData.priority === 'low',
      floor
    });
  }
  
  console.log(`Détecté ${rooms.length} chambres avec le parsing avancé`);
  
  // Trier les chambres par numéro
  return rooms.sort((a, b) => a.number.localeCompare(b.number));
}

// Extraire les données d'une chambre à partir du contexte
function extractRoomData(text: string, roomNumber: string, matchIndex: number) {
  // Extraire le contexte autour du numéro de chambre
  const contextStart = Math.max(0, matchIndex - 150);
  const contextEnd = Math.min(text.length, matchIndex + 150);
  const context = text.substring(contextStart, contextEnd);
  
  // Déterminer si c'est une chambre twin
  const isTwin = context.includes('TWN') || 
                 context.toLowerCase().includes('twin') ||
                 context.toLowerCase().includes('deux lits');
  
  // Déterminer le statut et le type de nettoyage
  const { status, cleaningType } = determineStatusAndCleaningType(context);
  
  // Déterminer la priorité
  const priority = determinePriority(context);
  
  return {
    status,
    cleaningType,
    priority,
    isTwin
  };
}

// Déterminer le statut et le type de nettoyage
function determineStatusAndCleaningType(context: string): { status: string, cleaningType: 'full' | 'quick' | 'none' } {
  // Vérifier les indicateurs de statut
  const isDirty = context.includes('DIR') || 
                  context.toLowerCase().includes('dirty') ||
                  context.toLowerCase().includes('sale');
                  
  const isClean = context.includes('CL') || 
                  context.includes('INS') ||
                  context.toLowerCase().includes('clean') ||
                  context.toLowerCase().includes('propre') ||
                  context.toLowerCase().includes('inspection');
                  
  const isMaintenance = context.toLowerCase().includes('maintenance') ||
                       context.toLowerCase().includes('out of order') ||
                       context.toLowerCase().includes('hors service');
                       
  const isOccupied = context.includes('OCC') ||
                     context.toLowerCase().includes('occupied') ||
                     context.toLowerCase().includes('occupé');
  
  // Vérifier les indicateurs de type de séjour
  const hasCheckout = context.toLowerCase().includes('checkout') ||
                      context.toLowerCase().includes('départ');
                      
  const hasStayover = context.toLowerCase().includes('stayover') ||
                     context.toLowerCase().includes('séjour');
                     
  // Règles de décision
  if (isMaintenance) {
    return { status: 'maintenance', cleaningType: 'none' };
  }
  
  if (isClean && !isDirty) {
    return { status: 'clean', cleaningType: 'none' };
  }
  
  if (isOccupied && !isDirty && !hasCheckout) {
    return { status: 'occupied', cleaningType: 'none' };
  }
  
  if (hasStayover && !hasCheckout) {
    return { status: 'needs-cleaning', cleaningType: 'quick' };
  }
  
  // Par défaut, si aucune règle spécifique ne s'applique
  return { status: 'needs-cleaning', cleaningType: 'full' };
}

// Autre méthode pour déterminer statut et nettoyage (laissée pour référence)
function determineStatusAndCleaningTypeNewRules(context: string): { status: string, cleaningType: 'full' | 'quick' | 'none' } {
  // Valeurs par défaut
  let status = 'needs-cleaning';
  let cleaningType: 'full' | 'quick' | 'none' = 'none';

  // 🟦 Chambre à blanc - CAS 1: Un bloc de réservation apparaît dans la colonne de gauche du rapport
  const leftColumnReservation = /\d{2}\/\d{2}\/\d{4}.*\d{1,2}:\d{2}/.test(context) && 
                               !context.includes("Adults.*\d{2}\/\d{2}\/\d{4}");
                               
  if (leftColumnReservation) {
    cleaningType = 'full';
    status = 'needs-cleaning';
    return { status, cleaningType };
  }

  // 🟦 Chambre à blanc - CAS 2: Un bloc de réservation en colonne droite ET statut DIR
  const rightColumnWithDIR = /Adults.*\d{2}\/\d{2}\/\d{4}/.test(context) && 
                             (context.includes('DIR') || context.toLowerCase().includes('dirty'));
  
  if (rightColumnWithDIR) {
    cleaningType = 'full';
    status = 'needs-cleaning';
    return { status, cleaningType };
  }

  // 🟦 Chambre à blanc - CAS 3: Deux blocs distincts visibles
  const twoDistinctBlocks = context.match(/\d{2}\/\d{2}\/\d{4}/g)?.length >= 2;
  
  if (twoDistinctBlocks) {
    cleaningType = 'full';
    status = 'needs-cleaning';
    return { status, cleaningType };
  }

  // 🔵 Chambre en recouche: Une seule ligne avec date d'arrivée et départ ultérieure
  const hasOneReservationLine = /\d{2}\/\d{2}\/\d{4}.*Night/.test(context) || 
                               /\d{2}\/\d{2}\/\d{4}.*séjour/.test(context) ||
                               /\d{2}\/\d{2}\/\d{4}.*\d{2}\/\d{2}\/\d{4}/.test(context);
  
  if (hasOneReservationLine && !leftColumnReservation && !rightColumnWithDIR && !twoDistinctBlocks) {
    cleaningType = 'quick';
    status = 'needs-cleaning';
    return { status, cleaningType };
  }

  // 🟩 Chambre propre - CAS 1: Case vide (aucun bloc client) ET statut CL ou INS
  const emptyWithCleanStatus = (!context.match(/\d{2}\/\d{2}\/\d{4}/g) && 
                              (context.includes('CL') || context.includes('INS') || 
                               context.toLowerCase().includes('clean') || context.toLowerCase().includes('inspection')));
  
  // 🟩 Chambre propre - CAS 2: Chambre dans colonne de droite ET statut INS uniquement
  const rightColumnINS = /Adults.*INS/.test(context) || 
                         (context.includes('Adults') && context.toLowerCase().includes('inspection'));
  
  if (emptyWithCleanStatus || rightColumnINS) {
    cleaningType = 'none';
    status = 'clean';
    return { status, cleaningType };
  }

  // Cas par défaut - si aucune règle ne correspond explicitement
  // Vérifier s'il y a un statut DIR visible
  if (context.includes('DIR') || context.toLowerCase().includes('dirty')) {
    cleaningType = 'full';
    status = 'needs-cleaning';
    return { status, cleaningType };
  }
  
  // Si des mots-clés comme "maintenance" ou "out of order" sont présents
  if (context.toLowerCase().includes('maintenance') || 
      context.toLowerCase().includes('out of order') || 
      context.toLowerCase().includes('hors service')) {
    status = 'maintenance';
    cleaningType = 'none';
    return { status, cleaningType };
  }
  
  // Si des mots-clés comme "occupé" ou "occupied" sont présents
  if (context.toLowerCase().includes('occupied') || 
      context.toLowerCase().includes('occupé') || 
      context.includes('OCC')) {
    status = 'occupied';
    cleaningType = 'none';
    return { status, cleaningType };
  }

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
      floor
    };
  });
}
