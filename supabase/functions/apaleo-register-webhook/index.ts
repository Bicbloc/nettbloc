import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const hotelId: string = body.hotel_id || '';
    if (!hotelId) {
      return new Response(JSON.stringify({ error: 'hotel_id manquant' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: config } = await admin
      .from('hotel_pms_configs')
      .select('*')
      .eq('hotel_id', hotelId)
      .eq('pms_type', 'apaleo')
      .maybeSingle();

    if (!config) {
      return new Response(
        JSON.stringify({ error: 'Aucune configuration Apaleo trouvée pour cet hôtel' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const creds = (config as any).credentials as ApaleoCredentials;
    const token = await getApaleoToken(creds);

    const secret = Deno.env.get('APALEO_WEBHOOK_SECRET');
    const endpointUrl =
      `${supabaseUrl}/functions/v1/apaleo-webhook` +
      (secret ? `?token=${encodeURIComponent(secret)}` : '');

    // Check existing subscriptions to avoid duplicates
    const listRes = await fetch('https://webhook.apaleo.com/v1/subscriptions', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    if (listRes.status === 403) {
      return new Response(
        JSON.stringify({
          error:
            "Votre application Apaleo n'a pas la permission de gérer les webhooks (scope 'webhooks.manage'). Ajoutez ce scope à votre application Apaleo, puis réessayez.",
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let existing: any[] = [];
    if (listRes.ok) {
      const listData = await listRes.json().catch(() => ({}));
      existing = listData?.subscriptions || listData?.data || [];
    }

    const already = existing.find(
      (s: any) => (s.endpointUrl || '') === endpointUrl && s.topic === 'reservation',
    );

    if (already) {
      return new Response(
        JSON.stringify({ ok: true, status: 'already_registered', id: already.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      );
    }

    // Create the subscription for reservation check-in / check-out events
    const createRes = await fetch('https://webhook.apaleo.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpointUrl,
        events: ['reservation/checked-in', 'reservation/checked-out'],
        propertyIds: creds.propertyId ? [creds.propertyId] : undefined,
      }),
    });

    if (!createRes.ok) {
      const txt = await createRes.text();
      throw new Error(`Création abonnement échouée [${createRes.status}]: ${txt}`);
    }

    const created = await createRes.json().catch(() => ({}));
    console.log('Webhook Apaleo enregistré:', JSON.stringify(created));

    return new Response(
      JSON.stringify({ ok: true, status: 'registered', endpointUrl, subscription: created }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal error';
    console.error('apaleo-register-webhook error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
