import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-apaleo-signature',
};

interface ApaleoCredentials {
  clientId?: string;
  clientSecret?: string;
  propertyId?: string;
}

// ─── Apaleo OAuth ─────────────────────────────────────────────────
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

// Fetch a single reservation to resolve the assigned unit (room number)
async function fetchReservation(reservationId: string, token: string): Promise<any> {
  const res = await fetch(
    `https://api.apaleo.com/booking/v1/reservations/${reservationId}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  );
  if (!res.ok) {
    throw new Error(`Réservation Apaleo introuvable [${res.status}]: ${await res.text()}`);
  }
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Optional shared-secret protection (add ?token=... to the webhook URL in Apaleo)
    const expectedSecret = Deno.env.get('APALEO_WEBHOOK_SECRET');
    if (expectedSecret) {
      const url = new URL(req.url);
      if (url.searchParams.get('token') !== expectedSecret) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const payload = await req.json().catch(() => ({}));
    console.log('Apaleo webhook reçu:', JSON.stringify(payload));

    // Apaleo notification format:
    // { topic, type, accountId, propertyId, data: { entityId, propertyId } }
    const topic: string = (payload.topic || '').toLowerCase();
    const type: string = (payload.type || '').toLowerCase();
    const propertyId: string =
      payload.propertyId || payload.data?.propertyId || '';
    const entityId: string = payload.data?.entityId || payload.id || '';

    // Apaleo verification handshake (sends a verification/ping)
    if (topic === 'verification' || type === 'verification') {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (topic !== 'reservation') {
      return new Response(JSON.stringify({ ok: true, ignored: topic }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Only act on check-in / check-out events
    const isCheckout = type.includes('checked-out') || type.includes('checkedout');
    const isCheckin = type.includes('checked-in') || type.includes('checkedin');
    if (!isCheckout && !isCheckin) {
      return new Response(JSON.stringify({ ok: true, ignored: type }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (!propertyId || !entityId) {
      return new Response(JSON.stringify({ error: 'propertyId/entityId manquant' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the matching hotel PMS config by Apaleo propertyId
    const { data: configs } = await admin
      .from('hotel_pms_configs')
      .select('*')
      .eq('pms_type', 'apaleo')
      .eq('is_active', true);

    const pmsConfig = (configs || []).find(
      (c: any) => (c.credentials?.propertyId || '') === propertyId,
    );

    if (!pmsConfig) {
      console.warn(`Aucune config Apaleo active pour propertyId=${propertyId}`);
      return new Response(JSON.stringify({ ok: true, no_config: propertyId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const hotelId = pmsConfig.hotel_id;
    const creds = pmsConfig.credentials as ApaleoCredentials;

    // Resolve the room number from the reservation
    const token = await getApaleoToken(creds);
    const reservation = await fetchReservation(entityId, token);
    const roomNumber: string | undefined =
      reservation?.unit?.name || reservation?.unit?.id;

    if (!roomNumber) {
      console.warn('Réservation sans unité assignée:', entityId);
      return new Response(JSON.stringify({ ok: true, no_unit: entityId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Map event -> room state
    let status: string;
    let cleaning_type: string;
    if (isCheckout) {
      // Client sorti -> chambre à blanc à nettoyer
      status = 'checkout';
      cleaning_type = 'a_blanc';
    } else {
      // Client entré -> chambre occupée (non vacante), recouche
      status = 'occupied';
      cleaning_type = 'recouche';
    }

    // Update daily operations room (realtime listeners react to this)
    await admin.from('rooms').upsert(
      {
        hotel_id: hotelId,
        room_number: roomNumber,
        status,
        cleaning_type,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'hotel_id,room_number' },
    );

    // Propose room for registry validation if not already known
    const { data: registryRoom } = await admin
      .from('hotel_rooms_registry')
      .select('id')
      .eq('hotel_id', hotelId)
      .eq('room_number', roomNumber)
      .eq('is_active', true)
      .maybeSingle();

    if (!registryRoom) {
      await admin.from('pms_pending_rooms').upsert(
        {
          hotel_id: hotelId,
          room_number: roomNumber,
          pms_type: 'apaleo',
          detected_at: new Date().toISOString(),
        },
        { onConflict: 'hotel_id,room_number', ignoreDuplicates: true },
      );
    }

    // Create a notification so the event appears in the notification bell
    const { error: notificationError } = await admin.from('notifications').insert({
      hotel_id: hotelId,
      title: isCheckout ? 'Client sorti' : 'Client arrivé',
      description: isCheckout
        ? `Chambre ${roomNumber} : check-out déclaré sur Apaleo — à blanc.`
        : `Chambre ${roomNumber} : check-in déclaré sur Apaleo — occupée (recouche).`,
      type: 'room-status',
      room_number: roomNumber,
      user_type: 'admin',
      is_read: false,
    });

    if (notificationError) {
      console.error('Erreur insertion notification:', notificationError.message);
    }

    console.log(
      `Webhook traité: hôtel=${hotelId} chambre=${roomNumber} -> ${status}/${cleaning_type}`,
    );

    return new Response(
      JSON.stringify({ ok: true, room: roomNumber, status, cleaning_type }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal error';
    console.error('apaleo-webhook error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
