import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isAuthorizedCronRequest, unauthorizedResponse } from "../_shared/cronAuth.ts";
import { mbConfigured, mbFetchBookings } from "../_shared/misterbooking.ts";

// MisterBooking : l'API connectedDevices ne renvoie que les séjours en cours
// (englobant aujourd'hui). On en déduit l'occupation actuelle et la projection
// des séjours déjà entamés ; les arrivées futures ne sont pas disponibles.
async function fetchMisterBooking(credentials: { propertyId?: string }): Promise<{ stays: { start: string; end: string }[]; totalRooms: number }> {
  if (!mbConfigured()) throw new Error('Identifiants partenaire MisterBooking manquants (secrets WSSE).');
  const hotelId = parseInt(String(credentials.propertyId || ''), 10);
  if (!hotelId) throw new Error('ID établissement MisterBooking manquant.');
  const bookings = await mbFetchBookings(hotelId);
  const stays = bookings
    .filter((b) => (b.startDate && b.endDate))
    .map((b) => ({ start: b.startDate.split('T')[0], end: b.endDate.split('T')[0] }));
  return { stays, totalRooms: 0 };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface PmsCredentials {
  clientToken?: string;
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
  propertyId?: string;
  baseUrl?: string;
}

interface Stay {
  start: string; // YYYY-MM-DD (arrival / check-in date)
  end: string;   // YYYY-MM-DD (departure / check-out date)
}

const HORIZON_DAYS = 30;

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDays(base: Date, n: number): Date {
  return new Date(base.getTime() + n * 86400000);
}

// ─── Mews ──────────────────────────────────────────────────────────
async function mewsFetch(url: string, body: unknown, attempt = 0): Promise<Response> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 429 && attempt < 4) {
    const retryAfter = Number(res.headers.get('Retry-After'));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(1000 * 2 ** attempt, 8000);
    await res.text().catch(() => {});
    await new Promise((r) => setTimeout(r, waitMs));
    return mewsFetch(url, body, attempt + 1);
  }
  return res;
}

async function fetchMews(credentials: PmsCredentials, startUtc: string, endUtc: string): Promise<{ stays: Stay[]; totalRooms: number }> {
  const baseUrl = credentials.baseUrl || 'https://api.mews.com/api/connector/v1';
  const auth = {
    ClientToken: credentials.clientToken,
    AccessToken: credentials.accessToken,
    Client: 'NettoBloc 1.0',
  };

  // Total bookable rooms
  const resourcesRes = await mewsFetch(`${baseUrl}/resources/getAll`, {
    ...auth,
    Extent: { Resources: true, ResourceCategoryAssignments: true },
  });
  let totalRooms = 0;
  if (resourcesRes.ok) {
    const data = await resourcesRes.json();
    totalRooms = (data.Resources || []).filter((r: any) => r.IsActive !== false).length;
  } else {
    await resourcesRes.text().catch(() => {});
  }

  // Mews limits reservations/getAll to a ~100h window, so we chunk by 4 days.
  // Dedupe reservations by Id across overlapping windows.
  const seen = new Set<string>();
  const stays: Stay[] = [];
  const windowStart = new Date(`${startUtc}T00:00:00Z`);
  const windowEnd = new Date(`${endUtc}T23:59:59Z`);
  const CHUNK_DAYS = 4;

  for (let chunkStart = new Date(windowStart); chunkStart < windowEnd; chunkStart = addDays(chunkStart, CHUNK_DAYS)) {
    let chunkEnd = addDays(chunkStart, CHUNK_DAYS);
    if (chunkEnd > windowEnd) chunkEnd = windowEnd;

    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const body: any = {
        ...auth,
        StartUtc: chunkStart.toISOString(),
        EndUtc: chunkEnd.toISOString(),
        TimeFilter: 'Colliding',
        Extent: { Reservations: true },
        States: ['Started', 'Confirmed', 'Processed'],
        Limitation: cursor ? { Cursor: cursor, Count: 1000 } : { Count: 1000 },
      };
      const res = await mewsFetch(`${baseUrl}/reservations/getAll`, body);
      if (!res.ok) {
        const errTxt = await res.text().catch(() => '');
        console.error(`[forecast] chunk ${dateStr(chunkStart)} reservations/getAll [${res.status}]: ${errTxt}`);
        break;
      }
      const data = await res.json();
      const reservations = data.Reservations || [];
      console.log(`[forecast] chunk ${dateStr(chunkStart)}→${dateStr(chunkEnd)} page ${page}: ${reservations.length} reservations`);
      for (const r of reservations) {
        const id = r.Id || `${r.ScheduledStartUtc}-${r.ScheduledEndUtc}-${r.AssignedResourceId}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const start = (r.ScheduledStartUtc || r.StartUtc || '').split('T')[0];
        const end = (r.ScheduledEndUtc || r.EndUtc || '').split('T')[0];
        if (start && end) stays.push({ start, end });
      }
      cursor = data.Cursor;
      if (!cursor || reservations.length === 0) break;
    }
  }

  console.log(`[forecast] total unique stays: ${stays.length}, totalRooms: ${totalRooms}`);


  return { stays, totalRooms };
}

// ─── Apaleo ────────────────────────────────────────────────────────
async function getApaleoToken(creds: PmsCredentials): Promise<string> {
  const res = await fetch('https://identity.apaleo.com/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: (creds.clientId || '').trim(),
      client_secret: (creds.clientSecret || '').trim(),
    }),
  });
  if (!res.ok) throw new Error(`Authentification Apaleo échouée [${res.status}]`);
  const data = await res.json();
  if (!data.access_token) throw new Error('Token Apaleo non reçu');
  return data.access_token;
}

async function getJson(url: string, token: string): Promise<any> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Apaleo request failed [${res.status}]`);
  return res.json();
}

async function fetchApaleo(credentials: PmsCredentials, start: string, end: string): Promise<{ stays: Stay[]; totalRooms: number }> {
  const propertyId = credentials.propertyId;
  if (!propertyId) throw new Error('Property ID Apaleo manquant.');
  const token = await getApaleoToken(credentials);

  const unitsData = await getJson(`https://api.apaleo.com/inventory/v1/units?propertyId=${propertyId}&pageSize=200`, token);
  const totalRooms = (unitsData.units || []).length;

  const stays: Stay[] = [];
  const seen = new Set<string>();

  // Collect reservations matching the given statuses, optionally filtered by a date window.
  // Apaleo expects the `status` query param to be repeated (NOT comma-separated).
  const collect = async (statuses: string[], dateFilter?: string) => {
    const statusParam = statuses.map((s) => `&status=${s}`).join('');
    const dateParam = dateFilter ? `&dateFilter=${dateFilter}&from=${start}T00:00:00Z&to=${end}T00:00:00Z` : '';
    let offset = 0;
    for (let page = 0; page < 20; page++) {
      const data = await getJson(
        `https://api.apaleo.com/booking/v1/reservations?propertyId=${propertyId}${dateParam}${statusParam}&pageSize=200&offset=${offset}`,
        token,
      );
      const reservations = data.reservations || [];
      for (const r of reservations) {
        const id = r.id || `${r.arrival}-${r.departure}-${r.unit?.id}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const s = (r.arrival || '').split('T')[0];
        const e = (r.departure || '').split('T')[0];
        if (s && e) stays.push({ start: s, end: e });
      }
      console.log(`[forecast/apaleo] statuses=${statuses.join(',')} offset=${offset}: ${reservations.length} reservations`);
      if (reservations.length < 200) break;
      offset += 200;
    }
  };

  // In-house guests (currently checked in — may have arrived before the window start).
  await collect(['InHouse']);
  // Upcoming confirmed reservations across the forecast horizon.
  await collect(['Confirmed'], 'Stay');

  console.log(`[forecast/apaleo] total unique stays: ${stays.length}, totalRooms: ${totalRooms}`);
  return { stays, totalRooms };
}


// ─── Forecast computation ──────────────────────────────────────────
function computeForecast(stays: Stay[], totalRooms: number, startDate: Date, days: number) {
  const rows = [];
  for (let i = 0; i < days; i++) {
    const date = dateStr(addDays(startDate, i));
    let occupied = 0, arrivals = 0, departures = 0, stayovers = 0;
    for (const s of stays) {
      if (s.start <= date && s.end > date) occupied++;
      if (s.start === date) arrivals++;
      if (s.end === date) departures++;
      if (s.start < date && s.end > date) stayovers++;
    }
    const occupancy_rate = totalRooms > 0 ? Math.round((occupied / totalRooms) * 1000) / 10 : 0;
    rows.push({ forecast_date: date, total_rooms: totalRooms, occupied_rooms: occupied, arrivals, departures, stayovers, occupancy_rate });
  }
  return rows;
}

async function buildForecastForConfig(adminClient: any, pmsConfig: any) {
  const hotel_id = pmsConfig.hotel_id;
  const credentials = { ...(pmsConfig.credentials as PmsCredentials), baseUrl: pmsConfig.base_url || (pmsConfig.credentials as PmsCredentials)?.baseUrl } as PmsCredentials;

  const startDate = new Date();
  const start = dateStr(startDate);
  const end = dateStr(addDays(startDate, HORIZON_DAYS));

  let result: { stays: Stay[]; totalRooms: number };
  switch (pmsConfig.pms_type) {
    case 'mews':
      result = await fetchMews(credentials, start, end);
      break;
    case 'apaleo':
      result = await fetchApaleo(credentials, start, end);
      break;
    default:
      throw new Error(`PMS type '${pmsConfig.pms_type}' not supported for forecast`);
  }

  // Fallback total from registry if PMS returned 0
  let totalRooms = result.totalRooms;
  if (!totalRooms) {
    const { count } = await adminClient
      .from('hotel_rooms_registry')
      .select('id', { count: 'exact', head: true })
      .eq('hotel_id', hotel_id)
      .eq('is_active', true);
    totalRooms = count || 0;
  }

  const rows = computeForecast(result.stays, totalRooms, startDate, HORIZON_DAYS)
    .map((r) => ({ ...r, hotel_id, computed_at: new Date().toISOString() }));

  // Remove stale days then upsert fresh window
  await adminClient.from('pms_occupancy_forecast').delete().eq('hotel_id', hotel_id);
  await adminClient.from('pms_occupancy_forecast').upsert(rows, { onConflict: 'hotel_id,forecast_date' });

  return rows.length;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { hotel_id, action } = body as { hotel_id?: string; action?: string };

    // Scheduled refresh for all active configs (cron)
    if (action === 'refresh-all') {
      if (!isAuthorizedCronRequest(req)) return unauthorizedResponse(corsHeaders);
      const { data: configs } = await adminClient
        .from('hotel_pms_configs')
        .select('*')
        .eq('is_active', true)
        .in('pms_type', ['mews', 'apaleo', 'mister_booking']);
      const results: any[] = [];
      for (const cfg of (configs || [])) {
        try {
          const n = await buildForecastForConfig(adminClient, cfg);
          results.push({ hotel_id: cfg.hotel_id, days: n });
        } catch (e) {
          results.push({ hotel_id: cfg.hotel_id, error: String(e) });
        }
      }
      return new Response(JSON.stringify({ processed: results.length, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }

    // User-triggered single hotel refresh
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const userClient = createClient(supabaseUrl, supabaseAnon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    if (!hotel_id) {
      return new Response(JSON.stringify({ error: 'hotel_id required' }), { status: 400, headers: corsHeaders });
    }

    const { data: hotel } = await adminClient.from('hotels').select('id, user_id').eq('id', hotel_id).single();
    if (!hotel || hotel.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Not authorized for this hotel' }), { status: 403, headers: corsHeaders });
    }

    const { data: pmsConfig } = await adminClient.from('hotel_pms_configs').select('*').eq('hotel_id', hotel_id).maybeSingle();
    if (!pmsConfig) {
      return new Response(JSON.stringify({ success: false, error: 'Aucune configuration PMS trouvée.' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const days = await buildForecastForConfig(adminClient, pmsConfig);
    return new Response(JSON.stringify({ success: true, days, message: `Prévisionnel mis à jour sur ${days} jours` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal error';
    console.error('pms-forecast error:', msg);
    return new Response(JSON.stringify({ success: false, error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
