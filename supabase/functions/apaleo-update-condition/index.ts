import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApaleoCredentials {
  clientId?: string;
  clientSecret?: string;
  propertyId?: string;
}

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

// Map our internal room status to an Apaleo unit condition
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hotelId, roomNumber, status } = await req.json();

    if (!hotelId || !roomNumber || !status) {
      return new Response(
        JSON.stringify({ error: 'hotelId, roomNumber et status sont requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const condition = mapStatusToCondition(status);
    if (!condition) {
      // Nothing to push for this status (e.g. out-of-service) — not an error
      return new Response(
        JSON.stringify({ skipped: true, reason: `Statut "${status}" non synchronisé vers Apaleo` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Load active Apaleo config for this hotel
    const { data: config, error: configErr } = await admin
      .from('hotel_pms_configs')
      .select('credentials, property_id, is_active')
      .eq('hotel_id', hotelId)
      .eq('pms_type', 'apaleo')
      .eq('is_active', true)
      .maybeSingle();

    if (configErr) throw configErr;
    if (!config) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'Aucune configuration Apaleo active pour cet hôtel' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const creds = (config.credentials || {}) as ApaleoCredentials;
    const propertyId = creds.propertyId || config.property_id;
    if (!propertyId) throw new Error('Property ID Apaleo manquant');

    const token = await getApaleoToken(creds);

    // Resolve unit id by room number (unit.name === room number)
    const unitsRes = await fetch(
      `https://api.apaleo.com/inventory/v1/units?propertyId=${propertyId}&pageSize=200`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
    );
    if (!unitsRes.ok) {
      throw new Error(`Récupération unités Apaleo échouée [${unitsRes.status}]: ${await unitsRes.text()}`);
    }
    const unitsData = await unitsRes.json();
    const units = unitsData.units || [];
    const target = (roomNumber || '').toString().trim().toLowerCase();
    const unit = units.find(
      (u: any) =>
        (u.name || '').toString().trim().toLowerCase() === target ||
        (u.description || '').toString().trim().toLowerCase() === target,
    );

    if (!unit) {
      return new Response(
        JSON.stringify({ skipped: true, reason: `Unité Apaleo introuvable pour la chambre ${roomNumber}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Push the new condition to Apaleo
    const putRes = await fetch('https://api.apaleo.com/operations/v1/units-condition', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        unitsConditions: [{ id: unit.id, condition }],
      }),
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      throw new Error(`Mise à jour condition Apaleo échouée [${putRes.status}]: ${errText}`);
    }

    return new Response(
      JSON.stringify({ success: true, unitId: unit.id, condition }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('apaleo-update-condition error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erreur inconnue' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
