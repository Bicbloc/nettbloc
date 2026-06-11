import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isAuthorizedCronRequest, unauthorizedResponse } from "../_shared/cronAuth.ts";
import { mbConfigured, mbFetchRoomMapping, mbUpdateHousekeeping } from "../_shared/misterbooking.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

interface PmsCredentials {
  clientId?: string;
  clientSecret?: string;
  propertyId?: string;
  clientToken?: string;
  accessToken?: string;
  baseUrl?: string;
}

const BATCH_SIZE = 25;

// ─────────────────────────────────────────────────────────────────
// Status mapping (NettoBloc room status -> PMS housekeeping state)
// ─────────────────────────────────────────────────────────────────

// Apaleo only knows Clean / Dirty.
function mapStatusToApaleoCondition(status: string): 'Clean' | 'Dirty' | null {
  const s = (status || '').toLowerCase();
  if (s === 'clean' || s === 'propre' || s === 'inspected' || s === 'inspecté') return 'Clean';
  if (
    s === 'needs-cleaning' ||
    s === 'dirty' ||
    s === 'sale' ||
    s === 'checkout' ||
    s === 'ready-to-clean' ||
    s === 'in-progress'
  ) {
    return 'Dirty';
  }
  return null;
}

// Mews supports Clean / Inspected / Dirty (and OutOfService/OutOfOrder, unused here).
function mapStatusToMewsState(status: string): 'Clean' | 'Inspected' | 'Dirty' | null {
  const s = (status || '').toLowerCase();
  if (s === 'inspected' || s === 'inspecté') return 'Inspected';
  if (s === 'clean' || s === 'propre') return 'Clean';
  if (
    s === 'needs-cleaning' ||
    s === 'dirty' ||
    s === 'sale' ||
    s === 'checkout' ||
    s === 'ready-to-clean' ||
    s === 'in-progress'
  ) {
    return 'Dirty';
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Apaleo helpers
// ─────────────────────────────────────────────────────────────────

// Cache de token Apaleo (par clientId) pour éviter le throttling du
// endpoint connect/token (sinon 400 invalid_client).
const apaleoTokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getApaleoToken(creds: PmsCredentials): Promise<string> {
  const clientId = (creds.clientId || '').trim();
  const clientSecret = (creds.clientSecret || '').trim();
  if (!clientId || !clientSecret) {
    throw new Error('Client ID / Client Secret Apaleo manquants');
  }
  const cached = apaleoTokenCache.get(clientId);
  if (cached && cached.expiresAt - 60_000 > Date.now()) {
    return cached.token;
  }
  const requestToken = async () => {
    return await fetch('https://identity.apaleo.com/connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
  };
  let res = await requestToken();
  if (res.status === 400 || res.status === 429) {
    await new Promise((r) => setTimeout(r, 1200));
    res = await requestToken();
  }
  if (!res.ok) {
    throw new Error(`Auth Apaleo échouée [${res.status}]: ${await res.text()}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error('Token Apaleo non reçu');
  const ttlMs = (Number(data.expires_in) || 3600) * 1000;
  apaleoTokenCache.set(clientId, { token: data.access_token, expiresAt: Date.now() + ttlMs });
  return data.access_token;
}

// ─────────────────────────────────────────────────────────────────
// Mews helpers
// ─────────────────────────────────────────────────────────────────

// POST helper that respects Mews rate limits (429 -> wait + retry).
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

// ─────────────────────────────────────────────────────────────────
// Per-hotel context (cached during a single run)
// ─────────────────────────────────────────────────────────────────

interface HotelContext {
  pmsType: 'apaleo' | 'mews' | 'mister_booking';
  // Apaleo
  apaleoToken?: string;
  apaleoUnits?: any[];
  // Mews
  mewsAuth?: { ClientToken?: string; AccessToken?: string; Client: string };
  mewsBaseUrl?: string;
  mewsResourceByName?: Map<string, string>; // lowercased name -> ResourceId
  // MisterBooking
  mbHotelId?: number;
  mbRoomIdByName?: Map<string, number>; // lowercased room number -> roomId
}

const hotelCache = new Map<string, HotelContext>();

async function loadHotelContext(admin: any, hotelId: string): Promise<HotelContext> {
  if (hotelCache.has(hotelId)) return hotelCache.get(hotelId)!;

  const { data: config, error: configErr } = await admin
    .from('hotel_pms_configs')
    .select('credentials, property_id, base_url, pms_type, is_active')
    .eq('hotel_id', hotelId)
    .eq('is_active', true)
    .in('pms_type', ['apaleo', 'mews', 'mister_booking'])
    .maybeSingle();

  if (configErr) throw configErr;
  if (!config) throw new Error('Aucune configuration PMS active (Apaleo/Mews/MisterBooking) pour cet hôtel');

  const creds = (config.credentials || {}) as PmsCredentials;

  if (config.pms_type === 'mister_booking') {
    if (!mbConfigured()) throw new Error('Identifiants partenaire MisterBooking manquants (secrets WSSE).');
    const mbHotelId = parseInt(String(creds.propertyId || config.property_id || ''), 10);
    if (!mbHotelId) throw new Error('ID établissement MisterBooking manquant');
    // Construit la table chambre -> roomId à partir du mapping (inventaire complet).
    const mapping = await mbFetchRoomMapping(mbHotelId);
    const byName = new Map<string, number>();
    for (const m of mapping) {
      if (m.roomNumber && m.roomId) byName.set(String(m.roomNumber).trim().toLowerCase(), m.roomId);
    }
    const ctx: HotelContext = { pmsType: 'mister_booking', mbHotelId, mbRoomIdByName: byName };
    hotelCache.set(hotelId, ctx);
    return ctx;
  }

  if (config.pms_type === 'apaleo') {
    const propertyId = creds.propertyId || config.property_id;
    if (!propertyId) throw new Error('Property ID Apaleo manquant');
    const token = await getApaleoToken(creds);
    const unitsRes = await fetch(
      `https://api.apaleo.com/inventory/v1/units?propertyId=${propertyId}&pageSize=200`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
    );
    if (!unitsRes.ok) {
      throw new Error(`Récupération unités Apaleo échouée [${unitsRes.status}]: ${await unitsRes.text()}`);
    }
    const unitsData = await unitsRes.json();
    const ctx: HotelContext = { pmsType: 'apaleo', apaleoToken: token, apaleoUnits: unitsData.units || [] };
    hotelCache.set(hotelId, ctx);
    return ctx;
  }

  // Mews
  const baseUrl = creds.baseUrl || config.base_url || 'https://api.mews.com/api/connector/v1';
  const auth = {
    ClientToken: creds.clientToken,
    AccessToken: creds.accessToken,
    Client: 'NettoBloc 1.0',
  };
  if (!auth.ClientToken || !auth.AccessToken) {
    throw new Error('Client Token / Access Token Mews manquants');
  }

  const resourcesRes = await mewsFetch(`${baseUrl}/resources/getAll`, {
    ...auth,
    Extent: { Resources: true },
  });
  if (!resourcesRes.ok) {
    throw new Error(`Mews resources/getAll échoué [${resourcesRes.status}]: ${await resourcesRes.text()}`);
  }
  const resourcesData = await resourcesRes.json();
  const resources = resourcesData.Resources || [];
  const byName = new Map<string, string>();
  for (const r of resources) {
    if (r.Data?.Discriminator === 'Space' && r.Name) {
      byName.set(String(r.Name).trim().toLowerCase(), r.Id);
    }
  }

  const ctx: HotelContext = {
    pmsType: 'mews',
    mewsAuth: auth,
    mewsBaseUrl: baseUrl,
    mewsResourceByName: byName,
  };
  hotelCache.set(hotelId, ctx);
  return ctx;
}

// ─────────────────────────────────────────────────────────────────
// Row processing
// ─────────────────────────────────────────────────────────────────

async function processRow(admin: any, row: any): Promise<void> {
  const ctx = await loadHotelContext(admin, row.hotel_id);
  const target = (row.room_number || '').toString().trim().toLowerCase();

  if (ctx.pmsType === 'mister_booking') {
    // MisterBooking ne connaît que clean / dirty.
    const s = (row.status || '').toLowerCase();
    let mbStatus: 'clean' | 'dirty' | null = null;
    if (s === 'clean' || s === 'propre' || s === 'inspected' || s === 'inspecté') mbStatus = 'clean';
    else if (['needs-cleaning', 'dirty', 'sale', 'checkout', 'ready-to-clean', 'in-progress'].includes(s)) mbStatus = 'dirty';
    if (!mbStatus) {
      await admin
        .from('pms_sync_queue')
        .update({ state: 'success', last_error: `Statut "${row.status}" non synchronisé` })
        .eq('id', row.id);
      return;
    }
    const roomId = ctx.mbRoomIdByName?.get(target);
    if (!roomId) {
      throw new Error(`Chambre MisterBooking introuvable (roomId) pour la chambre ${row.room_number}`);
    }
    const result = await mbUpdateHousekeeping(ctx.mbHotelId!, [
      { roomId, status: mbStatus, date: new Date().toISOString() },
    ]);
    if (!result?.success) {
      throw new Error(`Mise à jour housekeeping MisterBooking refusée: ${JSON.stringify(result?.data || {})}`);
    }
    await admin.from('pms_sync_queue').update({ state: 'success', last_error: null }).eq('id', row.id);
    return;
  }

  if (ctx.pmsType === 'apaleo') {
    const condition = mapStatusToApaleoCondition(row.status);
    if (!condition) {
      await admin
        .from('pms_sync_queue')
        .update({ state: 'success', last_error: `Statut "${row.status}" non synchronisé` })
        .eq('id', row.id);
      return;
    }
    const unit = (ctx.apaleoUnits || []).find(
      (u: any) =>
        (u.name || '').toString().trim().toLowerCase() === target ||
        (u.description || '').toString().trim().toLowerCase() === target,
    );
    if (!unit) {
      throw new Error(`Unité Apaleo introuvable pour la chambre ${row.room_number}`);
    }
    const putRes = await fetch('https://api.apaleo.com/operations/v1/units-condition', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${ctx.apaleoToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ unitsConditions: [{ id: unit.id, condition }] }),
    });
    if (!putRes.ok) {
      throw new Error(`Mise à jour condition Apaleo échouée [${putRes.status}]: ${await putRes.text()}`);
    }
    await admin.from('pms_sync_queue').update({ state: 'success', last_error: null }).eq('id', row.id);
    return;
  }

  // Mews
  const state = mapStatusToMewsState(row.status);
  if (!state) {
    await admin
      .from('pms_sync_queue')
      .update({ state: 'success', last_error: `Statut "${row.status}" non synchronisé` })
      .eq('id', row.id);
    return;
  }
  const resourceId = ctx.mewsResourceByName?.get(target);
  if (!resourceId) {
    throw new Error(`Ressource Mews introuvable pour la chambre ${row.room_number}`);
  }
  const updateRes = await mewsFetch(`${ctx.mewsBaseUrl}/resources/update`, {
    ...ctx.mewsAuth,
    ResourceUpdates: [
      {
        ResourceId: resourceId,
        State: { Value: state },
        StateReason: { Value: 'NettoBloc' },
      },
    ],
  });
  if (!updateRes.ok) {
    throw new Error(`Mise à jour état Mews échouée [${updateRes.status}]: ${await updateRes.text()}`);
  }
  await admin.from('pms_sync_queue').update({ state: 'success', last_error: null }).eq('id', row.id);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Background processor: only callable by the scheduler/service role.
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Allow either the scheduler/service-role (cron) OR a logged-in user to
  // trigger immediate processing. Processing only pushes already-queued, due
  // rows to the PMS, so authenticated users triggering it is safe and enables
  // real-time push-back when a room is marked clean/inspected.
  let authorized = isAuthorizedCronRequest(req);
  if (!authorized) {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (authHeader.startsWith('Bearer ')) {
      try {
        const userClient = createClient(supabaseUrl, supabaseAnon, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await userClient.auth.getUser();
        authorized = !!user;
      } catch (_) {
        authorized = false;
      }
    }
  }
  if (!authorized) {
    return unauthorizedResponse(corsHeaders);
  }

  const admin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data: rows, error } = await admin
      .from('pms_sync_queue')
      .select('*')
      .eq('state', 'pending')
      .lte('next_attempt_at', new Date().toISOString())
      .order('next_attempt_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (error) throw error;

    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let succeeded = 0;
    let failed = 0;

    for (const row of rows) {
      await admin.from('pms_sync_queue').update({ state: 'processing' }).eq('id', row.id);

      try {
        await processRow(admin, row);
        succeeded++;
      } catch (e) {
        failed++;
        const attempts = (row.attempts || 0) + 1;
        const maxAttempts = row.max_attempts || 5;
        const message = e instanceof Error ? e.message : 'Erreur inconnue';

        if (attempts >= maxAttempts) {
          await admin
            .from('pms_sync_queue')
            .update({ state: 'failed', attempts, last_error: message })
            .eq('id', row.id);
        } else {
          const delayMin = Math.min(Math.pow(2, attempts), 60);
          const nextAttempt = new Date(Date.now() + delayMin * 60_000).toISOString();
          await admin
            .from('pms_sync_queue')
            .update({
              state: 'pending',
              attempts,
              last_error: message,
              next_attempt_at: nextAttempt,
            })
            .eq('id', row.id);
        }
      }
    }

    return new Response(
      JSON.stringify({ processed: rows.length, succeeded, failed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('pms-sync-queue-process error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erreur inconnue' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
