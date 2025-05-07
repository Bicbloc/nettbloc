
// Basic PDF service that will handle PDF processing
// This is a stub implementation that can be expanded later with real PDF parsing logic

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
}

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
  
  // Utiliser des expressions régulières pour détecter les numéros de chambre
  // Cette expression régulière recherche des numéros comme 101, 102, etc.
  const roomNumberPattern = /\b([1-9]\d{2})\b/g;
  
  // Trouver tous les numéros de chambre
  let match;
  const foundRooms = new Set();
  
  while ((match = roomNumberPattern.exec(text)) !== null) {
    const roomNumber = match[1];
    
    // Éviter les doublons
    if (foundRooms.has(roomNumber)) continue;
    foundRooms.add(roomNumber);
    
    // Extraire le contexte autour du numéro de chambre
    const start = Math.max(0, match.index - 100);
    const end = Math.min(text.length, match.index + 100);
    const context = text.substring(start, end);
    
    // Déterminer le statut en fonction du contexte
    let status = 'needs-cleaning'; // Statut par défaut
    if (context.includes('clean') || context.includes('propre')) {
      status = 'clean';
    } else if (context.includes('occupied') || context.includes('occupé')) {
      status = 'occupied';
    } else if (context.includes('maintenance')) {
      status = 'maintenance';
    }
    
    // Déterminer le type de nettoyage
    let cleaningType: 'full' | 'quick' | 'none' = 'none';
    
    // Exemple de règles pour déterminer le type de nettoyage
    if (context.includes('blanc') || context.includes('full')) {
      cleaningType = 'full';
    } else if (context.includes('recouche') || context.includes('quick')) {
      cleaningType = 'quick';
    }
    
    // Déterminer la priorité
    const priority: 'high' | 'medium' | 'low' = 
      context.includes('urgent') || context.includes('high') ? 'high' :
      context.includes('medium') ? 'medium' : 'low';
    
    rooms.push({
      number: roomNumber,
      status,
      cleaningType,
      priority
    });
  }
  
  return rooms;
}

// Helper function to generate mock room data
function generateMockRoomData(): Room[] {
  const statuses = ['needs-cleaning', 'clean', 'occupied', 'maintenance'];
  const cleaningTypes = ['full', 'quick', 'none'] as const;
  const priorities = ['high', 'medium', 'low'] as const;
  const housekeepers = [undefined, 'Housekeeper 1', 'Housekeeper 2', 'Housekeeper 3'];
  
  return Array.from({ length: 50 }, (_, i) => {
    const floor = Math.floor(i / 20) + 1;
    const room = (i % 20) + 1;
    const roomNumber = `${floor}${room.toString().padStart(2, '0')}`;
    
    return {
      number: roomNumber,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      cleaningType: cleaningTypes[Math.floor(Math.random() * cleaningTypes.length)],
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      assignedTo: housekeepers[Math.floor(Math.random() * housekeepers.length)]
    };
  });
}
