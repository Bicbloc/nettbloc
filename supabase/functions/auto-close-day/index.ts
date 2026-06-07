import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { isAuthorizedCronRequest, unauthorizedResponse } from "../_shared/cronAuth.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface HotelRow {
  id: string;
  name: string;
  auto_close_enabled: boolean;
  auto_close_time: string; // "HH:MM:SS"
  auto_close_days: number[]; // 0=Sunday ... 6=Saturday
  auto_close_timezone: string;
  last_auto_close_date: string | null;
  auto_close_recap_email: string | null;
}


// Returns { date: "YYYY-MM-DD", dow: 0-6, minutes: minutesSinceMidnight } in the given timezone
function nowInTimezone(timeZone: string) {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
    weekday: 'short',
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  let hour = parseInt(get('hour'), 10);
  if (hour === 24) hour = 0;
  const minutes = hour * 60 + parseInt(get('minute'), 10);
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = dowMap[get('weekday')] ?? new Date().getDay();
  return { date, dow, minutes };
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}

async function closeHotelDay(supabase: any, hotelId: string, reportDate: string) {
  // 1. Fetch current operational data
  const [{ data: rooms }, { data: assignments }, { data: logs }, { data: notifications }] = await Promise.all([
    supabase.from('rooms').select('*').eq('hotel_id', hotelId),
    supabase.from('assignments').select('*').eq('hotel_id', hotelId),
    supabase.from('daily_action_logs').select('*').eq('hotel_id', hotelId).eq('log_date', reportDate),
    supabase.from('notifications').select('*').eq('hotel_id', hotelId)
      .gte('created_at', reportDate + 'T00:00:00').lte('created_at', reportDate + 'T23:59:59'),
  ]);

  const currentRooms = rooms || [];
  const currentAssignments = assignments || [];
  const actionLogs = logs || [];
  const allNotifications = notifications || [];
  const remarks = allNotifications.filter((n: any) => n.type === 'remark');
  const housekeeperNames = [...new Set(currentAssignments.map((a: any) => a.housekeeper_name))];

  // 2. Linen inventory tasks of the day
  const { data: linenTasks } = await supabase
    .from('linen_inventory_tasks')
    .select('*, linen_inventory_entries(*, linen_types(name, category))')
    .eq('hotel_id', hotelId)
    .eq('task_date', reportDate);
  const linenTasksData = linenTasks || [];

  // 2b. Breakfast billing logs of the day (traçabilité facturation PDJ)
  const { data: breakfastLogs } = await supabase
    .from('breakfast_logs')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('log_date', reportDate);
  const breakfastData = breakfastLogs || [];
  const breakfastSummary = {
    rooms_count: breakfastData.length,
    total_people: breakfastData.reduce((s: number, b: any) => s + Number(b.people_count || 0), 0),
    billed_amount: Number(
      breakfastData
        .filter((b: any) => !b.included)
        .reduce((s: number, b: any) => s + Number(b.total_amount || 0), 0)
        .toFixed(2),
    ),
    included_count: breakfastData.filter((b: any) => b.included).length,
    sent_count: breakfastData.filter((b: any) => b.pms_status === 'sent').length,
    entries: breakfastData.map((b: any) => ({
      room_number: b.room_number,
      people_count: b.people_count,
      breakfast_type: b.breakfast_type,
      total_amount: b.total_amount,
      included: b.included,
      pms_status: b.pms_status,
      logged_by: b.logged_by,
      items: b.items,
      sent_items: b.sent_items,
    })),
  };

  const linenSummary = linenTasksData.reduce((acc: any, task: any) => {
    (task.linen_inventory_entries || []).forEach((entry: any) => {
      const typeName = entry.linen_types?.name || 'Inconnu';
      if (!acc[typeName]) acc[typeName] = { clean: 0, dirty: 0, damaged: 0 };
      acc[typeName].clean += entry.quantity_clean || 0;
      acc[typeName].dirty += entry.quantity_dirty || 0;
      acc[typeName].damaged += entry.quantity_damaged || 0;
    });
    return acc;
  }, {});

  // 3. Archive action logs
  if (actionLogs.length > 0) {
    await supabase.from('archived_daily_logs').insert({
      hotel_id: hotelId,
      archive_date: reportDate,
      logs_data: actionLogs,
      summary: {
        totalActions: actionLogs.length,
        roomsAffected: [...new Set(actionLogs.map((l: any) => l.room_number).filter(Boolean))],
      },
    });
  }

  // 4. Archive daily report (only if there were rooms)
  if (currentRooms.length > 0) {
    await supabase.from('daily_reports').insert({
      hotel_id: hotelId,
      report_date: reportDate,
      room_data: currentRooms,
      summary: {
        total_rooms: currentRooms.length,
        clean_rooms: currentRooms.filter((r: any) => r.status === 'clean').length,
        dirty_rooms: currentRooms.filter((r: any) => r.status === 'dirty' || r.status === 'needs-cleaning').length,
        in_progress_rooms: currentRooms.filter((r: any) => r.status === 'in-progress').length,
        archived_at: new Date().toISOString(),
        auto_closed: true,
        housekeepers: housekeeperNames,
        assignments: currentAssignments.reduce((acc: any, a: any) => {
          if (!acc[a.housekeeper_name]) acc[a.housekeeper_name] = [];
          const room = currentRooms.find((r: any) => r.id === a.room_id);
          acc[a.housekeeper_name].push({
            room_number: room?.room_number || 'N/A',
            room_id: a.room_id,
            status: a.status,
            started_at: a.started_at,
            completed_at: a.completed_at,
            actual_duration: a.actual_duration,
          });
          return acc;
        }, {}),
        remarks: remarks.map((r: any) => ({
          room_number: r.room_number, description: r.description,
          housekeeper_name: r.housekeeper_name, created_at: r.created_at,
        })),
        notifications: allNotifications.map((n: any) => ({
          type: n.type, title: n.title, description: n.description,
          room_number: n.room_number, created_at: n.created_at,
        })),
        action_log: actionLogs.map((log: any) => ({
          action_type: log.action_type, actor_name: log.actor_name, actor_type: log.actor_type,
          room_number: log.room_number, description: log.description, details: log.details, created_at: log.created_at,
        })),
        linen_inventory: {
          tasks_count: linenTasksData.length,
          summary: linenSummary,
        },
        breakfast_billing: breakfastSummary,
      },
      total_rooms_cleaned: currentRooms.filter((r: any) => r.status === 'clean').length,
      notes: `Clôture automatique • ${housekeeperNames.length} femme(s) de chambre, ${remarks.length} commentaire(s), ${actionLogs.length} action(s), ${linenTasksData.length} inventaire(s) linge, ${breakfastData.length} petit(s)-déjeuner(s)`,
    });
  }

  // 5. Reset / cleanup operational data
  await supabase.from('assignments').delete().eq('hotel_id', hotelId);

  const taskIds = linenTasksData.map((t: any) => t.id);
  if (taskIds.length > 0) {
    await supabase.from('linen_inventory_entries').delete().in('task_id', taskIds);
    await supabase.from('linen_inventory_tasks').delete().eq('hotel_id', hotelId).eq('task_date', reportDate);
  }

  await supabase.from('rooms').delete().eq('hotel_id', hotelId);
  await supabase.from('notifications').delete().eq('hotel_id', hotelId)
    .gte('created_at', reportDate + 'T00:00:00').lte('created_at', reportDate + 'T23:59:59');
  await supabase.from('daily_action_logs').delete().eq('hotel_id', hotelId).eq('log_date', reportDate);
  // Petits-déjeuners du jour archivés dans le rapport : on purge la table opérationnelle.
  await supabase.from('breakfast_logs').delete().eq('hotel_id', hotelId).eq('log_date', reportDate);

  // 6. Deactivate active hotel sessions
  await supabase.from('hotel_sessions').update({ is_active: false }).eq('hotel_id', hotelId).eq('is_active', true);

  return {
    rooms: currentRooms.length,
    assignments: currentAssignments.length,
    linenTasks: taskIds.length,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Privileged scheduled function: only callable by the scheduler/service role.
  if (!isAuthorizedCronRequest(req)) {
    return unauthorizedResponse(corsHeaders as Record<string, string>);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);


  try {
    const { data: hotels, error } = await supabase
      .from('hotels')
      .select('id, name, auto_close_enabled, auto_close_time, auto_close_days, auto_close_timezone, last_auto_close_date')
      .eq('auto_close_enabled', true);

    if (error) throw error;

    const results: any[] = [];

    for (const hotel of (hotels || []) as HotelRow[]) {
      const tz = hotel.auto_close_timezone || 'Europe/Paris';
      const { date, dow, minutes } = nowInTimezone(tz);

      const dayMatches = (hotel.auto_close_days || []).includes(dow);
      const timeReached = minutes >= timeToMinutes(hotel.auto_close_time || '23:00');
      const notYetClosedToday = hotel.last_auto_close_date !== date;

      if (!(dayMatches && timeReached && notYetClosedToday)) continue;

      try {
        const summary = await closeHotelDay(supabase, hotel.id, date);
        await supabase.from('hotels').update({ last_auto_close_date: date }).eq('id', hotel.id);
        results.push({ hotel_id: hotel.id, name: hotel.name, closed: true, ...summary });
      } catch (e) {
        console.error(`Erreur clôture hôtel ${hotel.id}:`, e);
        results.push({ hotel_id: hotel.id, name: hotel.name, closed: false, error: String(e) });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    console.error('auto-close-day error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
