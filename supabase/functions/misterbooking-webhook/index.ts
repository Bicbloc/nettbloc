import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { mbVerifySignature } from '../_shared/misterbooking.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-signature',
};

// ─────────────────────────────────────────────────────────────────
// Webhook MisterBooking — CheckInOut (temps réel)
//
// MisterBooking envoie un POST à cet endpoint à chaque check-in / check-out.
// Le corps brut est signé via l'en-tête `X-Signature` (HMAC-SHA256 hex) avec
// la clé secrète partagée (secret MISTERBOOKING_HMAC_SECRET). On vérifie la
// signature, on retrouve l'hôtel par son ID établissement MisterBooking, puis
// on met à jour l'état opérationnel de la chambre (occupée / à blanc).
//
// Format attendu (cf. doc CheckInOut) :
// { datas: [ { establishmentId, hotelId?, action: 'checkin'|'checkout',
//              roomNumber, checkIn, checkOut, ... } ] }
// ─────────────────────────────────────────────────────────────────

const truthyAction = (v: unknown) => {
  const s = String(v ?? '').toLowerCase();
  return s === 'checkin' || s === 'checkout';
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Vérifier la signature HMAC sur le CORPS BRUT (octets transmis).
    const rawBody = await req.text();
    const signature =
      req.headers.get('x-signature') ||
      req.headers.get('X-Signature') ||
      null;

    const valid = await mbVerifySignature(rawBody, signature);
    if (!valid) {
      console.warn('MisterBooking webhook: signature HMAC invalide');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = {};
    }
    console.log('MisterBooking webhook reçu:', rawBody.slice(0, 1000));

    const datas: any[] = Array.isArray(payload.datas)
      ? payload.datas
      : Array.isArray(payload.data)
        ? payload.data
        : [payload];

    const results: any[] = [];

    for (const item of datas) {
      const action = String(item.action || '').toLowerCase();
      if (!truthyAction(action)) {
        results.push({ ignored: action || 'no-action' });
        continue;
      }

      const establishmentId = String(
        item.establishmentId ?? item.hotelId ?? item.organizationId ?? '',
      ).trim();
      const roomNumber = String(item.roomNumber || '').trim();

      if (!establishmentId) {
        results.push({ ignored: 'no-establishment' });
        continue;
      }
      if (!roomNumber) {
        results.push({ ignored: 'no-room', establishmentId });
        continue;
      }

      // 2. Retrouver l'hôtel par l'ID établissement MisterBooking.
      const { data: configs } = await admin
        .from('hotel_pms_configs')
        .select('hotel_id, credentials, property_id')
        .eq('pms_type', 'mister_booking')
        .eq('is_active', true);

      const pmsConfig = (configs || []).find((c: any) => {
        const cid = String(c.credentials?.propertyId ?? c.property_id ?? '').trim();
        return cid && cid === establishmentId;
      });

      if (!pmsConfig) {
        console.warn(`Aucune config MisterBooking active pour establishmentId=${establishmentId}`);
        results.push({ no_config: establishmentId });
        continue;
      }

      const hotelId = pmsConfig.hotel_id;
      const isCheckout = action === 'checkout';

      // 3. Mapper l'événement -> état de la chambre.
      const status = isCheckout ? 'checkout' : 'occupied';
      const cleaning_type = isCheckout ? 'a_blanc' : 'recouche';

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

      // Proposer la chambre au registre si inconnue.
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
            pms_type: 'mister_booking',
            detected_at: new Date().toISOString(),
          },
          { onConflict: 'hotel_id,room_number', ignoreDuplicates: true },
        );
      }

      const actionDescription = isCheckout
        ? `MisterBooking: client sorti en chambre ${roomNumber}`
        : `MisterBooking: client arrivé en chambre ${roomNumber}`;

      await admin.from('notifications').insert({
        hotel_id: hotelId,
        title: isCheckout ? 'Client sorti' : 'Client arrivé',
        description: isCheckout
          ? `Chambre ${roomNumber} : check-out déclaré sur MisterBooking — à blanc.`
          : `Chambre ${roomNumber} : check-in déclaré sur MisterBooking — occupée (recouche).`,
        type: 'room-status',
        room_number: roomNumber,
        user_type: 'admin',
        is_read: false,
      });

      await admin.from('daily_action_logs').insert({
        hotel_id: hotelId,
        log_date: new Date().toISOString().split('T')[0],
        action_type: isCheckout ? 'pms_checkout' : 'pms_checkin',
        actor_name: 'MisterBooking',
        actor_type: 'system',
        room_number: roomNumber,
        description: actionDescription,
        details: { source: 'mister_booking', action, room_status: status, cleaning_type },
      });

      await admin.from('room_status_updates').insert({
        hotel_id: hotelId,
        room_number: roomNumber,
        status,
        message: actionDescription,
      });

      console.log(`MisterBooking webhook: hôtel=${hotelId} chambre=${roomNumber} -> ${status}/${cleaning_type}`);
      results.push({ ok: true, room: roomNumber, status, cleaning_type });
    }

    return new Response(JSON.stringify({ success: 'true', results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal error';
    console.error('misterbooking-webhook error:', msg);
    return new Response(JSON.stringify({ success: 'false', errors: [{ code: 'E06', description: msg }] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
