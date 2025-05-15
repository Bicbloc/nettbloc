import { Room, CleaningConfig } from "./pdfService";
import html2pdf from "html2pdf.js";
import { getFirstDigitFromRoomNumber } from "@/lib/utils";
import { ReportFields as CustomReportFields } from "@/components/ReportCustomFields";
import { toast } from "@/hooks/use-toast"; // Adding the import for toast

// Renamed to avoid conflict
export interface ReportData extends CustomReportFields {
  roomCount: number;
  housekeeperName: string;
  rooms: Room[];
  currentDate: string;
  config: CleaningConfig;
}

// Generate a PDF report
export async function generateReport(
  housekeeper: string,
  rooms: Room[],
  config: CleaningConfig,
  emailAddress: string,
  customFields?: CustomReportFields
): Promise<boolean> {
  try {
    // Get today's date in French locale
    const today = new Date();
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const currentDate = today.toLocaleDateString('fr-FR', dateOptions as any);
    
    // Sort rooms by floor and then room number
    const sortedRooms = [...rooms].sort((a, b) => {
      // Extract floor and room numbers
      const floorA = parseInt(a.number.charAt(0));
      const floorB = parseInt(b.number.charAt(0));
      
      // Compare floors first
      if (floorA !== floorB) {
        return floorA - floorB;
      }
      
      // If on same floor, compare room numbers
      return a.number.localeCompare(b.number, undefined, { numeric: true });
    });
    
    // Prepare the report data
    const reportData: ReportData = {
      roomCount: sortedRooms.length,
      housekeeperName: housekeeper,
      rooms: sortedRooms,
      currentDate: currentDate,
      config: config,
      // Include custom fields if provided
      toDoItems: customFields?.toDoItems || [],
      toKnowItems: customFields?.toKnowItems || [],
      instructions: customFields?.instructions || '',
      generalInstructions: customFields?.generalInstructions || '',
      housekeeperInstructions: customFields?.housekeeperInstructions || {}
    };
    
    // Generate the HTML for the report
    const html = generateReportHTML(reportData);
    
    // Generate PDF using html2pdf library
    const pdfOptions = {
      margin: [10, 10, 10, 10],
      filename: `rapport-${housekeeper.replace(/\s+/g, '-')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, logging: false, dpi: 192, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    // Convert HTML to PDF and download
    await html2pdf().from(html).set(pdfOptions).save();
    
    toast({
      title: "Rapport généré",
      description: `Le rapport pour ${housekeeper} a été téléchargé.`
    });
    
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    toast({
      title: "Erreur de génération",
      description: "Une erreur est survenue lors de la génération du rapport.",
      variant: "destructive"
    });
    return false;
  }
}

// Generate HTML for report
function generateReportHTML(data: ReportData): string {
  // Prepare to-do and to-know sections if they exist
  let todoHtml = '';
  let toknowHtml = '';
  let instructionsHtml = '';
  
  // Instructions section - use specific housekeeper instructions if available
  const housekeeperInstructions = data.housekeeperInstructions?.[data.housekeeperName] || data.instructions || '';
  const generalInstructions = data.generalInstructions || '';
  
  // Combined instructions
  const combinedInstructions = [generalInstructions, housekeeperInstructions].filter(Boolean).join('<br><br>');
  
  if (combinedInstructions) {
    instructionsHtml = `
      <div class="instructions-section">
        <h3>Instructions</h3>
        <div>${combinedInstructions}</div>
      </div>
    `;
  }
  
  // Process to-do list if present
  if (data.toDoItems && data.toDoItems.some(item => item.trim())) {
    const todoItems = data.toDoItems
      .filter(item => item.trim())
      .map(item => `<li>${item}</li>`)
      .join('');
      
    todoHtml = `
      <div class="todo-section">
        <h3>À faire</h3>
        <ul>${todoItems}</ul>
      </div>
    `;
  }
  
  // Process to-know list if present
  if (data.toKnowItems && data.toKnowItems.some(item => item.trim())) {
    const toknowItems = data.toKnowItems
      .filter(item => item.trim())
      .map(item => `<li>${item}</li>`)
      .join('');
      
    toknowHtml = `
      <div class="toknow-section">
        <h3>À savoir</h3>
        <ul>${toknowItems}</ul>
      </div>
    `;
  }
  
  // Get room summary and rooms table HTML
  const summaryHtml = generateRoomSummary(data);
  const roomsTableHtml = generateRoomsTable(data);
  
  // Complete HTML
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Rapport - ${data.housekeeperName}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
        h1 { font-size: 18px; margin-bottom: 5px; }
        h2 { font-size: 16px; margin-top: 10px; margin-bottom: 5px; }
        h3 { font-size: 14px; margin-top: 15px; margin-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; page-break-inside: auto; }
        table, th, td { border: 1px solid #000; }
        th, td { padding: 5px; text-align: left; font-size: 11px; }
        th { background-color: #f0f0f0; }
        .info { margin-bottom: 15px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .footer { margin-top: 20px; text-align: center; font-size: 10px; }
        .todo-section, .toknow-section, .instructions-section { margin-top: 15px; }
        ul { margin-top: 5px; padding-left: 20px; }
        .room-type { font-weight: bold; }
        .a-blanc { background-color: #FFD580; }
        .recouche { background-color: #90EE90; }
        @media print {
          body { margin: 0; }
          .page-break { page-break-after: always; }
        }
        .signature { margin-top: 30px; border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 5px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>Rapport de Nettoyage - ${data.housekeeperName}</h1>
          <div class="info">Date: ${data.currentDate}</div>
        </div>
      </div>
      
      ${instructionsHtml}
      ${todoHtml}
      ${toknowHtml}
      
      <h2>Résumé des chambres</h2>
      ${summaryHtml}
      
      <h2>Liste des chambres à nettoyer</h2>
      ${roomsTableHtml}
      
      <div class="signature">
        Signature
      </div>
      
      <div class="footer">
        Bicbloc Report - Généré le ${data.currentDate}
      </div>
    </body>
    </html>
  `;
}

// Generate room summary HTML
function generateRoomSummary(data: ReportData): string {
  // Count different room types
  const fullCleanCount = data.rooms.filter(room => room.cleaningType === 'full').length;
  const quickCleanCount = data.rooms.filter(room => room.cleaningType === 'quick').length;
  
  // Calculate estimated time
  const estimatedTime = fullCleanCount * data.config.fullCleaningTime + 
                        quickCleanCount * data.config.quickCleaningTime;
  
  return `
    <table>
      <tr>
        <th>Type de nettoyage</th>
        <th>Nombre de chambres</th>
      </tr>
      <tr>
        <td>À Blanc</td>
        <td>${fullCleanCount}</td>
      </tr>
      <tr>
        <td>Recouche</td>
        <td>${quickCleanCount}</td>
      </tr>
      <tr>
        <th>Total</th>
        <th>${data.rooms.length}</th>
      </tr>
      <tr>
        <td>Temps estimé</td>
        <td>${estimatedTime} minutes</td>
      </tr>
    </table>
  `;
}

// Generate rooms table HTML
function generateRoomsTable(data: ReportData): string {
  if (data.rooms.length === 0) {
    return '<p>Aucune chambre assignée.</p>';
  }
  
  // Group rooms by floor
  const roomsByFloor: Record<number, Room[]> = {};
  
  data.rooms.forEach(room => {
    const floor = parseInt(room.number.charAt(0));
    if (!roomsByFloor[floor]) {
      roomsByFloor[floor] = [];
    }
    roomsByFloor[floor].push(room);
  });
  
  // Sort floors
  const sortedFloors = Object.keys(roomsByFloor)
    .map(Number)
    .sort((a, b) => a - b);
  
  // Build table for each floor
  const tablesHtml = sortedFloors.map(floor => {
    const roomsOnFloor = roomsByFloor[floor];
    
    // Sort rooms on this floor by number
    roomsOnFloor.sort((a, b) => 
      a.number.localeCompare(b.number, undefined, { numeric: true })
    );
    
    // Create rows for each room
    const rowsHtml = roomsOnFloor.map(room => {
      // Change the display text and add highlighting classes
      const cleaningTypeClass = room.cleaningType === 'full' ? 'a-blanc' : 'recouche';
      const cleaningTypeText = room.cleaningType === 'full' ? 'À Blanc' : 'Recouche';
      const priorityText = room.priority === 'high' ? '⚠️ Haute' : 'Normale';
      
      return `
        <tr>
          <td>${room.number}</td>
          <td class="room-type ${cleaningTypeClass}">${cleaningTypeText}</td>
          <td>${room.isTwin ? 'Oui' : 'Non'}</td>
          <td>${priorityText}</td>
          <td>${room.notes || '-'}</td>
          <td></td>
        </tr>
      `;
    }).join('');
    
    return `
      <h3>Étage ${floor === 0 ? 'RDC' : floor}</h3>
      <table>
        <tr>
          <th>Chambre</th>
          <th>Type</th>
          <th>Double</th>
          <th>Priorité</th>
          <th>Notes</th>
          <th>Remarques</th>
        </tr>
        ${rowsHtml}
      </table>
    `;
  }).join('');
  
  return tablesHtml;
}

// Generate combined report for all housekeepers into a single file
export async function generateCombinedReport(
  housekeeperRooms: { name: string; rooms: Room[] }[],
  config: CleaningConfig,
  emailAddress: string,
  customFields?: CustomReportFields
): Promise<boolean> {
  try {
    // Filter out housekeepers with no rooms
    const validHousekeepers = housekeeperRooms.filter(item => item.rooms.length > 0);
    
    if (validHousekeepers.length === 0) {
      toast({
        title: "Aucune chambre assignée",
        description: "Il n'y a pas de chambres assignées aux femmes de chambre.",
        variant: "destructive"
      });
      return false;
    }

    // Create HTML for each housekeeper
    const allHousekeepersHTML = await Promise.all(validHousekeepers.map(async ({ name, rooms }) => {
      // Get today's date in French locale
      const today = new Date();
      const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      const currentDate = today.toLocaleDateString('fr-FR', dateOptions as any);
      
      // Sort rooms by floor and then room number
      const sortedRooms = [...rooms].sort((a, b) => {
        // Extract floor and room numbers
        const floorA = parseInt(a.number.charAt(0));
        const floorB = parseInt(b.number.charAt(0));
        
        // Compare floors first
        if (floorA !== floorB) {
          return floorA - floorB;
        }
        
        // If on same floor, compare room numbers
        return a.number.localeCompare(b.number, undefined, { numeric: true });
      });
      
      // Prepare the report data
      const reportData: ReportData = {
        roomCount: sortedRooms.length,
        housekeeperName: name,
        rooms: sortedRooms,
        currentDate: currentDate,
        config: config,
        // Include custom fields if provided
        toDoItems: customFields?.toDoItems || [],
        toKnowItems: customFields?.toKnowItems || [],
        instructions: customFields?.instructions || '',
        generalInstructions: customFields?.generalInstructions || '',
        housekeeperInstructions: customFields?.housekeeperInstructions || {}
      };
      
      // Generate section for this housekeeper
      return generateReportHTML(reportData);
    }));

    // Combine all HTML into a single document with page breaks
    const combinedHTML = allHousekeepersHTML.join('<div class="page-break"></div>');
    
    // Generate PDF using html2pdf library
    const pdfOptions = {
      margin: [10, 10, 10, 10],
      filename: `rapports-complet-${new Date().toISOString().slice(0,10)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, logging: false, dpi: 192, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    // Convert HTML to PDF and download as a single file
    await html2pdf().from(combinedHTML).set(pdfOptions).save();
    
    toast({
      title: "Rapports générés",
      description: `Un fichier PDF combinant les rapports de ${validHousekeepers.length} femmes de chambre a été téléchargé.`
    });
    
    return true;
  } catch (error) {
    console.error("Error generating combined reports:", error);
    toast({
      title: "Erreur de génération",
      description: "Une erreur est survenue lors de la génération des rapports.",
      variant: "destructive"
    });
    return false;
  }
}
