import { supabase } from '@/integrations/supabase/client';

interface HousekeeperReportData {
  housekeeperName: string;
  roomsAssigned: Array<{
    room_number: string;
    status: string;
    cleaning_type?: string;
    started_at?: string;
    completed_at?: string;
  }>;
  completedCount: number;
  totalCount: number;
}

interface DailyReportPdfData {
  hotelId: string;
  hotelName?: string;
  reportDate: string;
  housekeepers: HousekeeperReportData[];
  summary: {
    totalRooms: number;
    cleanRooms: number;
    dirtyRooms: number;
    inProgressRooms: number;
  };
  actionLogs: Array<{
    action_type: string;
    actor_name?: string;
    room_number?: string;
    description: string;
    created_at: string;
  }>;
  dailyInstructions?: {
    instructions?: string | null;
    to_know?: string | null;
    todo_list?: string | null;
  } | null;
  tasks?: Array<{
    title: string;
    description?: string | null;
    assigned_to_name?: string | null;
    is_completed: boolean;
  }>;
}

/**
 * Generate HTML content for the daily closure report
 */
function generateReportHtml(data: DailyReportPdfData): string {
  const housekeeperSections = data.housekeepers.map(hk => {
    const roomRows = hk.roomsAssigned.map(room => `
      <tr>
        <td style="border:1px solid #ddd; padding:8px;">${room.room_number}</td>
        <td style="border:1px solid #ddd; padding:8px;">${room.cleaning_type === 'a_blanc' ? 'À Blanc' : room.cleaning_type === 'recouche' ? 'Recouche' : '-'}</td>
        <td style="border:1px solid #ddd; padding:8px;">${room.status === 'clean' ? '✓ Terminé' : room.status === 'in-progress' ? '⏳ En cours' : '⏸ En attente'}</td>
        <td style="border:1px solid #ddd; padding:8px;">${room.started_at ? new Date(room.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
        <td style="border:1px solid #ddd; padding:8px;">${room.completed_at ? new Date(room.completed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
      </tr>
    `).join('');

    return `
      <div style="margin-top:30px; page-break-inside:avoid;">
        <h2 style="background:#f5f5f5; padding:10px; border-left:4px solid #3b82f6;">
          ${hk.housekeeperName}
          <span style="float:right; font-size:14px; color:#666;">
            ${hk.completedCount}/${hk.totalCount} chambres
          </span>
        </h2>
        <table style="width:100%; border-collapse:collapse; margin-top:10px;">
          <thead>
            <tr style="background:#e5e7eb;">
              <th style="border:1px solid #ddd; padding:8px; text-align:left;">Chambre</th>
              <th style="border:1px solid #ddd; padding:8px; text-align:left;">Type</th>
              <th style="border:1px solid #ddd; padding:8px; text-align:left;">Statut</th>
              <th style="border:1px solid #ddd; padding:8px; text-align:left;">Début</th>
              <th style="border:1px solid #ddd; padding:8px; text-align:left;">Fin</th>
            </tr>
          </thead>
          <tbody>
            ${roomRows}
          </tbody>
        </table>
      </div>
    `;
  }).join('');

  const actionLogRows = data.actionLogs.slice(0, 50).map(log => `
    <tr>
      <td style="border:1px solid #ddd; padding:6px; font-size:12px;">${new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
      <td style="border:1px solid #ddd; padding:6px; font-size:12px;">${log.actor_name || '-'}</td>
      <td style="border:1px solid #ddd; padding:6px; font-size:12px;">${log.room_number || '-'}</td>
      <td style="border:1px solid #ddd; padding:6px; font-size:12px;">${log.description}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Rapport de Clôture - ${data.reportDate}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px; }
        .summary-grid { display: flex; gap: 20px; margin: 20px 0; flex-wrap: wrap; }
        .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; min-width: 120px; text-align: center; }
        .summary-card .value { font-size: 24px; font-weight: bold; color: #1e40af; }
        .summary-card .label { font-size: 12px; color: #64748b; margin-top: 5px; }
        @media print {
          .page-break { page-break-before: always; }
        }
      </style>
    </head>
    <body>
      <h1>📋 Rapport de Clôture</h1>
      <p style="color:#666;">
        ${data.hotelName ? `<strong>${data.hotelName}</strong> - ` : ''}
        ${new Date(data.reportDate).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </p>

      <div class="summary-grid">
        <div class="summary-card">
          <div class="value">${data.summary.totalRooms}</div>
          <div class="label">Total chambres</div>
        </div>
        <div class="summary-card">
          <div class="value" style="color:#22c55e;">${data.summary.cleanRooms}</div>
          <div class="label">Propres</div>
        </div>
        <div class="summary-card">
          <div class="value" style="color:#eab308;">${data.summary.inProgressRooms}</div>
          <div class="label">En cours</div>
        </div>
        <div class="summary-card">
          <div class="value" style="color:#ef4444;">${data.summary.dirtyRooms}</div>
          <div class="label">À nettoyer</div>
        </div>
        <div class="summary-card">
          <div class="value">${data.housekeepers.length}</div>
          <div class="label">Personnel</div>
        </div>
      </div>

      ${data.dailyInstructions && (data.dailyInstructions.instructions || data.dailyInstructions.to_know || data.dailyInstructions.todo_list) ? `
        <div style="margin-top:30px; page-break-inside:avoid;">
          <h2 style="border-bottom:1px solid #ddd; padding-bottom:10px;">📋 Consignes du jour</h2>
          ${data.dailyInstructions.instructions ? `
            <div style="background:#fffbeb; border:1px solid #fbbf24; border-radius:8px; padding:12px; margin:10px 0;">
              <strong>Instructions :</strong><br/>${data.dailyInstructions.instructions.replace(/\n/g, '<br/>')}
            </div>
          ` : ''}
          ${data.dailyInstructions.to_know ? `
            <div style="background:#eff6ff; border:1px solid #3b82f6; border-radius:8px; padding:12px; margin:10px 0;">
              <strong>À savoir :</strong>
              <ul style="margin:5px 0;">${data.dailyInstructions.to_know.split('\n').filter((l: string) => l.trim()).map((l: string) => `<li>${l}</li>`).join('')}</ul>
            </div>
          ` : ''}
          ${data.dailyInstructions.todo_list ? `
            <div style="background:#f0fdf4; border:1px solid #22c55e; border-radius:8px; padding:12px; margin:10px 0;">
              <strong>À faire :</strong>
              <ul style="margin:5px 0;">${data.dailyInstructions.todo_list.split('\n').filter((l: string) => l.trim()).map((l: string) => `<li>${l}</li>`).join('')}</ul>
            </div>
          ` : ''}
        </div>
      ` : ''}

      ${data.tasks && data.tasks.length > 0 ? `
        <div style="margin-top:30px; page-break-inside:avoid;">
          <h2 style="border-bottom:1px solid #ddd; padding-bottom:10px;">✅ Tâches du jour</h2>
          <table style="width:100%; border-collapse:collapse; margin-top:10px;">
            <thead>
              <tr style="background:#e5e7eb;">
                <th style="border:1px solid #ddd; padding:8px; text-align:left;">Tâche</th>
                <th style="border:1px solid #ddd; padding:8px; text-align:left;">Assignée à</th>
                <th style="border:1px solid #ddd; padding:8px; text-align:center;">Statut</th>
              </tr>
            </thead>
            <tbody>
              ${data.tasks.map(task => `
                <tr>
                  <td style="border:1px solid #ddd; padding:8px;">
                    <strong>${task.title}</strong>
                    ${task.description ? `<br/><span style="font-size:12px; color:#666;">${task.description}</span>` : ''}
                  </td>
                  <td style="border:1px solid #ddd; padding:8px;">${task.assigned_to_name || 'Tout le personnel'}</td>
                  <td style="border:1px solid #ddd; padding:8px; text-align:center;">${task.is_completed ? '✅ Fait' : '⬜ En attente'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      ${housekeeperSections}

      ${data.actionLogs.length > 0 ? `
        <div class="page-break" style="margin-top:40px;">
          <h2 style="border-bottom:1px solid #ddd; padding-bottom:10px;">📝 Journal des Actions</h2>
          <table style="width:100%; border-collapse:collapse; margin-top:10px;">
            <thead>
              <tr style="background:#e5e7eb;">
                <th style="border:1px solid #ddd; padding:6px; text-align:left;">Heure</th>
                <th style="border:1px solid #ddd; padding:6px; text-align:left;">Acteur</th>
                <th style="border:1px solid #ddd; padding:6px; text-align:left;">Chambre</th>
                <th style="border:1px solid #ddd; padding:6px; text-align:left;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${actionLogRows}
            </tbody>
          </table>
        </div>
      ` : ''}

      <footer style="margin-top:40px; padding-top:20px; border-top:1px solid #ddd; font-size:11px; color:#999; text-align:center;">
        Généré automatiquement lors de la clôture de journée - ${new Date().toLocaleString('fr-FR')}
      </footer>
    </body>
    </html>
  `;
}

/**
 * Convert HTML to PDF blob using html2pdf.js
 */
async function htmlToPdfBlob(html: string): Promise<Blob> {
  // Dynamic import to avoid SSR issues
  const html2pdf = (await import('html2pdf.js')).default;
  
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  document.body.appendChild(container);

  try {
    const pdfBlob = await html2pdf()
      .from(container)
      .set({
        margin: [10, 10, 10, 10],
        filename: 'rapport.pdf',
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      })
      .outputPdf('blob');

    return pdfBlob;
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Generate and upload daily closure report PDF to Supabase Storage
 */
export async function generateAndUploadDailyReportPdf(
  hotelId: string,
  reportDate: string,
  rooms: any[],
  assignments: any[],
  actionLogs: any[],
  hotelName?: string
): Promise<string | null> {
  try {
    console.log('📄 Génération du PDF de clôture...');

    // Load daily instructions and tasks from DB
    const [instructionsResult, tasksResult, completionsResult] = await Promise.all([
      supabase
        .from('daily_instructions')
        .select('instructions, to_know, todo_list')
        .eq('hotel_id', hotelId)
        .eq('instruction_date', reportDate)
        .maybeSingle(),
      supabase
        .from('task_templates')
        .select('id, title, description, assigned_user_name, assigned_to_type, is_one_time, one_time_date, days_of_week')
        .eq('hotel_id', hotelId)
        .eq('is_active', true),
      supabase
        .from('task_completions')
        .select('task_template_id')
        .eq('completion_date', reportDate)
    ]);

    const dailyInstructions = instructionsResult.data || null;

    // Filter tasks for today
    const currentDayOfWeek = new Date(reportDate).getDay();
    const allTasks = (tasksResult.data || []).filter(t => {
      if (t.is_one_time) return t.one_time_date === reportDate;
      return t.days_of_week?.includes(currentDayOfWeek);
    });
    const completedIds = new Set((completionsResult.data || []).map(c => c.task_template_id));
    const tasks = allTasks.map(t => ({
      title: t.title,
      description: t.description,
      assigned_to_name: t.assigned_user_name,
      is_completed: completedIds.has(t.id)
    }));

    // Build housekeeper data
    const housekeeperMap = new Map<string, HousekeeperReportData>();
    
    for (const assignment of assignments) {
      const name = assignment.housekeeper_name;
      if (!housekeeperMap.has(name)) {
        housekeeperMap.set(name, {
          housekeeperName: name,
          roomsAssigned: [],
          completedCount: 0,
          totalCount: 0
        });
      }
      
      const hkData = housekeeperMap.get(name)!;
      const room = rooms.find(r => r.id === assignment.room_id);
      
      hkData.roomsAssigned.push({
        room_number: room?.room_number || 'N/A',
        status: assignment.status,
        cleaning_type: room?.cleaning_type,
        started_at: assignment.started_at,
        completed_at: assignment.completed_at
      });
      
      hkData.totalCount++;
      if (assignment.status === 'completed' || assignment.status === 'clean') {
        hkData.completedCount++;
      }
    }

    const reportData: DailyReportPdfData = {
      hotelId,
      hotelName,
      reportDate,
      housekeepers: Array.from(housekeeperMap.values()),
      summary: {
        totalRooms: rooms.length,
        cleanRooms: rooms.filter(r => r.status === 'clean').length,
        dirtyRooms: rooms.filter(r => r.status === 'dirty' || r.status === 'needs-cleaning').length,
        inProgressRooms: rooms.filter(r => r.status === 'in-progress').length
      },
      actionLogs: actionLogs.map(log => ({
        action_type: log.action_type,
        actor_name: log.actor_name,
        room_number: log.room_number,
        description: log.description,
        created_at: log.created_at
      })),
      dailyInstructions,
      tasks
    };

    // Generate HTML and convert to PDF
    const html = generateReportHtml(reportData);
    const pdfBlob = await htmlToPdfBlob(html);

    // Upload to Supabase Storage
    const fileName = `${hotelId}/${reportDate}_rapport-cloture.pdf`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('daily-reports')
      .upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.error('❌ Erreur upload PDF:', uploadError);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('daily-reports')
      .getPublicUrl(fileName);

    console.log('✅ PDF uploadé:', uploadData?.path);
    return urlData?.publicUrl || fileName;

  } catch (error) {
    console.error('❌ Erreur génération PDF:', error);
    return null;
  }
}
