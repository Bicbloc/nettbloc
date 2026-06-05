import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isAuthorizedCronRequest, unauthorizedResponse } from "../_shared/cronAuth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

interface ApaleoCredentials {
  clientId?: string;
  clientSecret?: string;
  propertyId?: string;
}

const BATCH_SIZE = 25;

async function getApaleoToken(creds: ApaleoCredentials): Promise<string> {
  if (!creds.clientId || !creds.clientSecret) {
    throw new Error('Client ID / Client Secret Apaleo manquants');
  }
  const res = await fetch('https://identity.apaleo.com/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    }),
  });
  if (!res.ok) {
    throw new Error(`Auth Apaleo échouée [${res.status}]: ${await res.text()}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error('Token Apaleo non reçu');
  return data.access_token;
}

function mapStatusToCondition(status: string): 'Clean' | 'Dirty' | null {
  const s = (status || '').toLowerCase();
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

// Cache Apaleo token + units per hotel during a single run
const hotelCache = new Map<string, { token: string; propertyId: string; units: any[] }>();

async function loadHotelContext(admin: any, hotelId: string) {
  if (hotelCache.has(hotelId)) return hotelCache.get(hotelId)!;

  const { data: config, error: configErr } = await admin
    .from('hotel_pms_configs')
    .select('credentials, property_id, is_active')
    .eq('hotel_id', hotelId)
    .eq('pms_type', 'apaleo')
    .eq('is_active', true)
    .maybeSingle();

  if (configErr) throw configErr;
  if (!config) throw new Error('Aucune configuration Apaleo active pour cet hôtel');

  const creds = (config.credentials || {}) as ApaleoCredentials;
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
  const ctx = { token, propertyId, units: unitsData.units || [] };
  hotelCache.set(hotelId, ctx);
  return ctx;
}

async function processRow(admin: any, row: any): Promise<void> {
  const condition = mapStatusToCondition(row.status);
  if (!condition) {
    // Nothing to push for this status — mark as success (skipped)
    await admin
      .from('pms_sync_queue')
      .update({ state: 'success', last_error: `Statut "${row.status}" non synchronisé` })
      .eq('id', row.id);
    return;
  }

  const ctx = await loadHotelContext(admin, row.hotel_id);
  const target = (row.room_number || '').toString().trim().toLowerCase();
  const unit = ctx.units.find(
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
      Authorization: `Bearer ${ctx.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ unitsConditions: [{ id: unit.id, condition }] }),
  });

  if (!putRes.ok) {
    throw new Error(`Mise à jour condition Apaleo échouée [${putRes.status}]: ${await putRes.text()}`);
  }

  await admin
    .from('pms_sync_queue')
    .update({ state: 'success', last_error: null })
    .eq('id', row.id);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Claim a batch of pending rows that are due
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
      // Mark as processing to avoid double-claim
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
          // Exponential backoff: 2^attempts minutes, capped at 60 min
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
