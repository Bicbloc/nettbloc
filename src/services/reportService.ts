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
      margin: [10, 10, 10, 10],
      filename: `rapport-${housekeeper.replace(/\s+/g, '-')}.pdf`,
      image: { type: 'jpeg', quality: 1 },
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

// Generate HTML for report - Enhanced to match the provided template with improved tables
function generateReportHTML(data: ReportData): string {
  // Instructions section - use specific housekeeper instructions if available
  const housekeeperInstructions = data.housekeeperInstructions?.[data.housekeeperName] || data.instructions || '';
  const generalInstructions = data.generalInstructions || '';
  
  // Combined instructions
  const combinedInstructions = [generalInstructions, housekeeperInstructions].filter(Boolean).join('<br><br>');
  let instructionsHtml = '';
  
  if (combinedInstructions) {
    instructionsHtml = `
      <div class="instructions-section">
        <h3>Instructions</h3>
        <div>${combinedInstructions}</div>
      </div>
    `;
  }
  
  // Process to-do list if present
  let todoHtml = '';
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
  let toknowHtml = '';
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
  
  // Format current date in a readable format (e.g., "jeudi 15 mai 2025")
  const formattedDate = data.currentDate.split(' ').slice(0, 3).join(' ');
  
  // Calculate room counts and estimated time
  const fullCleanCount = data.rooms.filter(room => room.cleaningType === 'full').length;
  const quickCleanCount = data.rooms.filter(room => room.cleaningType === 'quick').length;
  
  // Calculate estimated time
  const estimatedTime = fullCleanCount * data.config.fullCleaningTime + 
                       quickCleanCount * data.config.quickCleaningTime;
  
  // Summary table with improved styling
  const summaryTableHtml = `
    <table border="1" cellpadding="6" cellspacing="0" style="width:100%; border-collapse:collapse; margin-bottom:20px; border:1px solid #000;">
      <tr>
        <th style="background-color:#f2f2f2; border:1px solid #000; text-align:left;">Type de nettoyage</th>
        <th style="background-color:#f2f2f2; border:1px solid #000; text-align:left;">Nombre de chambres</th>
      </tr>
      <tr style="background-color:#FEC6A1;">
        <td style="border:1px solid #000;">À Blanc</td>
        <td style="border:1px solid #000;">${fullCleanCount}</td>
      </tr>
      <tr style="background-color:#F2FCE2;">
        <td style="border:1px solid #000;">Recouche</td>
        <td style="border:1px solid #000;">${quickCleanCount}</td>
      </tr>
      <tr>
        <td style="border:1px solid #000; font-weight:bold;">Total</td>
        <td style="border:1px solid #000; font-weight:bold;">${data.rooms.length}</td>
      </tr>
      <tr>
        <td style="border:1px solid #000;">Temps estimé</td>
        <td style="border:1px solid #000;">${estimatedTime} minutes</td>
      </tr>
    </table>
  `;
  
  // Group rooms by floor for better organization
  const roomsByFloor: Record<number, Room[]> = {};
  
  data.rooms.forEach(room => {
    const floor = getFirstDigitFromRoomNumber(room.number);
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
  let roomsTablesByFloor = '';
  
  sortedFloors.forEach(floor => {
    const roomsOnFloor = roomsByFloor[floor];
    
    // Sort rooms on this floor by number
    roomsOnFloor.sort((a, b) => 
      a.number.localeCompare(b.number, undefined, { numeric: true })
    );
    
    // Create rows for each room with appropriate styling
    let rowsHtml = '';
    roomsOnFloor.forEach(room => {
      // Determine background color based on cleaning type
      const bgColor = room.cleaningType === 'full' ? '#FEC6A1' : '#F2FCE2'; // Orange for full, Green for quick
      const cleaningTypeText = room.cleaningType === 'full' ? 'À Blanc' : 'Recouche';
      const priorityText = room.priority === 'high' ? 'Haute' : 'Normale';
      
      rowsHtml += `
        <tr style="background-color:${bgColor};">
          <td style="border:1px solid #000;">${room.number}</td>
          <td style="border:1px solid #000;">${cleaningTypeText}</td>
          <td style="border:1px solid #000;">${room.isTwin ? 'Oui' : 'Non'}</td>
          <td style="border:1px solid #000;">${priorityText}</td>
          <td style="border:1px solid #000;">${room.notes || '-'}</td>
          <td style="border:1px solid #000;"></td>
        </tr>
      `;
    });
    
    // Complete floor section with table
    roomsTablesByFloor += `
      <div class="floor-section" style="margin-top:20px;">
        <div class="floor-heading" style="font-weight:bold; background-color:#eee; padding:5px; margin-bottom:5px;">
          Étage ${floor === 0 ? 'RDC' : floor}
        </div>
        <table border="1" cellpadding="6" cellspacing="0" style="width:100%; border-collapse:collapse; margin-bottom:20px; border:1px solid #000;">
          <tr>
            <th style="background-color:#f2f2f2; border:1px solid #000; text-align:left;">Chambre</th>
            <th style="background-color:#f2f2f2; border:1px solid #000; text-align:left;">Type</th>
            <th style="background-color:#f2f2f2; border:1px solid #000; text-align:left;">Twin</th>
            <th style="background-color:#f2f2f2; border:1px solid #000; text-align:left;">Priorité</th>
            <th style="background-color:#f2f2f2; border:1px solid #000; text-align:left;">Notes</th>
            <th style="background-color:#f2f2f2; border:1px solid #000; text-align:left;">Remarques</th>
          </tr>
          ${rowsHtml}
        </table>
      </div>
    `;
  });
  
  // Complete HTML with improved styling and encadré for housekeeper name
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Rapport - ${data.housekeeperName}</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          margin: 20px;
          font-size: 12px;
          line-height: 1.5;
        }
        h1 { 
          font-size: 18px; 
          margin-bottom: 5px;
          font-weight: bold;
          border: 2px solid #000;
          padding: 8px;
          display: inline-block;
        }
        h2 { 
          font-size: 16px; 
          margin-top: 20px; 
          margin-bottom: 10px;
          font-weight: bold;
          border-bottom: 1px solid #ddd;
          padding-bottom: 5px;
        }
        h3 {
          font-size: 14px;
          margin-top: 15px;
          margin-bottom: 5px;
          font-weight: bold;
        }
        .date {
          margin-bottom: 20px;
          font-style: italic;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-bottom: 20px;
          page-break-inside: avoid;
        }
        th, td { 
          border: 1px solid #000;
          padding: 6px; 
          text-align: left;
        }
        th { 
          background-color: #f2f2f2; 
          font-weight: bold;
        }
        .signature { 
          margin-top: 30px; 
          border-top: 1px solid #000; 
          width: 200px; 
          text-align: center; 
          padding-top: 10px; 
        }
        .footer { 
          text-align: center;
          margin-top: 40px;
          font-size: 11px;
          padding-top: 10px;
          border-top: 1px solid #ddd;
        }
        ul {
          margin: 5px 0 10px 20px;
          padding-left: 0;
        }
        li {
          margin-bottom: 3px;
        }
        .instructions-section,
        .todo-section,
        .toknow-section { 
          margin-top: 15px;
          margin-bottom: 15px;
          padding: 10px;
          background-color: #f9f9f9;
          border-radius: 4px;
        }
        .housekeeperName {
          border: 2px solid #000;
          padding: 8px;
          font-weight: bold;
          display: inline-block;
          margin-bottom: 15px;
        }
      </style>
    </head>
    <body>
      <h1>Rapport de Nettoyage</h1>
      <div class="housekeeperName">${data.housekeeperName}</div>
      <div class="date">Date: ${formattedDate}</div>
      
      ${instructionsHtml}
      ${todoHtml}
      ${toknowHtml}
      
      <h2>Résumé des chambres</h2>
      ${summaryTableHtml}
      
      <h2>Liste des chambres à nettoyer</h2>
      ${roomsTablesByFloor}
      
      <div class="signature">
        Signature
      </div>
      
      <div class="footer">
        Généré par bicbloc.eu Staffing - Commander un extra en trois 3 clics
      </div>
    </body>
    </html>
  `;
}

// Generate room summary table with improved styling
function generateRoomSummaryTable(data: ReportData): string {
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
      <tr class="a-blanc">
        <td>À Blanc</td>
        <td>${fullCleanCount}</td>
      </tr>
      <tr class="recouche">
        <td>Recouche</td>
        <td>${quickCleanCount}</td>
      </tr>
      <tr>
        <td style="font-weight:bold;">Total</td>
        <td style="font-weight:bold;">${data.rooms.length}</td>
      </tr>
      <tr>
        <td>Temps estimé</td>
        <td>${estimatedTime} minutes</td>
      </tr>
    </table>
  `;
}

// Generate rooms tables grouped by floor
function generateRoomsTablesByFloor(data: ReportData): string {
  if (data.rooms.length === 0) {
    return '<p>Aucune chambre assignée.</p>';
  }
  
  // Group rooms by floor
  const roomsByFloor: Record<number, Room[]> = {};
  
  data.rooms.forEach(room => {
    const floor = getFirstDigitFromRoomNumber(room.number);
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
      // Apply highlighting based on cleaning type
      const rowClass = room.cleaningType === 'full' ? 'a-blanc' : 'recouche';
      const cleaningTypeText = room.cleaningType === 'full' ? 'À Blanc' : 'Recouche';
      
      return `
        <tr class="${rowClass}">
          <td>${room.number}</td>
          <td>${cleaningTypeText}</td>
          <td>${room.isTwin ? 'Oui' : 'Non'}</td>
          <td>${room.priority === 'high' ? 'Haute' : 'Normale'}</td>
          <td>${room.notes || '-'}</td>
          <td></td>
        </tr>
      `;
    }).join('');
    
    // Display floor header and table
    return `
      <div class="floor-section">
        <div class="floor-heading">Étage ${floor === 0 ? 'RDC' : floor}</div>
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
      margin: [10, 10, 10, 10],
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
