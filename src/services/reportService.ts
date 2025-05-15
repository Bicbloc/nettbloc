
import { Room, CleaningConfig } from "./pdfService";
import html2pdf from "html2pdf.js";
import { getFirstDigitFromRoomNumber } from "@/lib/utils";
import { ReportFields as CustomReportFields } from "@/components/ReportCustomFields";
import { toast } from "@/hooks/use-toast";

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
    
    // Generate PDF using html2pdf library with improved table handling
    const pdfOptions = {
      margin: [15, 15, 15, 15],
      filename: `rapport-${housekeeper.replace(/\s+/g, '-')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        logging: true, 
        dpi: 300, 
        letterRendering: true,
        useCORS: true
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait',
        compress: true
      },
      pagebreak: { 
        mode: ['avoid-all', 'css', 'legacy'],
        before: '.page-break-before',
        after: '.page-break-after',
        avoid: '.avoid-break'
      }
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
      <div class="instructions-section avoid-break">
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
      <div class="todo-section avoid-break">
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
      <div class="toknow-section avoid-break">
        <h3>À savoir</h3>
        <ul>${toknowItems}</ul>
      </div>
    `;
  }
  
  // Get room summary and rooms table HTML
  const summaryHtml = generateRoomSummary(data);
  const roomsTableHtml = generateRoomsTable(data);
  
  // Complete HTML with improved page break controls and design
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Rapport - ${data.housekeeperName}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap');
        body { 
          font-family: 'Montserrat', Arial, sans-serif; 
          margin: 20px; 
          font-size: 12px;
          line-height: 1.5;
          color: #333;
          background-color: #fff; 
        }
        h1 { 
          font-size: 22px; 
          margin-bottom: 10px; 
          color: #1A1F2C;
          font-weight: 700;
          border-bottom: 2px solid #9b87f5;
          padding-bottom: 8px;
        }
        h2 { 
          font-size: 18px; 
          margin-top: 15px; 
          margin-bottom: 10px;
          color: #7E69AB;
          font-weight: 600;
        }
        h3 { 
          font-size: 16px; 
          margin-top: 15px; 
          margin-bottom: 8px;
          color: #6E59A5;
          font-weight: 500;
        }
        .table-container { 
          page-break-inside: avoid !important; 
          margin-bottom: 20px;
          box-shadow: 0 3px 8px rgba(0,0,0,0.1);
          border-radius: 6px;
          overflow: hidden;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-bottom: 0; 
          table-layout: fixed; 
          background: #fff;
        }
        table, th, td { 
          border: 1px solid #ddd; 
        }
        th { 
          background-color: #9b87f5; 
          color: white; 
          padding: 8px; 
          text-align: left; 
          font-size: 11px;
          font-weight: 600;
        }
        td { 
          padding: 8px; 
          text-align: left; 
          font-size: 11px;
          border-bottom: 1px solid #eee;
        }
        tr:hover {
          background-color: #f9f8ff;
        }
        .info { 
          margin-bottom: 15px; 
          color: #555;
          font-style: italic;
        }
        .header { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          margin-bottom: 25px;
          padding: 15px;
          background: linear-gradient(to right, #f8f7ff, #fff);
          border-radius: 8px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }
        .footer { 
          margin-top: 30px; 
          text-align: center; 
          font-size: 11px;
          padding: 15px;
          border-top: 1px solid #eee;
          color: #666;
          background-color: #f9f9f9;
          border-radius: 0 0 8px 8px;
        }
        .footer-brand {
          font-weight: 600;
          color: #7E69AB;
        }
        .todo-section, .toknow-section, .instructions-section { 
          margin-top: 20px;
          background-color: #f9f8ff;
          padding: 15px;
          border-radius: 8px;
          border-left: 4px solid #9b87f5;
        }
        ul { 
          margin-top: 8px; 
          padding-left: 20px; 
        }
        li {
          margin-bottom: 5px;
        }
        .room-type { 
          font-weight: 600; 
        }
        .a-blanc { 
          background-color: #FEC6A1 !important; 
        }
        .recouche { 
          background-color: #F2FCE2 !important; 
        }
        .floor-section { 
          page-break-inside: avoid !important; 
          margin-bottom: 30px; 
        }
        .floor-heading {
          background-color: #e5deff;
          padding: 10px;
          border-radius: 5px;
          margin-bottom: 10px;
          font-weight: 600;
          color: #6E59A5;
        }
        .page-break { 
          page-break-after: always !important; 
          break-after: page !important; 
        }
        .page-break-before { 
          page-break-before: always !important; 
          break-before: page !important; 
        }
        .page-break-after { 
          page-break-after: always !important; 
          break-after: page !important; 
        }
        .avoid-break { 
          page-break-inside: avoid !important; 
        }
        .signature { 
          margin-top: 40px; 
          border-top: 1px solid #ddd; 
          width: 200px; 
          text-align: center; 
          padding-top: 10px; 
        }
        .housekeeping-icon { 
          font-size: 24px; 
          margin-right: 10px; 
          vertical-align: middle;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 20px;
        }
        .summary-card {
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          padding: 15px;
          text-align: center;
        }
        .summary-title {
          font-size: 14px;
          color: #7E69AB;
          margin-bottom: 5px;
        }
        .summary-value {
          font-size: 22px;
          font-weight: 700;
          color: #1A1F2C;
        }
        .summary-card.a-blanc {
          border-left: 4px solid #FEC6A1;
        }
        .summary-card.recouche {
          border-left: 4px solid #F2FCE2;
        }
        .summary-card.total {
          border-left: 4px solid #9b87f5;
        }
        .summary-card.time {
          border-left: 4px solid #D3E4FD;
        }
      </style>
    </head>
    <body>
      <div class="header avoid-break">
        <div>
          <h1><span class="housekeeping-icon">🧹</span>Rapport de Nettoyage - ${data.housekeeperName}</h1>
          <div class="info">Date: ${data.currentDate}</div>
        </div>
      </div>
      
      ${instructionsHtml}
      ${todoHtml}
      ${toknowHtml}
      
      <div class="avoid-break">
        <h2>Résumé des chambres</h2>
        ${summaryHtml}
      </div>
      
      <div class="avoid-break page-break-before">
        <h2>Liste des chambres à nettoyer</h2>
        <div class="rooms-section">
          ${roomsTableHtml}
        </div>
      </div>
      
      <div class="signature avoid-break">
        Signature
      </div>
      
      <div class="footer">
        <p>Généré le ${data.currentDate}</p>
        <p class="footer-brand">Généré par bicbloc.eu Staffing - Commander un extra en trois 3 clics</p>
      </div>
    </body>
    </html>
  `;
}

// Generate room summary HTML with enhanced design
function generateRoomSummary(data: ReportData): string {
  // Count different room types
  const fullCleanCount = data.rooms.filter(room => room.cleaningType === 'full').length;
  const quickCleanCount = data.rooms.filter(room => room.cleaningType === 'quick').length;
  
  // Calculate estimated time
  const estimatedTime = fullCleanCount * data.config.fullCleaningTime + 
                        quickCleanCount * data.config.quickCleaningTime;
  
  return `
    <div class="summary-grid">
      <div class="summary-card a-blanc">
        <div class="summary-title">À Blanc</div>
        <div class="summary-value">${fullCleanCount}</div>
      </div>
      <div class="summary-card recouche">
        <div class="summary-title">Recouche</div>
        <div class="summary-value">${quickCleanCount}</div>
      </div>
      <div class="summary-card total">
        <div class="summary-title">Total</div>
        <div class="summary-value">${data.rooms.length}</div>
      </div>
      <div class="summary-card time">
        <div class="summary-title">Temps estimé</div>
        <div class="summary-value">${estimatedTime} min</div>
      </div>
    </div>
  `;
}

// Generate rooms table HTML with enhanced design
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
  const tablesHtml = sortedFloors.map((floor, index) => {
    const roomsOnFloor = roomsByFloor[floor];
    
    // Sort rooms on this floor by number
    roomsOnFloor.sort((a, b) => 
      a.number.localeCompare(b.number, undefined, { numeric: true })
    );
    
    // Create rows for each room
    const rowsHtml = roomsOnFloor.map(room => {
      // Apply highlighting classes based on cleaning type
      const cleaningTypeClass = room.cleaningType === 'full' ? 'a-blanc' : 'recouche';
      const cleaningTypeText = room.cleaningType === 'full' ? 'À Blanc' : 'Recouche';
      const priorityText = room.priority === 'high' ? '⚠️ Haute' : 'Normale';
      
      return `
        <tr class="${cleaningTypeClass}">
          <td>${room.number}</td>
          <td class="room-type">${cleaningTypeText}</td>
          <td>${room.isTwin ? 'Oui' : 'Non'}</td>
          <td>${priorityText}</td>
          <td>${room.notes || '-'}</td>
          <td></td>
        </tr>
      `;
    }).join('');
    
    // Add page break before new floor section if not the first floor
    const pageBreakClass = index > 0 && index % 2 === 0 ? 'page-break-before' : '';
    
    return `
      <div class="floor-section avoid-break ${pageBreakClass}">
        <div class="floor-heading">Étage ${floor === 0 ? 'RDC' : floor}</div>
        <div class="table-container">
          <table>
            <tr>
              <th>Chambre</th>
              <th>Type</th>
              <th>Twin</th>
              <th>Priorité</th>
              <th>Notes</th>
              <th>Remarques</th>
            </tr>
            ${rowsHtml}
          </table>
        </div>
      </div>
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

    // Create HTML sections for each housekeeper - one per page
    const housekeeperHTMLs: string[] = [];

    for (const { name, rooms } of validHousekeepers) {
      // Get today's date in French locale
      const today = new Date();
      const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      const currentDate = today.toLocaleDateString('fr-FR', dateOptions as any);
      
      // Sort rooms by floor and then room number
      const sortedRooms = [...rooms].sort((a, b) => {
        const floorA = parseInt(a.number.charAt(0));
        const floorB = parseInt(b.number.charAt(0));
        
        if (floorA !== floorB) {
          return floorA - floorB;
        }
        
        return a.number.localeCompare(b.number, undefined, { numeric: true });
      });
      
      // Prepare the report data
      const reportData: ReportData = {
        roomCount: sortedRooms.length,
        housekeeperName: name,
        rooms: sortedRooms,
        currentDate: currentDate,
        config: config,
        toDoItems: customFields?.toDoItems || [],
        toKnowItems: customFields?.toKnowItems || [],
        instructions: customFields?.instructions || '',
        generalInstructions: customFields?.generalInstructions || '',
        housekeeperInstructions: customFields?.housekeeperInstructions || {}
      };
      
      // Generate complete HTML for this housekeeper
      const housekeeperHTML = generateReportHTML(reportData);
      housekeeperHTMLs.push(housekeeperHTML);
    }
    
    // Combine all HTML sections with forced page breaks between them
    const combinedHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Rapports de Nettoyage</title>
        <style>
          .report-container {
            page-break-after: always !important;
            break-after: page !important;
          }
          .report-container:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          /* Prevent table breaking */
          table { page-break-inside: avoid !important; }
        </style>
      </head>
      <body>
        ${housekeeperHTMLs.map(html => `
          <div class="report-container">
            ${html.replace(/<!DOCTYPE[^>]*>|<html[^>]*>|<\/html>|<head>.*?<\/head>|<body>|<\/body>/gs, '')}
          </div>
        `).join('')}
      </body>
      </html>
    `;
    
    // Generate PDF using html2pdf library with improved table handling
    const pdfOptions = {
      margin: [15, 15, 15, 15],
      filename: `rapports-complet-${new Date().toISOString().slice(0,10)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        logging: true, 
        dpi: 300, 
        letterRendering: true,
        useCORS: true
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait',
        compress: true
      },
      pagebreak: { 
        mode: ['avoid-all', 'css', 'legacy'],
        before: '.page-break-before',
        after: '.page-break-after',
        avoid: '.avoid-break'
      }
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
