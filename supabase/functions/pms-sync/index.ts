import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isAuthorizedCronRequest, unauthorizedResponse } from "../_shared/cronAuth.ts";

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

interface ExtractedRoom {
  roomNumber: string;
  status: string;
  cleaningType: string;
  condition?: string | null;
  floor?: number;
  roomType?: string;
  guestName?: string;
  arrivalDate?: string;
  departureDate?: string;
  notes?: string;
}

// ─── Mews Connector ───────────────────────────────────────────────
// POST helper that respects Mews rate limits (200 req / 30s per AccessToken).
// On 429 it waits for Retry-After (or exponential backoff) and retries.
async function mewsFetch(url: string, body: unknown, attempt = 0): Promise<Response> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 429 && attempt < 4) {
    const retryAfter = Number(res.headers.get('Retry-After'));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.min(1000 * 2 ** attempt, 8000);
    await res.text().catch(() => {});
    await new Promise((r) => setTimeout(r, waitMs));
    return mewsFetch(url, body, attempt + 1);
  }

  return res;
}

async function fetchMewsRooms(credentials: PmsCredentials): Promise<ExtractedRoom[]> {
  const baseUrl = credentials.baseUrl || 'https://api.mews.com/api/connector/v1';

  // 1. Fetch spaces (rooms)
  const spacesRes = await mewsFetch(`${baseUrl}/spaces/getAll`, {
    ClientToken: credentials.clientToken,
    AccessToken: credentials.accessToken,
    LanguageCode: 'fr-FR',
    Extent: {
      Spaces: true,
      SpaceCategories: true,
      SpaceFeatures: true,
    },
  });

  if (!spacesRes.ok) {
    const errBody = await spacesRes.text();
    throw new Error(`Mews spaces/getAll failed [${spacesRes.status}]: ${errBody}`);
  }

  const spacesData = await spacesRes.json();
  const spaces = spacesData.Spaces || [];
  const categories = spacesData.SpaceCategories || [];

  // Build category map
  const categoryMap: Record<string, string> = {};
  for (const cat of categories) {
    categoryMap[cat.Id] = cat.ShortName || cat.Name || 'Standard';
  }

  // 2. Fetch reservations for today
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const reservationsRes = await mewsFetch(`${baseUrl}/reservations/getAll`, {
    ClientToken: credentials.clientToken,
    AccessToken: credentials.accessToken,
    StartUtc: `${today}T00:00:00Z`,
    EndUtc: `${tomorrow}T23:59:59Z`,
    Extent: {
      Reservations: true,
      Customers: true,
    },
    States: ['Confirmed', 'Started'],
  });

  let reservations: any[] = [];
  let customers: any[] = [];
  if (reservationsRes.ok) {
    const resData = await reservationsRes.json();
    reservations = resData.Reservations || [];
    customers = resData.Customers || [];
  }

  // Build customer map
  const customerMap: Record<string, string> = {};
  for (const c of customers) {
    customerMap[c.Id] = `${c.LastName || ''} ${c.FirstName || ''}`.trim();
  }

  // Build reservation map by space (room)
  const reservationBySpace: Record<string, any> = {};
  for (const r of reservations) {
    if (r.AssignedSpaceId) {
      reservationBySpace[r.AssignedSpaceId] = r;
    }
  }

  // 3. Map to ExtractedRoom[]
  return spaces
    .filter((s: any) => s.Type === 'Room' || !s.Type)
    .map((space: any) => {
      const reservation = reservationBySpace[space.Id];
      const hasReservation = !!reservation;
      
      let cleaningType = 'recouche';
      let status = 'occupied';

      if (!hasReservation) {
        cleaningType = 'depart';
        status = 'vacant';
      } else if (reservation) {
        const checkIn = reservation.StartUtc?.split('T')[0];
        const checkOut = reservation.EndUtc?.split('T')[0];
        if (checkOut === today) {
          cleaningType = 'depart';
          status = 'checkout';
        } else if (checkIn === today) {
          cleaningType = 'arrivee';
          status = 'arrival';
        }
      }

      const floor = space.FloorNumber || (space.Number ? parseInt(space.Number.toString().slice(0, -2)) || undefined : undefined);

      return {
        roomNumber: space.Number || space.Name || space.Id,
        status,
        cleaningType,
        floor,
        roomType: categoryMap[space.CategoryId] || undefined,
        guestName: reservation ? customerMap[reservation.CustomerId] : undefined,
        arrivalDate: reservation?.StartUtc?.split('T')[0],
        departureDate: reservation?.EndUtc?.split('T')[0],
      };
    });
}

// Parse une réponse JSON en évitant l'erreur "unexpected end of JSON input"
async function safeJson(res: Response, label: string): Promise<any> {
  const text = await res.text();
  if (!text || !text.trim()) {
    throw new Error(`${label}: réponse vide du serveur (HTTP ${res.status})`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label}: réponse invalide (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
}

// GET JSON robuste : en-tête Accept (pas Content-Type sur un GET), retry si corps vide
async function getJson(url: string, token: string, label: string): Promise<any> {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`${label} échouée [${res.status}]: ${errBody || 'vérifiez le Property ID'}`);
    }
    const text = await res.text();
    if (text && text.trim()) {
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`${label}: réponse invalide (HTTP ${res.status}): ${text.slice(0, 200)}`);
      }
    }
    console.warn(`${label}: corps vide (HTTP ${res.status}), tentative ${attempt}/2`);
  }
  throw new Error(`${label}: réponse vide du serveur après 2 tentatives.`);
}


// ─── Apaleo Connector ─────────────────────────────────────────────
async function fetchApaleoRooms(credentials: PmsCredentials): Promise<ExtractedRoom[]> {
  const propertyId = credentials.propertyId;
  if (!credentials.clientId || !credentials.clientSecret) {
    throw new Error('Client ID et Client Secret Apaleo requis.');
  }
  if (!propertyId) {
    throw new Error('Property ID Apaleo manquant.');
  }

  // 1. Get OAuth token (scope requis pour accéder aux unités et réservations)
  const tokenRes = await fetch('https://identity.apaleo.com/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    throw new Error(`Authentification Apaleo échouée [${tokenRes.status}]: ${errBody || 'vérifiez Client ID / Client Secret'}`);
  }

  const tokenData = await safeJson(tokenRes, 'Authentification Apaleo');
  const access_token = tokenData.access_token;
  if (!access_token) {
    throw new Error('Token Apaleo non reçu — vérifiez Client ID / Client Secret et les scopes du compte.');
  }

  // 2. Fetch units (rooms)
  const unitsData = await getJson(
    `https://api.apaleo.com/inventory/v1/units?propertyId=${propertyId}&expand=unitGroup&pageSize=200`,
    access_token,
    'Récupération des chambres Apaleo'
  );
  const units = unitsData.units || [];

  // 3. Fetch reservations for today (from/to must be date-time and to > from)
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  let reservations: any[] = [];
  try {
    const resData = await getJson(
      `https://api.apaleo.com/booking/v1/reservations?propertyIds=${propertyId}&dateFilter=Stay&from=${today}T00:00:00Z&to=${tomorrow}T00:00:00Z&status=Confirmed,InHouse&pageSize=200`,
      access_token,
      'Réservations Apaleo'
    );
    reservations = resData.reservations || [];
  } catch (e) {
    console.warn('Réservations Apaleo non récupérées:', e instanceof Error ? e.message : e);
  }


  // Build reservation map by unit
  const reservationByUnit: Record<string, any> = {};
  for (const r of reservations) {
    if (r.unit?.id) {
      reservationByUnit[r.unit.id] = r;
    }
  }

  return units.map((unit: any) => {
    const reservation = reservationByUnit[unit.id];
    // Apaleo expose l'état directement dans unit.status :
    //  - status.condition : Clean | CleanToBeInspected | Dirty
    //  - status.maintenance.type : OutOfService | OutOfOrder | OutOfInventory
    //  - status.isOccupied : boolean
    const condition: string | undefined = unit?.status?.condition;
    const maintenance: string | undefined = unit?.status?.maintenance?.type;
    const isOccupied: boolean = unit?.status?.isOccupied === true;
    let cleaningType = 'none';
    let status = 'vacant';

    if (maintenance === 'OutOfService' || maintenance === 'OutOfOrder' || maintenance === 'OutOfInventory') {
      // Chambre hors service : pas de ménage
      cleaningType = 'hors_service';
      status = 'out-of-service';
    } else if (reservation) {
      const departure = reservation.departure?.split('T')[0];
      const arrival = reservation.arrival?.split('T')[0];
      if (departure === today) {
        cleaningType = 'depart';
        status = 'checkout';
      } else if (arrival === today) {
        cleaningType = 'arrivee';
        status = 'arrival';
      } else {
        cleaningType = 'recouche';
        status = 'occupied';
      }
    } else if (isOccupied) {
      // Occupée mais pas de réservation détaillée -> recouche
      cleaningType = 'recouche';
      status = 'occupied';
    } else {
      // Vacante : on se fie à l'état de ménage Apaleo
      if (condition === 'Dirty') {
        cleaningType = 'depart';
        status = 'checkout';
      } else {
        // Clean / CleanToBeInspected -> rien à faire
        cleaningType = 'none';
        status = 'clean';
      }
    }

    return {
      roomNumber: unit.name || unit.id,
      status,
      cleaningType,
      condition: maintenance ?? condition ?? null,
      floor: unit.floor ? parseInt(unit.floor) : undefined,
      roomType: unit.unitGroup?.name,
      guestName: reservation?.primaryGuest ? `${reservation.primaryGuest.lastName || ''} ${reservation.primaryGuest.firstName || ''}`.trim() : undefined,
      arrivalDate: reservation?.arrival?.split('T')[0],
      departureDate: reservation?.departure?.split('T')[0],
    };
  });
}

// ─── Shared mapping + sync helpers ────────────────────────────────
// Map cleaningType (depart/arrivee/recouche/none/hors_service) -> cleaning_type stocké en base
function toDbCleaningType(t?: string): string {
  switch ((t || '').toLowerCase()) {
    case 'depart':
    case 'arrivee':
    case 'full':
    case 'a_blanc':
      return 'a_blanc';
    case 'recouche':
    case 'quick':
    case 'occupied':
      return 'recouche';
    default:
      return 'none';
  }
}

// Statut chambre : propre / hors service -> pas besoin de ménage
function toDbStatus(room: ExtractedRoom): string {
  if (room.cleaningType === 'hors_service' || room.status === 'out-of-service') return 'out-of-service';
  if (room.status === 'clean' && room.cleaningType === 'none') return 'clean';
  return 'needs-cleaning';
}

async function extractRoomsForConfig(pmsConfig: any): Promise<ExtractedRoom[]> {
  const credentials = pmsConfig.credentials as PmsCredentials;
  switch (pmsConfig.pms_type) {
    case 'mews':
      return await fetchMewsRooms(credentials);
    case 'apaleo':
      return await fetchApaleoRooms(credentials);
    default:
      throw new Error(`PMS type '${pmsConfig.pms_type}' not supported`);
  }
}

// Run a full sync for a single config: extract rooms, upsert, update logs/status.
async function performSync(adminClient: any, pmsConfig: any): Promise<number> {
  const hotel_id = pmsConfig.hotel_id;

  const { data: syncLog } = await adminClient
    .from('pms_sync_logs')
    .insert({ hotel_id, pms_type: pmsConfig.pms_type, status: 'running' })
    .select('id')
    .single();

  try {
    const rooms = await extractRoomsForConfig(pmsConfig);

    // Registre permanent : on ne l'enrichit PAS automatiquement.
    // Les chambres détectées hors registre sont proposées à la validation (pms_pending_rooms).
    const { data: registryRooms } = await adminClient
      .from('hotel_rooms_registry')
      .select('room_number')
      .eq('hotel_id', hotel_id)
      .eq('is_active', true);
    const registrySet = new Set((registryRooms || []).map((r: any) => String(r.room_number)));

    const { data: existingRooms } = await adminClient
      .from('rooms')
      .select('room_number, status')
      .eq('hotel_id', hotel_id);
    const existingRoomStatusMap = new Map(
      (existingRooms || []).map((room: any) => [String(room.room_number), String(room.status || '')])
    );

    for (const room of rooms) {
      const existingStatus = existingRoomStatusMap.get(String(room.roomNumber));
      const nextStatus = toDbStatus(room);
      const preservedStatus =
        existingStatus === 'checkout' || existingStatus === 'ready-to-clean'
          ? existingStatus
          : nextStatus;

      // Opérations du jour : on (re)crée la chambre dans rooms.
      const { error: roomUpsertError } = await adminClient
        .from('rooms')
        .upsert({
          hotel_id,
          room_number: room.roomNumber,
          status: preservedStatus,
          cleaning_type: toDbCleaningType(room.cleaningType),
          floor: room.floor ?? null,
          room_type: room.roomType ?? null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'hotel_id,room_number' });

      if (roomUpsertError) {
        console.error(`Échec upsert room ${room.roomNumber}:`, JSON.stringify(roomUpsertError));
        throw new Error(`Échec d'enregistrement de la chambre ${room.roomNumber}: ${roomUpsertError.message}`);
      }

      // Nouvelle chambre absente du registre -> proposition (sans écraser les statuts ignored/added existants).
      if (!registrySet.has(String(room.roomNumber))) {
        await adminClient
          .from('pms_pending_rooms')
          .upsert({
            hotel_id,
            room_number: room.roomNumber,
            floor: room.floor ?? null,
            room_type: room.roomType ?? null,
            pms_type: pmsConfig.pms_type,
            detected_at: new Date().toISOString(),
          }, { onConflict: 'hotel_id,room_number', ignoreDuplicates: true });
      }
    }

    await adminClient
      .from('pms_sync_logs')
      .update({ status: 'success', sync_ended_at: new Date().toISOString(), rooms_synced: rooms.length })
      .eq('id', syncLog?.id);

    await adminClient
      .from('hotel_pms_configs')
      .update({ last_sync_at: new Date().toISOString(), last_sync_status: 'success', last_sync_error: null })
      .eq('id', pmsConfig.id);

    return rooms.length;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Sync failed';
    await adminClient
      .from('pms_sync_logs')
      .update({ status: 'error', sync_ended_at: new Date().toISOString(), error_message: msg })
      .eq('id', syncLog?.id);
    await adminClient
      .from('hotel_pms_configs')
      .update({ last_sync_status: 'error', last_sync_error: msg })
      .eq('id', pmsConfig.id);
    throw error;
  }
}

// Returns { date: "YYYY-MM-DD", minutes: minutesSinceMidnight } in the given timezone
function nowInTimezone(timeZone: string): { date: string; minutes: number } {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  let hour = parseInt(get('hour'), 10);
  if (hour === 24) hour = 0;
  const minutes = hour * 60 + parseInt(get('minute'), 10);
  return { date, minutes };
}

function timeToMinutes(t: string): number {
  const [h, m] = (t || '06:00').split(':').map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}

// Scheduled morning sync: loop active configs and sync those whose local time has reached auto_sync_time.
async function runScheduledSync(adminClient: any) {
  const { data: configs, error } = await adminClient
    .from('hotel_pms_configs')
    .select('*')
    .eq('is_active', true)
    .eq('auto_sync_enabled', true);

  if (error) throw error;

  const results: any[] = [];
  for (const cfg of (configs || [])) {
    // Resolve hotel timezone (reuse closure timezone)
    const { data: hotel } = await adminClient
      .from('hotels')
      .select('id, name, auto_close_timezone')
      .eq('id', cfg.hotel_id)
      .maybeSingle();

    const tz = hotel?.auto_close_timezone || 'Europe/Paris';
    const { date, minutes } = nowInTimezone(tz);

    const timeReached = minutes >= timeToMinutes(cfg.auto_sync_time);
    const notYetSyncedToday = cfg.last_auto_sync_date !== date;

    if (!(timeReached && notYetSyncedToday)) continue;

    try {
      const count = await performSync(adminClient, cfg);
      await adminClient
        .from('hotel_pms_configs')
        .update({ last_auto_sync_date: date })
        .eq('id', cfg.id);
      results.push({ hotel_id: cfg.hotel_id, name: hotel?.name, synced: true, rooms: count });
    } catch (e) {
      console.error(`Scheduled sync error hotel ${cfg.hotel_id}:`, e);
      results.push({ hotel_id: cfg.hotel_id, name: hotel?.name, synced: false, error: String(e) });
    }
  }
  return results;
}

// ─── Main handler ─────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body early to detect the scheduled (cron) action.
    const body = await req.json().catch(() => ({}));
    const { hotel_id, action } = body as { hotel_id?: string; action?: string };

    // ── Scheduled morning sync (called by cron, no user auth) ──
    if (action === 'scheduled') {
      // Scheduled sync is privileged: require scheduler/service-role auth.
      if (!isAuthorizedCronRequest(req)) {
        return unauthorizedResponse(corsHeaders);
      }
      const results = await runScheduledSync(adminClient);
      return new Response(JSON.stringify({ processed: results.length, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Validate auth (all other actions require a logged-in user)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub as string;

    if (!hotel_id) {
      return new Response(JSON.stringify({ error: 'hotel_id required' }), { status: 400, headers: corsHeaders });
    }
    // adminClient already created above (service role for DB operations)


    // Verify hotel ownership
    const { data: hotel } = await adminClient
      .from('hotels')
      .select('id, user_id')
      .eq('id', hotel_id)
      .single();

    if (!hotel || hotel.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Not authorized for this hotel' }), { status: 403, headers: corsHeaders });
    }

    // Get PMS config.
    // For a connection test, we don't require is_active=true (the user is
    // typically testing before enabling automatic sync). For real syncs, only
    // active configs are synced.
    let configQuery = adminClient
      .from('hotel_pms_configs')
      .select('*')
      .eq('hotel_id', hotel_id);

    // Only the automatic 'sync' action requires an active config.
    // 'test' and 'import' run on demand even before activation.
    if (action === 'sync') {
      configQuery = configQuery.eq('is_active', true);
    }

    const { data: pmsConfig } = await configQuery.maybeSingle();

    if (!pmsConfig) {
      return new Response(JSON.stringify({
        success: false,
        error: action === 'test'
          ? 'Aucune configuration PMS trouvée. Sauvegardez d\'abord vos identifiants.'
          : 'Aucune configuration PMS active trouvée.',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Test connection only
    if (action === 'test') {
      try {
        const credentials = pmsConfig.credentials as PmsCredentials;
        let rooms: ExtractedRoom[] = [];

        switch (pmsConfig.pms_type) {
          case 'mews':
            rooms = await fetchMewsRooms(credentials);
            break;
          case 'apaleo':
            rooms = await fetchApaleoRooms(credentials);
            break;
          default:
            return new Response(JSON.stringify({ success: false, error: `Le PMS '${pmsConfig.pms_type}' n'est pas encore supporté pour la synchro API directe.` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ 
          success: true, 
          message: `Connexion réussie : ${rooms.length} chambres trouvées`,
          rooms_count: rooms.length,
          rooms: rooms.map(r => ({
            roomNumber: r.roomNumber,
            floor: r.floor ?? null,
            roomType: r.roomType ?? null,
            cleaningType: r.cleaningType,
            condition: r.condition ?? null,
            guestName: r.guestName ?? null,
            arrivalDate: r.arrivalDate ?? null,
            departureDate: r.departureDate ?? null,
          })),
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return new Response(JSON.stringify({ success: false, error: msg }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Bulk import: add ALL fetched rooms to the permanent registry at once
    if (action === 'import') {
      try {
        const rooms = await extractRoomsForConfig(pmsConfig);
        let count = 0;
        for (const room of rooms) {
          await adminClient
            .from('hotel_rooms_registry')
            .upsert({
              hotel_id,
              room_number: room.roomNumber,
              floor: room.floor ?? null,
              room_type: room.roomType ?? null,
              source: 'pms_api',
              imported_from: pmsConfig.pms_type,
              last_seen_at: new Date().toISOString(),
              is_active: true,
            }, { onConflict: 'hotel_id,room_number' });
          count++;
        }
        // Mark any pending proposals for these rooms as added
        await adminClient
          .from('pms_pending_rooms')
          .update({ status: 'added', resolved_at: new Date().toISOString() })
          .eq('hotel_id', hotel_id)
          .eq('status', 'pending');

        return new Response(JSON.stringify({
          success: true,
          rooms_synced: count,
          message: `${count} chambres ajoutées au registre`,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Import failed';
        return new Response(JSON.stringify({ success: false, error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }


    // Full sync (manual or 'sync' action) — uses the shared helper
    try {
      const count = await performSync(adminClient, pmsConfig);
      return new Response(JSON.stringify({
        success: true,
        rooms_synced: count,
        message: `${count} chambres synchronisées avec succès`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Sync failed';
      return new Response(JSON.stringify({ success: false, error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }


  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal error';
    console.error('pms-sync error:', msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
