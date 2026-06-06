import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

interface PmsCredentials {
  clientId?: string
  clientSecret?: string
  propertyId?: string
  clientToken?: string
  accessToken?: string
  baseUrl?: string
}

async function getApaleoToken(creds: PmsCredentials): Promise<string> {
  if (!creds.clientId || !creds.clientSecret) throw new Error('Identifiants Apaleo manquants')
  const res = await fetch('https://identity.apaleo.com/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    }),
  })
  if (!res.ok) throw new Error(`Auth Apaleo échouée [${res.status}]`)
  const data = await res.json()
  if (!data.access_token) throw new Error('Token Apaleo non reçu')
  return data.access_token
}

// Map room number -> in-house reservation id (matching the assigned unit name)
async function buildApaleoReservationMap(token: string, propertyId: string): Promise<Map<string, string>> {
  const res = await fetch(
    `https://api.apaleo.com/booking/v1/reservations?propertyId=${propertyId}&status=InHouse&pageSize=200&expand=timeSlices`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  )
  if (!res.ok) throw new Error(`Récupération réservations Apaleo échouée [${res.status}]`)
  const data = await res.json()
  const map = new Map<string, string>()
  for (const r of data.reservations || []) {
    const slices = r.timeSlices || []
    for (const s of slices) {
      const name = s.unit?.name || s.unit?.id
      if (name) map.set(String(name).trim().toLowerCase(), r.id)
    }
  }
  return map
}

async function postApaleoCharge(
  token: string,
  reservationId: string,
  name: string,
  amount: number,
  currency: string,
  quantity: number,
): Promise<void> {
  // Resolve folio for reservation
  const folioRes = await fetch(
    `https://api.apaleo.com/finance/v1/folios?reservationId=${reservationId}&pageSize=1`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  )
  if (!folioRes.ok) throw new Error(`Folio Apaleo introuvable [${folioRes.status}]`)
  const folioData = await folioRes.json()
  const folioId = folioData.folios?.[0]?.id
  if (!folioId) throw new Error('Aucun folio ouvert pour la réservation')

  const chargeRes = await fetch(`https://api.apaleo.com/finance/v1/folios/${folioId}/charges`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceType: 'FoodAndBeverages',
      name,
      quantity,
      amount: { amount, currency },
    }),
  })
  if (!chargeRes.ok) throw new Error(`Charge Apaleo refusée [${chargeRes.status}]: ${await chargeRes.text()}`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  // Require an authenticated caller (manager) or service role.
  const authHeader = req.headers.get('Authorization') ?? ''
  let authorized = authHeader.includes(serviceKey)
  if (!authorized && authHeader.startsWith('Bearer ')) {
    try {
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
      const { data: { user } } = await userClient.auth.getUser()
      authorized = !!user
    } catch (_) { authorized = false }
  }
  if (!authorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(supabaseUrl, serviceKey)

  try {
    const { hotel_id, log_date, room_number } = await req.json()
    if (!hotel_id) {
      return new Response(JSON.stringify({ error: 'hotel_id requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const date = log_date || new Date().toISOString().split('T')[0]

    // Billable, not-yet-sent breakfast logs
    let logsQuery = admin
      .from('breakfast_logs')
      .select('*')
      .eq('hotel_id', hotel_id)
      .eq('log_date', date)
      .eq('included', false)
      .gt('total_amount', 0)
      .neq('pms_status', 'sent')
    if (room_number) logsQuery = logsQuery.eq('room_number', room_number)
    const { data: logs, error: logsErr } = await logsQuery
    if (logsErr) throw logsErr

    if (!logs || logs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, failed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // PMS config
    const { data: config } = await admin
      .from('hotel_pms_configs')
      .select('credentials, property_id, base_url, pms_type, is_active')
      .eq('hotel_id', hotel_id)
      .eq('is_active', true)
      .in('pms_type', ['apaleo', 'mews'])
      .maybeSingle()

    if (!config) {
      return new Response(
        JSON.stringify({ error: 'Aucune configuration PMS active (Apaleo/Mews) pour cet hôtel', sent: 0, failed: 0 }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const creds = (config.credentials || {}) as PmsCredentials
    const { data: cfg } = await admin
      .from('hotel_breakfast_configs').select('currency').eq('hotel_id', hotel_id).maybeSingle()
    const currency = cfg?.currency || 'EUR'

    let sent = 0
    let failed = 0

    if (config.pms_type === 'apaleo') {
      const propertyId = creds.propertyId || config.property_id
      if (!propertyId) throw new Error('Property ID Apaleo manquant')
      const token = await getApaleoToken(creds)
      const resMap = await buildApaleoReservationMap(token, propertyId)

      for (const log of logs) {
        try {
          const key = String(log.room_number).trim().toLowerCase()
          const reservationId = resMap.get(key)
          if (!reservationId) throw new Error(`Aucune réservation en cours pour la chambre ${log.room_number}`)

          const items = Array.isArray(log.items) ? log.items : []
          if (items.length > 0) {
            for (const it of items) {
              if (!it || Number(it.qty) <= 0) continue
              await postApaleoCharge(
                token,
                reservationId,
                `Petit-déjeuner ${it.name}`,
                Number(it.price),
                currency,
                Number(it.qty),
              )
            }
          } else {
            await postApaleoCharge(
              token,
              reservationId,
              `Petit-déjeuner${log.breakfast_type ? ' ' + log.breakfast_type : ''} (${log.people_count} pers.)`,
              Number(log.total_amount),
              currency,
              1,
            )
          }
          await admin.from('breakfast_logs').update({ pms_status: 'sent' }).eq('id', log.id)
          sent++
        } catch (e) {
          console.error('apaleo charge error', log.room_number, e)
          await admin.from('breakfast_logs').update({ pms_status: 'error' }).eq('id', log.id)
          failed++
        }
      }
    } else {
      // Mews: charge posting requires a dedicated service mapping; flag for now.
      for (const log of logs) {
        await admin.from('breakfast_logs').update({ pms_status: 'error' }).eq('id', log.id)
        failed++
      }
      return new Response(
        JSON.stringify({
          sent: 0,
          failed,
          error: "L'envoi automatique vers Mews n'est pas encore activé pour cet hôtel.",
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(JSON.stringify({ sent, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('breakfast-pms-sync error', e)
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e), sent: 0, failed: 0 }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
