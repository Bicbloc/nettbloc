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

interface BreakfastItem {
  name: string
  qty: number
  price: number
  productId?: string | null
  taxCode?: string | null
}

interface PmsProduct {
  id: string
  name: string
  price: number
  currency: string | null
  taxCode: string | null
}

// ─── Apaleo ────────────────────────────────────────────────────────
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
  token: string, reservationId: string, name: string, amount: number, currency: string, quantity: number,
): Promise<void> {
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

// ─── Mews ──────────────────────────────────────────────────────────
function mewsAuth(creds: PmsCredentials) {
  return {
    ClientToken: creds.clientToken,
    AccessToken: creds.accessToken,
    Client: 'NettoBloc 1.0',
  }
}

async function mewsFetch(url: string, body: unknown, attempt = 0): Promise<Response> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.status === 429 && attempt < 4) {
    const retryAfter = Number(res.headers.get('Retry-After'))
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(1000 * 2 ** attempt, 8000)
    await res.text().catch(() => {})
    await new Promise((r) => setTimeout(r, waitMs))
    return mewsFetch(url, body, attempt + 1)
  }
  return res
}

interface MewsReservationMatch {
  reservationId: string
  customerId: string
}

// Map room name (lowercased) -> reservation/customer for guests in-house today.
async function buildMewsReservationMap(
  creds: PmsCredentials,
): Promise<{ map: Map<string, MewsReservationMatch>; reservations: number; resources: number }> {
  const baseUrl = creds.baseUrl || 'https://api.mews.com/api/connector/v1'
  const auth = mewsAuth(creds)

  // Resources: resource id -> name
  const resourcesRes = await mewsFetch(`${baseUrl}/resources/getAll`, {
    ...auth,
    Extent: { Resources: true },
  })
  if (!resourcesRes.ok) {
    throw new Error(`Mews resources/getAll [${resourcesRes.status}]: ${await resourcesRes.text()}`)
  }
  const resourcesData = await resourcesRes.json()
  const resources = resourcesData.Resources || []
  const resourceName: Record<string, string> = {}
  for (const r of resources) resourceName[r.Id] = r.Name || r.Id

  // Reservations colliding today
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const reservationsRes = await mewsFetch(`${baseUrl}/reservations/getAll`, {
    ...auth,
    StartUtc: `${today}T00:00:00Z`,
    EndUtc: `${tomorrow}T23:59:59Z`,
    TimeFilter: 'Colliding',
    Extent: { Reservations: true, Customers: true },
    States: ['Started', 'Confirmed', 'Processed'],
  })
  let reservations: any[] = []
  if (reservationsRes.ok) {
    const d = await reservationsRes.json()
    reservations = d.Reservations || []
  } else {
    throw new Error(`Mews reservations/getAll [${reservationsRes.status}]: ${await reservationsRes.text()}`)
  }

  const map = new Map<string, MewsReservationMatch>()
  for (const r of reservations) {
    const rid = r.AssignedResourceId || r.AssignedSpaceId
    const name = rid ? resourceName[rid] : undefined
    const customerId = r.CustomerId || r.AccountId
    if (name && customerId) {
      map.set(String(name).trim().toLowerCase(), { reservationId: r.Id, customerId })
    }
  }
  return { map, reservations: reservations.length, resources: resources.length }
}

interface MewsService { id: string; name: string; type: string; active: boolean }

async function fetchMewsServices(creds: PmsCredentials): Promise<MewsService[]> {
  const baseUrl = creds.baseUrl || 'https://api.mews.com/api/connector/v1'
  const res = await mewsFetch(`${baseUrl}/services/getAll`, { ...mewsAuth(creds) })
  if (!res.ok) return []
  const data = await res.json()
  const pickName = (names: Record<string, string> | undefined, fallback?: string) =>
    (names && (names['fr-FR'] || names['en-US'] || Object.values(names)[0])) || fallback || ''
  return (data.Services || []).map((s: any) => ({
    id: s.Id, name: pickName(s.Names, s.Name), type: s.Type, active: s.IsActive !== false,
  }))
}

// A breakfast charge must target an active "Orderable" service.
function pickOrderableService(services: MewsService[]): MewsService | undefined {
  const orderable = services.filter((s) => s.active && s.type === 'Orderable')
  return (
    orderable.find((s) => /breakfast|petit|pdj|déjeuner|dejeuner|f&b|food/i.test(s.name)) ||
    orderable[0]
  )
}

// Fetch the products (prestations) of a Mews service — these are the breakfast formulas.
async function fetchMewsProducts(creds: PmsCredentials, serviceId: string): Promise<PmsProduct[]> {
  const baseUrl = creds.baseUrl || 'https://api.mews.com/api/connector/v1'
  const res = await mewsFetch(`${baseUrl}/products/getAll`, { ...mewsAuth(creds), ServiceIds: [serviceId] })
  if (!res.ok) return []
  const data = await res.json()
  const pickName = (names: Record<string, string> | undefined, fallback?: string) =>
    (names && (names['fr-FR'] || names['en-US'] || Object.values(names)[0])) || fallback || ''
  return (data.Products || [])
    .filter((p: any) => p.IsActive !== false)
    .map((p: any) => ({
      id: p.Id,
      name: pickName(p.Names, p.ShortNames ? pickName(p.ShortNames) : ''),
      price: Number(p.Price?.GrossValue ?? p.Price?.Value ?? 0),
      currency: p.Price?.Currency ?? null,
      taxCode: p.Price?.TaxValues?.[0]?.Code ?? p.Price?.TaxCodes?.[0] ?? null,
    }))
}

async function postMewsOrder(
  creds: PmsCredentials,
  serviceId: string,
  accountId: string,
  reservationId: string,
  items: BreakfastItem[],
  currency: string,
  taxCode: string | null,
): Promise<void> {
  const baseUrl = creds.baseUrl || 'https://api.mews.com/api/connector/v1'
  const body: Record<string, unknown> = {
    ...mewsAuth(creds),
    ServiceId: serviceId,
    AccountId: accountId,
    LinkedReservationId: reservationId,
    Items: items.map((it) => {
      const itemTax = it.taxCode || taxCode
      const base: Record<string, unknown> = {
        Name: `Petit-déjeuner ${it.name}`.trim(),
        UnitCount: it.qty,
        UnitAmount: {
          Currency: currency,
          GrossValue: Number(it.price),
          ...(itemTax ? { TaxCodes: [itemTax] } : {}),
        },
      }
      // When the item maps to a real Mews product, link it for correct reporting.
      if (it.productId) base.ProductId = it.productId
      return base
    }),
  }
  const res = await mewsFetch(`${baseUrl}/orders/add`, body)
  if (!res.ok) throw new Error(`Mews orders/add [${res.status}]: ${await res.text()}`)
}

// Fetch Apaleo services (prestations) with their default gross price.
async function fetchApaleoProducts(token: string, propertyId: string): Promise<PmsProduct[]> {
  const res = await fetch(
    `https://api.apaleo.com/rateplan/v1/services?propertyIds=${propertyId}&pageSize=200`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.services || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    price: Number(s.defaultGrossPrice?.amount ?? 0),
    currency: s.defaultGrossPrice?.currency ?? null,
    taxCode: null,
  }))
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

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
    const { hotel_id, log_date, room_number, mode } = await req.json()
    if (!hotel_id) {
      return new Response(JSON.stringify({ error: 'hotel_id requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const date = log_date || new Date().toISOString().split('T')[0]

    // PMS config
    const { data: config } = await admin
      .from('hotel_pms_configs')
      .select('credentials, property_id, base_url, pms_type, is_active')
      .eq('hotel_id', hotel_id)
      .eq('is_active', true)
      .in('pms_type', ['apaleo', 'mews'])
      .maybeSingle()

    const { data: bfCfg } = await admin
      .from('hotel_breakfast_configs')
      .select('currency, pms_service_id, pms_tax_code')
      .eq('hotel_id', hotel_id)
      .maybeSingle()
    const currency = bfCfg?.currency || 'EUR'

    // ─── TEST / DIAGNOSTIC MODE ───────────────────────────────────
    if (mode === 'test') {
      if (!config) {
        return new Response(JSON.stringify({
          ok: false, pms: null, message: 'Aucune configuration PMS active (Apaleo/Mews) pour cet hôtel.',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const creds = (config.credentials || {}) as PmsCredentials

      // Breakfast rooms to match
      const { data: logs } = await admin
        .from('breakfast_logs').select('room_number, total_amount, included')
        .eq('hotel_id', hotel_id).eq('log_date', date)
      const billableRooms = (logs || []).filter((l: any) => !l.included && Number(l.total_amount) > 0)
        .map((l: any) => String(l.room_number))

      if (config.pms_type === 'mews') {
        const { map, reservations, resources } = await buildMewsReservationMap(creds)
        const services = await fetchMewsServices(creds)
        const orderable = services.filter((s) => s.active && s.type === 'Orderable')
        const suggested = pickOrderableService(services)
        const matched = billableRooms.filter((r) => map.has(r.trim().toLowerCase()))
        const unmatched = billableRooms.filter((r) => !map.has(r.trim().toLowerCase()))
        return new Response(JSON.stringify({
          ok: true,
          pms: 'mews',
          connectivity: 'OK',
          resources,
          reservations_in_house: reservations,
          services: services.length,
          orderable_services: orderable.length,
          orderable_services_sample: orderable.slice(0, 15),
          suggested_service_id: suggested?.id || null,
          suggested_service_name: suggested?.name || null,
          service_id_configured: bfCfg?.pms_service_id || null,
          tax_code_configured: bfCfg?.pms_tax_code || null,
          billable_rooms: billableRooms.length,
          rooms_matched: matched,
          rooms_unmatched: unmatched,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      } else {
        const propertyId = creds.propertyId || config.property_id
        const token = await getApaleoToken(creds)
        const resMap = await buildApaleoReservationMap(token, propertyId!)
        const matched = billableRooms.filter((r) => resMap.has(r.trim().toLowerCase()))
        return new Response(JSON.stringify({
          ok: true, pms: 'apaleo', connectivity: 'OK',
          reservations_in_house: resMap.size,
          billable_rooms: billableRooms.length,
          rooms_matched: matched,
          rooms_unmatched: billableRooms.filter((r) => !resMap.has(r.trim().toLowerCase())),
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // ─── POST MODE ────────────────────────────────────────────────
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

    if (!config) {
      return new Response(
        JSON.stringify({ error: 'Aucune configuration PMS active (Apaleo/Mews) pour cet hôtel', sent: 0, failed: 0 }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const creds = (config.credentials || {}) as PmsCredentials
    let sent = 0
    let failed = 0

    const itemsOf = (log: any): BreakfastItem[] => {
      const items = Array.isArray(log.items) ? log.items : []
      if (items.length > 0) return items.filter((i: any) => i && Number(i.qty) > 0)
      return [{
        name: log.breakfast_type || '',
        qty: Number(log.people_count) || 1,
        price: Number(log.unit_price) || Number(log.total_amount),
      }]
    }

    if (config.pms_type === 'apaleo') {
      const propertyId = creds.propertyId || config.property_id
      if (!propertyId) throw new Error('Property ID Apaleo manquant')
      const token = await getApaleoToken(creds)
      const resMap = await buildApaleoReservationMap(token, propertyId)

      for (const log of logs) {
        try {
          const reservationId = resMap.get(String(log.room_number).trim().toLowerCase())
          if (!reservationId) throw new Error(`Aucune réservation en cours pour la chambre ${log.room_number}`)
          for (const it of itemsOf(log)) {
            await postApaleoCharge(token, reservationId, `Petit-déjeuner ${it.name}`.trim(), Number(it.price), currency, Number(it.qty))
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
      // Mews — use the configured service, or auto-pick an active "Orderable" one.
      let serviceId = bfCfg?.pms_service_id || null
      if (!serviceId) {
        const services = await fetchMewsServices(creds)
        serviceId = pickOrderableService(services)?.id || null
      }
      if (!serviceId) {
        return new Response(JSON.stringify({
          error: "Aucun service Mews facturable trouvé. Renseignez l'identifiant du service dans Petit-déjeuner → Facturation PMS.",
          sent: 0, failed: 0,
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const { map } = await buildMewsReservationMap(creds)
      for (const log of logs) {
        try {
          const match = map.get(String(log.room_number).trim().toLowerCase())
          if (!match) throw new Error(`Aucune réservation en cours pour la chambre ${log.room_number}`)
          await postMewsOrder(creds, serviceId, match.customerId, match.reservationId, itemsOf(log), currency, bfCfg?.pms_tax_code || null)
          await admin.from('breakfast_logs').update({ pms_status: 'sent' }).eq('id', log.id)
          sent++
        } catch (e) {
          console.error('mews order error', log.room_number, e)
          await admin.from('breakfast_logs').update({ pms_status: 'error' }).eq('id', log.id)
          failed++
        }
      }
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
