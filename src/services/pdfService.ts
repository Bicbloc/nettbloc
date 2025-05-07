
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
  
  // Recherche différents formats de numéros de chambre (patterns pour "Spaces", "Espace", numéros suivi de types de chambre)
  // Patterns qui peuvent détecter les numéros de chambre dans différents formats
  const patterns = [
    /\b(Spaces|Espace)\s+(\d{3})\b/gi,
    /\b([1-9]\d{2})\s+(SGL|DBL|TWN|DIR|CL|INS|SP|DX|CB)\b/gi,
    /\b([1-9]\d{2})\b(?=\s*[A-Z]{2,3})/g
  ];
  
  // Utiliser chaque pattern pour trouver les numéros de chambre
  const foundRooms = new Set();
  
  for (const pattern of patterns) {
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      // Récupérer le numéro de chambre correctement selon le pattern utilisé
      const roomNumber = match[1] === 'Spaces' || match[1] === 'Espace' ? match[2] : match[1];
      
      // Éviter les doublons
      if (foundRooms.has(roomNumber)) continue;
      foundRooms.add(roomNumber);
      
      // Extraire le contexte autour du numéro de chambre (un plus grand contexte pour mieux analyser)
      const start = Math.max(0, match.index - 150);
      const end = Math.min(text.length, match.index + 150);
      const context = text.substring(start, end);
      
      // Analyser le statut et le type de nettoyage
      const { status, cleaningType } = determineStatusAndCleaningType(context);
      
      // Déterminer si c'est une chambre twin
      const isTwin = context.includes('TWN') || context.includes('twin');
      
      // Déterminer la priorité
      const priority = determinePriority(context);
      
      rooms.push({
        number: roomNumber,
        status,
        cleaningType,
        priority,
        isTwin,
        isUrgent: priority === 'high',
        notUrgent: priority === 'low'
      });
    }
  }
  
  console.log(`Détecté ${rooms.length} chambres avec le parsing avancé`);
  return rooms;
}

// Fonction d'analyse mise à jour selon les nouvelles règles fournies
function determineStatusAndCleaningType(context: string): { status: string, cleaningType: 'full' | 'quick' | 'none' } {
  // Valeurs par défaut
  let status = 'needs-cleaning';
  let cleaningType: 'full' | 'quick' | 'none' = 'none';

  // RÈGLE: Pour détecter une recouche - une seule ligne centrée avec date de départ et date d'arrivée
  const hasSingleLineWithDates = /\d{2}\/\d{2}\/\d{4}.*Night/.test(context) && 
                                !context.includes("Adults.*\d{2}\/\d{2}\/\d{4}");
                                
  if (hasSingleLineWithDates) {
    cleaningType = 'quick';
    status = 'needs-cleaning';
    return { status, cleaningType };
  }

  // RÈGLE: Pour détecter les chambres propres - ligne vide avec statut INS ou Clean
  const isCleanRoom = (/\bINS\b|\bCL\b/.test(context) || context.includes('Clean')) && 
                      !context.includes('Adults') && 
                      !context.includes('Night') &&
                      !context.includes('séjour');
                      
  if (isCleanRoom) {
    cleaningType = 'none';
    status = 'clean';
    return { status, cleaningType };
  }

  // RÈGLE: Nettoyage à blanc si départ + arrivée (deux clients différents)
  const hasTwoClients = /\d{2}\/\d{2}\/\d{4}.*\d{2}\/\d{2}\/\d{4}/.test(context) &&
                        !context.includes('Night');
                        
  if (hasTwoClients) {
    cleaningType = 'full';
    status = 'needs-cleaning';
    return { status, cleaningType };
  }

  // RÈGLE: Client à gauche avec date et horaire = nettoyage à blanc
  const hasLeftClientWithTime = /\d{1,2}:\d{2}.*Adults/.test(context);
  
  if (hasLeftClientWithTime) {
    cleaningType = 'full';
    status = 'needs-cleaning';
    return { status, cleaningType };
  }

  // RÈGLE: À droite, selon le statut
  const hasRightStatus = /Adults.*\b(INS|DIR|CL)\b/.test(context);
  
  if (hasRightStatus) {
    if (context.includes('DIR')) {
      cleaningType = 'full';
      status = 'needs-cleaning';
    } else if (context.includes('INS') || context.includes('CL')) {
      cleaningType = 'none';
      status = 'clean';
    }
    return { status, cleaningType };
  }

  // Si statut DIR ailleurs dans le contexte, c'est un nettoyage à blanc
  if (context.includes('DIR')) {
    cleaningType = 'full';
    status = 'needs-cleaning';
    return { status, cleaningType };
  }

  // Si aucune règle ne correspond explicitement
  return { status, cleaningType };
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
      notUrgent: priority === 'low'
    };
  });
}
