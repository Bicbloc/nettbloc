import { Room, CleaningConfig } from "./pdfService";
import html2pdf from "html2pdf.js";
import { getFirstDigitFromRoomNumber } from "@/lib/utils";
import { ReportFields as CustomReportFields, LinenInventoryItem } from "@/components/ReportCustomFields";
import { toast } from "@/hooks/use-toast";
import { supabaseClient } from "@/lib/supabase";
import { getCurrentReportLanguage, getReportTranslations, ReportTranslations } from "./reportTranslations";

// Renamed to avoid conflict
export interface ReportData extends CustomReportFields {
  roomCount: number;
  housekeeperName: string;
  rooms: Room[];
  currentDate: string;
  config: CleaningConfig;
  startTime?: string; // Heure de début (premier téléchargement)
  linenInventory?: LinenInventoryItem[];
}

// Store email in Supabase
export async function storeEmailAddress(email: string): Promise<void> {
  try {
    // Just store locally for now since we don't have a specific table for emails
    console.log("Email stored locally:", email);
  } catch (err) {
    console.error("Error storing email:", err);
    // We don't show errors to the user when saving emails fails
    // to avoid interrupting the report generation flow
  }
}

// Archive a daily report in Supabase so it appears in the Reports page
export async function saveDailyReport(params: {
  roomData: any[];
  assignments: Record<string, any[]>;
  housekeeperNames: string[];
}) {
  try {
    const { data: userData } = await supabaseClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      console.log("Skipping report archive: no authenticated user");
      return { success: false };
    }

    const hotelId = typeof window !== 'undefined' ? localStorage.getItem('selectedHotelId') : null;
    if (!hotelId) {
      console.log("Skipping report archive: no selectedHotelId in localStorage");
      return { success: false };
    }

    const { error } = await supabaseClient
      .from('daily_reports')
      .insert({
        user_id: user.id,
        hotel_id: hotelId,
        report_date: new Date().toISOString().slice(0, 10),
        room_data: params.roomData || [],
        housekeeper_assignments: params.assignments || {},
        housekeeper_names: params.housekeeperNames || [],
        action_log: [],
      });

    if (error) {
      console.error('Error archiving daily report:', error);
      return { success: false, error };
    }

    console.log('✅ Daily report archived successfully');
    return { success: true };
  } catch (e) {
    console.error('Unexpected error archiving daily report:', e);
    return { success: false, error: e };
  }
}

// Generate a PDF report
export async function generateReport(
  housekeeper: string,
  rooms: Room[],
  config: CleaningConfig,
  customFields?: CustomReportFields
): Promise<boolean> {
  try {
    // Get language and translations
    const lang = getCurrentReportLanguage();
    const t = getReportTranslations(lang);
    const locale = lang === 'en' ? 'en-US' : 'fr-FR';
    
    // Get today's date in localized format
    const today = new Date();
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const currentDate = today.toLocaleDateString(locale, dateOptions as any);
    
    // Get or set start time (first download of the day)
    const todayKey = today.toISOString().split('T')[0];
    const startTimeKey = `report_start_time_${todayKey}`;
    let startTime = localStorage.getItem(startTimeKey);
    
    if (!startTime) {
      startTime = today.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
      localStorage.setItem(startTimeKey, startTime);
    }
    
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
      startTime: startTime,
      // Include custom fields if provided
      toDoItems: customFields?.toDoItems || [],
      toKnowItems: customFields?.toKnowItems || [],
      instructions: customFields?.instructions || '',
      generalInstructions: customFields?.generalInstructions || '',
      housekeeperInstructions: customFields?.housekeeperInstructions || {},
      linenInventory: customFields?.linenInventory || []
    };
    
    // Generate the HTML for the report
    const html = generateReportHTML(reportData, t);
    
    // Generate PDF using html2pdf library with improved table handling
    const pdfOptions = {
      margin: [10, 10, 10, 10],
      filename: `${lang === 'en' ? 'report' : 'rapport'}-${housekeeper.replace(/\s+/g, '-')}.pdf`,
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
      title: t.reportGenerated,
      description: t.reportDownloaded
    });
    
    // Archive the report for the Reports page (best-effort)
    await saveDailyReport({
      roomData: sortedRooms,
      assignments: { [housekeeper]: sortedRooms },
      housekeeperNames: [housekeeper],
    });
    
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    const t = getReportTranslations(getCurrentReportLanguage());
    toast({
      title: t.errorGenerating,
      description: t.errorMessage,
      variant: "destructive"
    });
    return false;
  }
}

// Generate HTML for report - Enhanced to match the provided template with improved tables
function generateReportHTML(data: ReportData, t: ReportTranslations): string {
  // Instructions section - use specific housekeeper instructions if available
  const housekeeperInstructions = data.housekeeperInstructions?.[data.housekeeperName] || data.instructions || '';
  const generalInstructions = data.generalInstructions || '';
  
  // Combined instructions
  const combinedInstructions = [generalInstructions, housekeeperInstructions].filter(Boolean).join('<br><br>');
  let instructionsHtml = '';
  
  if (combinedInstructions) {
    instructionsHtml = `
      <div class="instructions-section">
        <h3>${t.instructions}</h3>
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
        <h3>${t.toDo}</h3>
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
        <h3>${t.toKnow}</h3>
        <ul>${toknowItems}</ul>
      </div>
    `;
  }

  // Process linen inventory if present
  let linenInventoryHtml = '';
  const housekeeperLinenItems = (data.linenInventory || []).filter(
    item => item.assignedTo.length === 0 || item.assignedTo.includes(data.housekeeperName)
  );
  
  if (housekeeperLinenItems.length > 0) {
    const linenRows = housekeeperLinenItems
      .filter(item => item.quantity > 0)
      .map(item => `
        <tr>
          <td style="border:1px solid #000; padding:6px;">${item.linenTypeName}</td>
          <td style="border:1px solid #000; padding:6px; text-align:center;">${item.quantity}</td>
          <td style="border:1px solid #000; padding:6px;"></td>
        </tr>
      `).join('');
    
    if (linenRows) {
      linenInventoryHtml = `
        <div class="linen-section" style="margin-top:15px; page-break-inside:avoid;">
          <h3>📦 ${t.linenInventory}</h3>
          <table border="1" cellpadding="6" cellspacing="0" style="width:100%; border-collapse:collapse; border:1px solid #000;">
            <tr>
              <th style="background-color:#f2f2f2; border:1px solid #000; text-align:left;">${t.linenType}</th>
              <th style="background-color:#f2f2f2; border:1px solid #000; text-align:center; width:100px;">${t.quantity}</th>
              <th style="background-color:#f2f2f2; border:1px solid #000; text-align:left;">${t.verified}</th>
            </tr>
            ${linenRows}
          </table>
        </div>
      `;
    }
  }
  
  // Format current date in a readable format (e.g., "jeudi 15 mai 2025")
  const formattedDate = data.currentDate.split(' ').slice(0, 3).join(' ');
  
  // Calculate room counts and estimated time - support both old and new cleaning type formats
  const fullCleanCount = data.rooms.filter(room => room.cleaningType === 'full' || room.cleaningType === 'a_blanc').length;
  const quickCleanCount = data.rooms.filter(room => room.cleaningType === 'quick' || room.cleaningType === 'recouche').length;
  
  // Calculate estimated time
  const estimatedTime = fullCleanCount * data.config.fullCleaningTime + 
                       quickCleanCount * data.config.quickCleaningTime;
  
  // Time tracking table
  const timeTrackingHtml = `
    <table border="1" cellpadding="6" cellspacing="0" style="width:100%; border-collapse:collapse; margin-bottom:15px; border:1px solid #000;">
      <tr>
        <th colspan="2" style="background-color:#e3e3e3; border:1px solid #000; text-align:center; font-weight:bold;">${t.timeTracking}</th>
      </tr>
      <tr>
        <td style="border:1px solid #000; width:50%;">${t.startTime}</td>
        <td style="border:1px solid #000; font-weight:bold;">${data.startTime || '___:___'}</td>
      </tr>
      <tr>
        <td style="border:1px solid #000;">${t.endTime}</td>
        <td style="border:1px solid #000; height:25px;"></td>
      </tr>
    </table>
  `;

  // Summary table with improved styling
  const summaryTableHtml = `
    <table border="1" cellpadding="6" cellspacing="0" style="width:100%; border-collapse:collapse; margin-bottom:20px; border:1px solid #000;">
      <tr>
        <th style="background-color:#f2f2f2; border:1px solid #000; text-align:left;">${t.cleaningType}</th>
        <th style="background-color:#f2f2f2; border:1px solid #000; text-align:left;">${t.numberOfRooms}</th>
      </tr>
      <tr style="background-color:#FEC6A1;">
        <td style="border:1px solid #000;">${t.fullClean} (${t.fullCleanShort})</td>
        <td style="border:1px solid #000;">${fullCleanCount}</td>
      </tr>
      <tr style="background-color:#F2FCE2;">
        <td style="border:1px solid #000;">${t.quickClean} (${t.quickCleanShort})</td>
        <td style="border:1px solid #000;">${quickCleanCount}</td>
      </tr>
      <tr>
        <td style="border:1px solid #000; font-weight:bold;">${t.total}</td>
        <td style="border:1px solid #000; font-weight:bold;">${data.rooms.length}</td>
      </tr>
      <tr>
        <td style="border:1px solid #000;">${t.estimatedTime}</td>
        <td style="border:1px solid #000;">${estimatedTime} ${t.minutes}</td>
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
      // Determine background color based on cleaning type - support both old and new formats
      const isFullClean = room.cleaningType === 'full' || room.cleaningType === 'a_blanc';
      const bgColor = isFullClean ? '#FEC6A1' : '#F2FCE2'; // Orange for full, Green for quick
      const cleaningTypeText = isFullClean ? `${t.fullClean} 🚪` : t.quickClean;
      const priorityText = room.priority === 'high' ? t.high : t.normal;
      
      rowsHtml += `
        <tr style="background-color:${bgColor};">
          <td style="border:1px solid #000;">${room.number}</td>
          <td style="border:1px solid #000;">${cleaningTypeText}</td>
          <td style="border:1px solid #000;">${room.isTwin ? t.yes : t.no}</td>
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
          ${t.floor} ${floor === 0 ? t.groundFloor : floor}
        </div>
        <table border="1" cellpadding="6" cellspacing="0" style="width:100%; border-collapse:collapse; margin-bottom:20px; border:1px solid #000;">
          <tr>
            <th style="background-color:#f2f2f2; border:1px solid #000; text-align:left;">${t.room}</th>
            <th style="background-color:#f2f2f2; border:1px solid #000; text-align:left;">${t.type}</th>
            <th style="background-color:#f2f2f2; border:1px solid #000; text-align:left;">${t.twin}</th>
            <th style="background-color:#f2f2f2; border:1px solid #000; text-align:left;">${t.priority}</th>
            <th style="background-color:#f2f2f2; border:1px solid #000; text-align:left;">${t.notes}</th>
            <th style="background-color:#f2f2f2; border:1px solid #000; text-align:left;">${t.remarks}</th>
          </tr>
          ${rowsHtml}
        </table>
      </div>
    `;
  });
  
  // Complete HTML with improved styling optimized for printing
  const lang = getCurrentReportLanguage();
  return `
    <!DOCTYPE html>
    <html lang="${lang}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${t.report} - ${data.housekeeperName}</title>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap">
      <style>
        body { 
          font-family: Arial, sans-serif; 
          margin: 15px;
          font-size: 11px;
          line-height: 1.4;
        }
        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 10px;
        }
        .logo-section {
          text-align: left;
        }
        h1 { 
          font-family: 'Poppins', sans-serif;
          font-size: 18px; 
          margin: 0;
          font-weight: bold;
          text-align: left;
          padding: 3px 0;
        }
        h2 { 
          font-size: 13px; 
          margin-top: 12px; 
          margin-bottom: 8px;
          font-weight: bold;
          border-bottom: 1px solid #ddd;
          padding-bottom: 4px;
          text-align: left;
        }
        h3 {
          font-size: 12px;
          margin-top: 10px;
          margin-bottom: 4px;
          font-weight: bold;
          text-align: left;
        }
        .date {
          margin: 0;
          font-style: italic;
          text-align: right;
          font-size: 10px;
        }
        .housekeeper-row {
          display: flex;
          align-items: center;
          margin: 15px 0;
          padding: 8px 0;
        }
        .housekeeperName {
          border: 2px solid #000;
          padding: 8px 15px;
          font-weight: bold;
          display: inline-block;
          font-size: 13px;
          background-color: #f9f9f9;
        }
        
        /* Critical: Prevent table breaks */
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-bottom: 12px;
        }
        
        /* Prevent row breaks */
        tr {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        
        th, td { 
          border: 1px solid #000;
          padding: 4px 6px; 
          text-align: left;
          font-size: 10px;
        }
        th { 
          background-color: #f2f2f2; 
          font-weight: bold;
        }
        
        /* Floor sections - keep together */
        .floor-section {
          page-break-inside: avoid;
          break-inside: avoid;
          margin-top: 12px;
        }
        
        .floor-heading {
          font-weight: bold;
          background-color: #eee;
          padding: 4px 8px;
          margin-bottom: 4px;
          font-size: 11px;
        }
        
        .signature { 
          margin-top: 20px; 
          border-top: 1px solid #000; 
          width: 150px; 
          text-align: center; 
          padding-top: 8px;
          font-size: 10px;
        }
        .footer { 
          text-align: center;
          margin-top: 20px;
          font-size: 10px;
          padding-top: 8px;
          border-top: 1px solid #ddd;
        }
        .footer .company {
          font-family: 'Poppins', sans-serif;
          font-weight: bold;
          font-size: 11px;
        }
        ul {
          margin: 4px 0 8px 15px;
          padding-left: 0;
          text-align: left;
        }
        li {
          margin-bottom: 2px;
          text-align: left;
          font-size: 10px;
        }
        .instructions-section,
        .todo-section,
        .toknow-section { 
          margin-top: 8px;
          margin-bottom: 8px;
          padding: 8px;
          background-color: #f9f9f9;
          border-radius: 3px;
          text-align: left;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .content-section {
          margin-bottom: 15px;
          text-align: left;
        }
        .summary-table {
          margin-top: 10px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        
        @media print {
          body {
            margin: 10px;
          }
          .floor-section {
            page-break-inside: avoid;
          }
          tr {
            page-break-inside: avoid;
          }
        }
        
        @page {
          margin: 10mm;
        }
      </style>
    </head>
    <body>
      <div class="header-content">
        <div class="logo-section">
          <h1>NettoBloc</h1>
        </div>
        <div class="date">Date: ${formattedDate}</div>
      </div>
      
      <h2>${t.report}</h2>
      
      <div class="housekeeper-row">
        <span style="margin-right: 8px;">${t.room === 'Room' ? 'Name' : 'Nom'}:</span>
        <div class="housekeeperName">${data.housekeeperName}</div>
      </div>
      
      <div class="summary-table" style="margin-top: 15px;">
        ${timeTrackingHtml}
        ${summaryTableHtml}
      </div>
      
      <div class="content-section">
        ${instructionsHtml}
        ${todoHtml}
        ${toknowHtml}
        ${linenInventoryHtml}
      </div>
      
      <h2>${lang === 'en' ? 'Rooms to clean' : 'Liste des chambres à nettoyer'}</h2>
      ${roomsTablesByFloor}
      
      <div class="signature">
        ${t.signature}
      </div>
      
      <div class="footer">
        <span class="company">NettoBloc</span>
      </div>
    </body>
    </html>
  `;
}

// Generate room summary table with improved styling
function generateRoomSummaryTable(data: ReportData): string {
  // Count different room types - support both old and new formats
  const fullCleanCount = data.rooms.filter(room => room.cleaningType === 'full' || room.cleaningType === 'a_blanc').length;
  const quickCleanCount = data.rooms.filter(room => room.cleaningType === 'quick' || room.cleaningType === 'recouche').length;
  
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
      // Apply highlighting based on cleaning type - support both old and new formats
      const isFullClean = room.cleaningType === 'full' || room.cleaningType === 'a_blanc';
      const rowClass = isFullClean ? 'a-blanc' : 'recouche';
      const cleaningTypeText = isFullClean ? 'À Blanc' : 'Recouche';
      
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
  customFields?: CustomReportFields
): Promise<boolean> {
  try {
    // Get language and translations
    const lang = getCurrentReportLanguage();
    const t = getReportTranslations(lang);
    const locale = lang === 'en' ? 'en-US' : 'fr-FR';
    
    // Filter out housekeepers with no rooms
    const validHousekeepers = housekeeperRooms.filter(item => item.rooms.length > 0);
    
    if (validHousekeepers.length === 0) {
      toast({
        title: lang === 'en' ? "No rooms assigned" : "Aucune chambre assignée",
        description: lang === 'en' ? "There are no rooms assigned to housekeepers." : "Il n'y a pas de chambres assignées aux femmes de chambre.",
        variant: "destructive"
      });
      return false;
    }

    // Create HTML sections for each housekeeper - one per page
    const housekeeperHTMLs: string[] = [];

    for (const { name, rooms } of validHousekeepers) {
      // Get today's date in localized format
      const today = new Date();
      const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      const currentDate = today.toLocaleDateString(locale, dateOptions as any);
      
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
        housekeeperInstructions: customFields?.housekeeperInstructions || {},
        linenInventory: customFields?.linenInventory || []
      };
      
      // Generate complete HTML for this housekeeper
      const housekeeperHTML = generateReportHTML(reportData, t);
      housekeeperHTMLs.push(housekeeperHTML);
    }
    
    // Combine all HTML sections with forced page breaks between them
    const combinedHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${lang === 'en' ? 'Cleaning Reports' : 'Rapports de Nettoyage'}</title>
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
    
    // Archive the combined report (best-effort)
    await saveDailyReport({
      roomData: validHousekeepers.flatMap(h => h.rooms),
      assignments: Object.fromEntries(validHousekeepers.map(h => [h.name, h.rooms])),
      housekeeperNames: validHousekeepers.map(h => h.name),
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
