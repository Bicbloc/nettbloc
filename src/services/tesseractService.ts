
import { createWorker, Worker } from 'tesseract.js';
import * as pdfjs from 'pdfjs-dist';

let worker: Worker | null = null;

async function initializeWorker(): Promise<Worker> {
  if (!worker) {
    console.log("Initialisation de Tesseract.js (français + anglais)...");
    worker = await createWorker('fra+eng');
  }
  return worker;
}

export async function processImageWithTesseract(imageData: ArrayBuffer | HTMLCanvasElement | string): Promise<string> {
  try {
    console.log("Traitement de l'image avec Tesseract.js...");
    
    const tesseractWorker = await initializeWorker();
    
    const { data: { text } } = await tesseractWorker.recognize(imageData, {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`Reconnaissance OCR: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    console.log("Texte extrait par Tesseract:", text.substring(0, 200) + "...");
    return text;
  } catch (error) {
    console.error("Erreur lors du traitement avec Tesseract:", error);
    throw error;
  }
}

export async function processPdfWithTesseract(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    console.log("Conversion PDF vers image pour Tesseract...");
    
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1); // Traiter la première page
    
    const viewport = page.getViewport({ scale: 2.0 }); // Augmenter la résolution
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error('Impossible de créer le contexte canvas');
    }
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    console.log("PDF converti en image, lancement de l'OCR...");
    return await processImageWithTesseract(canvas);
  } catch (error) {
    console.error("Erreur lors de la conversion PDF:", error);
    throw error;
  }
}

export function parseTesseractOutput(tesseractText: string) {
  try {
    const lines = tesseractText.split('\n').filter(line => line.trim());
    const rooms = [];
    
    for (const line of lines) {
      // Patterns améliorés pour détecter les chambres
      const roomPatterns = [
        /(?:Chambre\s*)?(\d{1,3})(?:\s*[-:]\s*|\s+)(.+)/i,
        /^(\d{1,3})\s+([A-Z]{2,3})\s+(.+)/i, // Format: "101 DBL DIR..."
        /Room\s+(\d{1,3})\s*[:-]\s*(.+)/i,
        /^(\d{3})\s+(.+)/i // Format simple: "101 informations..."
      ];
      
      let roomMatch = null;
      for (const pattern of roomPatterns) {
        roomMatch = line.match(pattern);
        if (roomMatch) break;
      }
      
      if (roomMatch) {
        const roomNumber = roomMatch[1].padStart(3, '0');
        const statusInfo = (roomMatch[2] || '').toLowerCase();
        const fullLine = line.toLowerCase();
        
        const { status, cleaningType } = determineStatusAndCleaningTypeFromTesseract(fullLine, statusInfo);
        
        let priority: 'high' | 'medium' | 'low' = 'medium';
        if (fullLine.includes('urgent') || fullLine.includes('vip')) {
          priority = 'high';
        } else if (fullLine.includes('low priority') || fullLine.includes('basse')) {
          priority = 'low';
        }
        
        const isTwin = /\b(twin|twn|tws)\b/i.test(fullLine);
        const floor = parseInt(roomNumber[0]) || 0;
        
        rooms.push({
          number: roomNumber,
          status,
          cleaningType,
          priority,
          isTwin,
          isUrgent: priority === 'high',
          notUrgent: priority === 'low',
          floor,
          notes: line
        });
      }
    }
    
    return { rooms };
  } catch (error) {
    console.error("Erreur lors du parsing de la sortie Tesseract:", error);
    return { rooms: [] };
  }
}

function determineStatusAndCleaningTypeFromTesseract(line: string, statusInfo: string): { status: string, cleaningType: 'full' | 'quick' | 'none' } {
  // MAINTENANCE
  if (line.includes('maintenance') || 
      line.includes('out of service') ||
      line.includes('out of order') ||
      line.includes('hors d\'usage') ||
      line.includes('punaises de lit')) {
    return { status: 'maintenance', cleaningType: 'none' };
  }
  
  // À BLANC (nettoyage complet)
  if (line.includes('départ') || 
      line.includes('departure') || 
      line.includes('parti') ||
      line.includes('dir') || 
      line.includes('sal') || 
      line.includes('dirty') ||
      line.includes('check-out') ||
      /\d{1,2}:\d{2}/.test(line) || // Présence d'heure
      (line.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g) || []).length >= 2) { // Deux noms différents
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }
  
  // RECOUCHE (nettoyage rapide)
  if (line.includes('recouche') || 
      line.includes('stayover') ||
      line.includes('stay over') ||
      /nuit \d+\/\d+/.test(line)) {
    return { status: 'needs-cleaning', cleaningType: 'quick' };
  }
  
  // PROPRE
  if (line.includes('propre') || 
      line.includes('clean') ||
      line.includes('ins') || 
      line.includes('cl') ||
      statusInfo.includes('ins') ||
      statusInfo.includes('cl')) {
    return { status: 'clean', cleaningType: 'none' };
  }
  
  // Par défaut - à blanc
  return { status: 'needs-cleaning', cleaningType: 'full' };
}

// Nettoyer les ressources à la fermeture
export async function cleanupTesseract() {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}
