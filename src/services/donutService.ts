
const API_TOKEN = "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";
const API_URL = "https://api-inference.huggingface.co/models/naver-clova-ix/donut-base-finetuned-docvqa";

interface DonutResponse {
  generated_text: string;
}

export async function processImageWithDonut(imageData: ArrayBuffer, prompt?: string): Promise<string> {
  try {
    console.log("Envoi de l'image au modèle Donut...");
    
    const task_prompt = prompt || 
      "Extract room information from this housekeeping report: room number, status (departure/arrival/stayover/clean/maintenance), cleaning type required";
    
    const formData = new FormData();
    formData.append("file", new Blob([imageData], {type: "application/pdf"}));
    formData.append("task_prompt", task_prompt);
    
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_TOKEN}`
      },
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Erreur API: ${response.status} ${response.statusText}`);
    }
    
    const result: DonutResponse = await response.json();
    console.log("Réponse Donut:", result);
    
    return result.generated_text;
  } catch (error) {
    console.error("Erreur lors du traitement avec Donut:", error);
    throw error;
  }
}

export function parseDonutOutput(donutText: string) {
  try {
    // Tentative de parsing JSON
    try {
      return JSON.parse(donutText);
    } catch {
      // Parsing de texte si pas JSON
    }
    
    const lines = donutText.split('\n').filter(line => line.trim());
    const rooms = [];
    
    for (const line of lines) {
      // Patterns améliorés pour détecter les chambres
      const roomPatterns = [
        /(?:Chambre\s*)?(\d{1,3})(?:\s*[-:]\s*|\s+)(.+)/i,
        /^(\d{1,3})\s+([A-Z]{2,3})\s+(.+)/i, // Format: "101 DBL DIR..."
        /Room\s+(\d{1,3})\s*[:-]\s*(.+)/i
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
        
        const { status, cleaningType } = determineStatusAndCleaningTypeFromDonut(fullLine, statusInfo);
        
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
    console.error("Erreur lors du parsing de la sortie Donut:", error);
    return { rooms: [] };
  }
}

function determineStatusAndCleaningTypeFromDonut(line: string, statusInfo: string): { status: string, cleaningType: 'full' | 'quick' | 'none' } {
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
