import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

interface PmsCredentials {
  clientId?: string
  clientSecret?: string
  propertyId?: string
  clientToken?: string
  accessToken?: string
  refreshToken?: string
  baseUrl?: string
}

// Contexte de persistance pour stocker un refresh token Apaleo renouvelé.
interface ApaleoPersistCtx {
  admin: ReturnType<typeof createClient>
  hotelId: string
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
// Cache de token Apaleo (par clientId). Les tokens durent ~1h. On les
// réutilise pour éviter de marteler le endpoint `connect/token` (sinon
// Apaleo renvoie 400 invalid_client par throttling quand plusieurs hôtels
// partagent le même client, ou quand on appelle plusieurs fois par requête).
const apaleoTokenCache = new Map<string, { token: string; expiresAt: number }>()

async function getApaleoToken(creds: PmsCredentials, persist?: ApaleoPersistCtx): Promise<string> {
  const clientId = (creds.clientId || '').trim()
  const clientSecret = (creds.clientSecret || '').trim()
  const refreshToken = (creds.refreshToken || '').trim()
  if (!clientId || !clientSecret) throw new Error('Identifiants Apaleo manquants')

  const cacheKey = refreshToken ? `${clientId}:rt` : clientId
  const cached = apaleoTokenCache.get(cacheKey)
  if (cached && cached.expiresAt - 60_000 > Date.now()) {
    return cached.token
  }

  // Deux modes d'authentification Apaleo :
  // - Authorization Code (app interactive) : on dispose d'un refresh token,
  //   on l'échange contre un access token (grant_type=refresh_token).
  // - Client Credentials (app serveur-à-serveur) : on utilise client_id/secret.
  const buildBody = () =>
    refreshToken
      ? new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        })
      : new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        })

  const requestToken = async () => {
    return await fetch('https://identity.apaleo.com/connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: buildBody(),
    })
  }

  let res = await requestToken()
  // Tolérance au throttling : une seconde tentative après un court délai.
  if (res.status === 400 || res.status === 429) {
    await new Promise((r) => setTimeout(r, 1200))
    res = await requestToken()
  }
  if (!res.ok) {
    const errBody = await res.text()
    const hint = refreshToken
      ? "le refresh token a peut-être expiré : reconnectez Apaleo (bouton « Connecter Apaleo »)"
      : "cette application Apaleo est de type « Authorization Code » : utilisez le bouton « Connecter Apaleo » au lieu du Client Secret seul"
    throw new Error(`Auth Apaleo échouée [${res.status}]: ${errBody || hint}`)
  }
  const data = await res.json()
  if (!data.access_token) throw new Error('Token Apaleo non reçu')
  const ttlMs = (Number(data.expires_in) || 3600) * 1000
  apaleoTokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + ttlMs })

  // Les refresh tokens Apaleo (offline_access) sont rotatifs : on persiste le
  // nouveau pour éviter qu'il devienne invalide au prochain appel.
  if (refreshToken && data.refresh_token && data.refresh_token !== refreshToken && persist) {
    try {
      const { data: cfg } = await persist.admin
        .from('hotel_pms_configs')
        .select('id, credentials')
        .eq('hotel_id', persist.hotelId)
        .eq('pms_type', 'apaleo')
        .maybeSingle()
      if (cfg?.id) {
        await persist.admin
          .from('hotel_pms_configs')
          .update({ credentials: { ...(cfg.credentials || {}), refreshToken: data.refresh_token } })
          .eq('id', cfg.id)
      }
    } catch (e) {
      console.error('[apaleo] persist refresh token failed:', e)
    }
  }
  return data.access_token
}


// Nom de l'unité (chambre) d'une réservation Apaleo.
function apaleoUnitName(r: any): string | null {
  const slices = r.timeSlices || []
  return slices.map((s: any) => s.unit?.name || s.unit?.id).find(Boolean) || null
}

// Une même chambre peut avoir PLUSIEURS réservations « InHouse » qui se
// chevauchent (ex. arrivée du jour + séjour en cours). Pour éviter de facturer
// ou d'afficher le mauvais client, on sélectionne UN occupant déterministe par
// chambre : on privilégie la réservation réellement présente cette nuit
// (arrivée ≤ aujourd'hui < départ), puis, à égalité, celle arrivée le plus tôt
// (l'occupant installé depuis le plus longtemps).
function apaleoResRank(r: any, today: string): [number, number] {
  const arr = (r.arrival || '').split('T')[0]
  const dep = (r.departure || '').split('T')[0]
  const inHouseNow = arr && dep && arr <= today && today < dep ? 1 : 0
  // Arrivée la plus tôt = meilleure ; on encode en négatif pour comparer "plus grand = mieux".
  const arrMs = arr ? Date.parse(arr) : Number.MAX_SAFE_INTEGER
  return [inHouseNow, -arrMs]
}

function apaleoBetter(a: [number, number], b: [number, number]): boolean {
  if (a[0] !== b[0]) return a[0] > b[0]
  return a[1] > b[1]
}

// Sélectionne une réservation par chambre (clé = nom d'unité en minuscules).
function selectApaleoReservationsByUnit(reservations: any[], today: string): Map<string, any> {
  const map = new Map<string, any>()
  for (const r of reservations) {
    const name = apaleoUnitName(r)
    if (!name) continue
    const key = String(name).trim().toLowerCase()
    const existing = map.get(key)
    if (!existing || apaleoBetter(apaleoResRank(r, today), apaleoResRank(existing, today))) {
      map.set(key, r)
    }
  }
  return map
}

async function buildApaleoReservationMap(token: string, propertyId: string): Promise<Map<string, string>> {
  const res = await fetch(
    `https://api.apaleo.com/booking/v1/reservations?propertyId=${propertyId}&status=InHouse&pageSize=200&expand=timeSlices`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  )
  if (!res.ok) throw new Error(`Récupération réservations Apaleo échouée [${res.status}]`)
  const data = await res.json()
  const today = new Date().toISOString().split('T')[0]
  const selected = selectApaleoReservationsByUnit(data.reservations || [], today)
  const map = new Map<string, string>()
  for (const [key, r] of selected) map.set(key, r.id)
  return map
}

async function postApaleoCharge(
  token: string, reservationId: string, name: string, amount: number, currency: string, quantity: number,
): Promise<void> {
  // IMPORTANT : le filtre Apaleo est `reservationIds` (pluriel). Avec
  // `reservationId` (singulier), Apaleo IGNORE le filtre et renvoie TOUS les
  // folios — on facturait alors la mauvaise réservation (404/charge erronée).
  const folioRes = await fetch(
    `https://api.apaleo.com/finance/v1/folios?reservationIds=${encodeURIComponent(reservationId)}&pageSize=50`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  )
  if (!folioRes.ok) throw new Error(`Folio Apaleo introuvable [${folioRes.status}]`)
  const folioData = await folioRes.json()
  const folios = (folioData.folios || []) as Array<{ id: string; isMainFolio?: boolean; status?: string; balance?: { currency?: string } }>
  // Préférer le folio principal ouvert de la réservation.
  const folio = folios.find((f) => f.isMainFolio && f.status === 'Open')
    || folios.find((f) => f.status === 'Open')
    || folios[0]
  const folioId = folio?.id
  if (!folioId) throw new Error('Aucun folio ouvert pour la réservation')

  // Utiliser la devise réelle du folio si disponible (évite un refus pour
  // incompatibilité de devise, ex. folio en GBP vs config en EUR).
  const folioCurrency = folio?.balance?.currency || currency

  // Endpoint correct = `finance/v1/folio-actions/{folioId}/charges` (l'ancien
  // `folios/{id}/charges` renvoie 404). `vatType` est requis AU NIVEAU RACINE
  // de la charge (pas dans `amount`), sinon Apaleo renvoie 422.
  const chargeRes = await fetch(`https://api.apaleo.com/finance/v1/folio-actions/${folioId}/charges`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceType: 'FoodAndBeverages',
      name,
      quantity,
      vatType: 'Normal',
      amount: { amount, currency: folioCurrency },
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

interface PmsRoom {
  room_number: string
  occupied: boolean
  breakfast_included: boolean
  guest_name: string | null
  status: string | null
  check_in: string | null
  check_out: string | null
  comment: string | null
}

const BREAKFAST_RE = /breakfast|petit.?d[eé]j|petit.?dej|p\.?d\.?j|déjeuner|dejeuner|\bb&b\b|\bbb\b|bed.*breakfast/i

// Build the room occupancy + breakfast-inclusion list for in-house guests today (Mews).
async function fetchMewsRooms(creds: PmsCredentials): Promise<PmsRoom[]> {
  const baseUrl = creds.baseUrl || 'https://api.mews.com/api/connector/v1'
  const auth = mewsAuth(creds)
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const res = await mewsFetch(`${baseUrl}/reservations/getAll`, {
    ...auth,
    StartUtc: `${today}T00:00:00Z`,
    EndUtc: `${tomorrow}T23:59:59Z`,
    TimeFilter: 'Colliding',
    Extent: { Reservations: true, Customers: true, Resources: true, Items: true },
    States: ['Started', 'Confirmed', 'Processed'],
  })
  if (!res.ok) throw new Error(`Mews reservations/getAll [${res.status}]: ${await res.text()}`)
  const data = await res.json()

  const resourceName: Record<string, string> = {}
  for (const r of data.Resources || []) resourceName[r.Id] = r.Name || r.Id

  const customerName: Record<string, string> = {}
  for (const c of data.Customers || []) {
    customerName[c.Id] = `${c.LastName || ''} ${c.FirstName || ''}`.trim()
  }

  // Accounts that already have a breakfast product/charge.
  const breakfastAccounts = new Set<string>()
  for (const it of data.Items || []) {
    if (it.AccountId && BREAKFAST_RE.test(String(it.Name || ''))) breakfastAccounts.add(it.AccountId)
  }

  const rooms: PmsRoom[] = []
  for (const r of data.Reservations || []) {
    const rid = r.AssignedResourceId || r.AssignedSpaceId
    const name = rid ? resourceName[rid] : undefined
    if (!name) continue
    const account = r.CustomerId || r.OwnerId || r.AccountId
    const checkIn = r.StartUtc?.split('T')[0] || null
    const checkOut = r.EndUtc?.split('T')[0] || null
    let status = 'inhouse'
    if (checkOut === today) status = 'departure'
    else if (checkIn === today) status = 'arrival'
    const comment = [r.Notes, r.ChannelManagerNumber ? null : null]
      .filter(Boolean).join(' ').trim() || null
    rooms.push({
      room_number: String(name).trim(),
      occupied: true,
      breakfast_included: account ? breakfastAccounts.has(account) : false,
      guest_name: account ? (customerName[account] || null) : null,
      status,
      check_in: checkIn,
      check_out: checkOut,
      comment,
    })
  }
  return rooms
}

// Apaleo rooms with breakfast inclusion detected from reservation services
// and/or the rate plans flagged "breakfast included" by the admin.
async function fetchApaleoRooms(
  token: string,
  propertyId: string,
  includedRatePlanIds: Set<string> = new Set(),
): Promise<PmsRoom[]> {
  const res = await fetch(
    `https://api.apaleo.com/booking/v1/reservations?propertyId=${propertyId}&status=InHouse&pageSize=200&expand=timeSlices,services,booker,ratePlan`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  )
  if (!res.ok) throw new Error(`Récupération réservations Apaleo échouée [${res.status}]`)
  const data = await res.json()
  const today = new Date().toISOString().split('T')[0]
  // Dédoublonne par chambre : un seul occupant (le même que celui facturé).
  const selected = selectApaleoReservationsByUnit(data.reservations || [], today)
  const rooms: PmsRoom[] = []
  for (const [, r] of selected) {
    const unitName = apaleoUnitName(r)
    if (!unitName) continue
    const services = r.services || []
    const byService = services.some((s: any) => BREAKFAST_RE.test(String(s.service?.name || s.name || '')))
    // Inclusion par plan tarifaire choisi par l'admin (id ou code).
    const rpId = String(r.ratePlan?.id || r.ratePlanId || '').trim().toLowerCase()
    const rpCode = String(r.ratePlan?.code || '').trim().toLowerCase()
    const byRatePlan = (rpId && includedRatePlanIds.has(rpId)) || (rpCode && includedRatePlanIds.has(rpCode))
    const guest = `${r.primaryGuest?.lastName || ''} ${r.primaryGuest?.firstName || ''}`.trim()
    const checkIn = r.arrival?.split('T')[0] || null
    const checkOut = r.departure?.split('T')[0] || null
    rooms.push({
      room_number: String(unitName).trim(),
      occupied: true,
      breakfast_included: byService || byRatePlan,
      guest_name: guest || null,
      status: 'inhouse',
      check_in: checkIn,
      check_out: checkOut,
      comment: r.comment || null,
    })
  }
  return rooms
}

interface PmsRatePlan { id: string; code: string | null; name: string }

// Tous les plans tarifaires Apaleo de l'établissement.
async function fetchApaleoRatePlans(token: string, propertyId: string): Promise<PmsRatePlan[]> {
  const res = await fetch(
    `https://api.apaleo.com/rateplan/v1/rate-plans?propertyId=${propertyId}&pageSize=200`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  )
  if (!res.ok) throw new Error(`Récupération plans tarifaires Apaleo échouée [${res.status}]`)
  const data = await res.json()
  return (data.ratePlans || []).map((rp: any) => ({
    id: String(rp.id),
    code: rp.code ? String(rp.code) : null,
    name: String(rp.name || rp.code || rp.id),
  }))
}

// Guests (room + name + stay dates) for the Lost & Found feature: includes
// in-house guests AND those who already checked out over a recent window.
interface PmsRoomGuest {
  room_number: string
  guest_name: string | null
  check_in: string | null
  check_out: string | null
  status: string // 'inhouse' | 'arrival' | 'departure' | 'checked_out'
}

async function fetchMewsRoomGuests(creds: PmsCredentials, daysBack = 30): Promise<PmsRoomGuest[]> {
  const baseUrl = creds.baseUrl || 'https://api.mews.com/api/connector/v1'
  const auth = mewsAuth(creds)
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const start = new Date(Date.now() - daysBack * 86400000).toISOString().split('T')[0]

  const res = await mewsFetch(`${baseUrl}/reservations/getAll`, {
    ...auth,
    StartUtc: `${start}T00:00:00Z`,
    EndUtc: `${tomorrow}T23:59:59Z`,
    TimeFilter: 'Colliding',
    Extent: { Reservations: true, Customers: true, Resources: true },
    // Started = in-house, Processed = checked out, Confirmed = upcoming/arrival
    States: ['Started', 'Processed', 'Confirmed'],
  })
  if (!res.ok) throw new Error(`Mews reservations/getAll [${res.status}]: ${await res.text()}`)
  const data = await res.json()

  const resourceName: Record<string, string> = {}
  for (const r of data.Resources || []) resourceName[r.Id] = r.Name || r.Id
  const customerName: Record<string, string> = {}
  for (const c of data.Customers || []) {
    customerName[c.Id] = `${c.LastName || ''} ${c.FirstName || ''}`.trim()
  }

  const guests: PmsRoomGuest[] = []
  for (const r of data.Reservations || []) {
    const rid = r.AssignedResourceId || r.AssignedSpaceId
    const name = rid ? resourceName[rid] : undefined
    if (!name) continue
    const account = r.CustomerId || r.OwnerId || r.AccountId
    const checkIn = r.StartUtc?.split('T')[0] || null
    const checkOut = r.EndUtc?.split('T')[0] || null
    const state = String(r.State || '')
    let status = 'inhouse'
    if (state === 'Processed' || (checkOut && checkOut < today)) status = 'checked_out'
    else if (checkOut === today) status = 'departure'
    else if (checkIn === today) status = 'arrival'
    guests.push({
      room_number: String(name).trim(),
      guest_name: account ? (customerName[account] || null) : null,
      check_in: checkIn,
      check_out: checkOut,
      status,
    })
  }
  return guests
}

async function fetchApaleoRoomGuests(token: string, propertyId: string): Promise<PmsRoomGuest[]> {
  const today = new Date().toISOString().split('T')[0]
  const res = await fetch(
    `https://api.apaleo.com/booking/v1/reservations?propertyId=${propertyId}&status=InHouse&status=CheckedOut&pageSize=200&expand=timeSlices,booker`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  )
  if (!res.ok) throw new Error(`Récupération réservations Apaleo échouée [${res.status}]`)
  const data = await res.json()
  const guests: PmsRoomGuest[] = []
  for (const r of data.reservations || []) {
    const slices = r.timeSlices || []
    const unitName = slices.map((s: any) => s.unit?.name || s.unit?.id).find(Boolean)
    if (!unitName) continue
    const guest = `${r.primaryGuest?.lastName || ''} ${r.primaryGuest?.firstName || ''}`.trim()
    const checkIn = r.arrival?.split('T')[0] || null
    const checkOut = r.departure?.split('T')[0] || null
    let status = 'inhouse'
    if (String(r.status) === 'CheckedOut' || (checkOut && checkOut < today)) status = 'checked_out'
    else if (checkOut === today) status = 'departure'
    else if (checkIn === today) status = 'arrival'
    guests.push({
      room_number: String(unitName).trim(),
      guest_name: guest || null,
      check_in: checkIn,
      check_out: checkOut,
      status,
    })
  }
  return guests
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
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  // Authorized if: service role key, valid anon key (staff cafétière authenticate
  // via local access codes, not a Supabase session), or a valid logged-in user.
  let authorized = authHeader.includes(serviceKey) || bearer === anonKey
  if (!authorized && bearer) {
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

    // PMS config — on récupère toute config Apaleo/Mews (active ou non) pour
    // pouvoir distinguer « aucune config » de « config désactivée ».
    const { data: anyConfig } = await admin
      .from('hotel_pms_configs')
      .select('credentials, property_id, base_url, pms_type, is_active')
      .eq('hotel_id', hotel_id)
      .in('pms_type', ['apaleo', 'mews'])
      .order('is_active', { ascending: false })
      .limit(1)
      .maybeSingle()

    const config = anyConfig && anyConfig.is_active ? anyConfig : null
    // Message précis selon la cause de l'absence de config exploitable.
    const noConfigMessage = !anyConfig
      ? 'Aucune configuration PMS (Apaleo/Mews) pour cet hôtel. Configurez-la dans Configuration PMS.'
      : 'La configuration PMS de cet hôtel est désactivée. Activez-la dans Configuration PMS.'

    const { data: bfCfg } = await admin
      .from('hotel_breakfast_configs')
      .select('currency, pms_service_id, pms_tax_code, included_rate_plan_ids')
      .eq('hotel_id', hotel_id)
      .maybeSingle()
    const currency = bfCfg?.currency || 'EUR'
    // Plans tarifaires (rate plans) du PMS marqués « petit-déjeuner inclus » par l'admin.
    const includedRatePlanIds = new Set<string>(
      ((bfCfg?.included_rate_plan_ids as string[] | null) || [])
        .map((v) => String(v).trim().toLowerCase())
        .filter(Boolean),
    )

    // ─── FETCH PRODUCTS / PRESTATIONS MODE ────────────────────────
    // Returns the breakfast prestations directly from the PMS (single config),
    // so the establishment doesn't re-type them manually.
    if (mode === 'fetch_products') {
      if (!config) {
        return new Response(JSON.stringify({
          ok: false, message: noConfigMessage,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const creds = { ...(config.credentials || {}), baseUrl: config.base_url || (config.credentials as PmsCredentials)?.baseUrl } as PmsCredentials
      if (config.pms_type === 'mews') {
        const services = await fetchMewsServices(creds)
        const serviceId = bfCfg?.pms_service_id || pickOrderableService(services)?.id || null
        if (!serviceId) {
          return new Response(JSON.stringify({ ok: false, message: 'Aucun service Mews facturable trouvé.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        const products = await fetchMewsProducts(creds, serviceId)
        return new Response(JSON.stringify({ ok: true, pms: 'mews', service_id: serviceId, products }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      } else {
        const propertyId = creds.propertyId || config.property_id
        const token = await getApaleoToken(creds, { admin, hotelId: hotel_id })
        const products = await fetchApaleoProducts(token, propertyId!)
        return new Response(JSON.stringify({ ok: true, pms: 'apaleo', service_id: null, products }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // ─── FETCH ROOMS MODE ─────────────────────────────────────────
    // Returns the in-house rooms today with their breakfast-inclusion status
    // detected directly from the PMS reservations.
    if (mode === 'fetch_rooms') {
      if (!config) {
        return new Response(JSON.stringify({
          ok: false, message: noConfigMessage, rooms: [],
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const creds = { ...(config.credentials || {}), baseUrl: config.base_url || (config.credentials as PmsCredentials)?.baseUrl } as PmsCredentials
      if (config.pms_type === 'mews') {
        const rooms = await fetchMewsRooms(creds, includedRatePlanIds)
        return new Response(JSON.stringify({ ok: true, pms: 'mews', rooms }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      } else {
        const propertyId = creds.propertyId || config.property_id
        const token = await getApaleoToken(creds, { admin, hotelId: hotel_id })
        const rooms = await fetchApaleoRooms(token, propertyId!, includedRatePlanIds)
        return new Response(JSON.stringify({ ok: true, pms: 'apaleo', rooms }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // ─── FETCH RATE PLANS MODE ────────────────────────────────────
    // Renvoie tous les plans tarifaires du PMS pour que l'admin coche ceux
    // qui incluent le petit-déjeuner.
    if (mode === 'fetch_rate_plans') {
      if (!config) {
        return new Response(JSON.stringify({
          ok: false, message: noConfigMessage, rate_plans: [],
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const creds = { ...(config.credentials || {}), baseUrl: config.base_url || (config.credentials as PmsCredentials)?.baseUrl } as PmsCredentials
      if (config.pms_type === 'mews') {
        const ratePlans = await fetchMewsRatePlans(creds)
        return new Response(JSON.stringify({ ok: true, pms: 'mews', rate_plans: ratePlans }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      } else {
        const propertyId = creds.propertyId || config.property_id
        const token = await getApaleoToken(creds, { admin, hotelId: hotel_id })
        const ratePlans = await fetchApaleoRatePlans(token, propertyId!)
        return new Response(JSON.stringify({ ok: true, pms: 'apaleo', rate_plans: ratePlans }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // ─── FETCH ROOM GUESTS MODE (Objets trouvés) ──────────────────
    // Returns guests with their stay dates for in-house AND recently
    // checked-out reservations, used to suggest the guest who lost an item.
    if (mode === 'fetch_room_guests') {
      if (!config) {
        return new Response(JSON.stringify({
          ok: false, message: noConfigMessage, guests: [],
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const creds = { ...(config.credentials || {}), baseUrl: config.base_url || (config.credentials as PmsCredentials)?.baseUrl } as PmsCredentials
      if (config.pms_type === 'mews') {
        const guests = await fetchMewsRoomGuests(creds)
        return new Response(JSON.stringify({ ok: true, pms: 'mews', guests }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      } else {
        const propertyId = creds.propertyId || config.property_id
        const token = await getApaleoToken(creds, { admin, hotelId: hotel_id })
        const guests = await fetchApaleoRoomGuests(token, propertyId!)
        return new Response(JSON.stringify({ ok: true, pms: 'apaleo', guests }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }





    // ─── TEST / DIAGNOSTIC MODE ───────────────────────────────────

    if (mode === 'test') {
      if (!config) {
        return new Response(JSON.stringify({
          ok: false, pms: null, message: noConfigMessage,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const creds = { ...(config.credentials || {}), baseUrl: config.base_url || (config.credentials as PmsCredentials)?.baseUrl } as PmsCredentials

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
        const token = await getApaleoToken(creds, { admin, hotelId: hotel_id })
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

    // ─── INSPECT ROOM MODE (diagnostic Apaleo) ────────────────────
    // Retourne la réservation, les folios et leurs charges pour une chambre,
    // afin de vérifier si la prestation a réellement atterri côté PMS.
    if (mode === 'inspect_room') {
      if (!config) {
        return new Response(JSON.stringify({ ok: false, message: noConfigMessage }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (config.pms_type !== 'apaleo') {
        return new Response(JSON.stringify({ ok: false, message: 'inspect_room: Apaleo uniquement' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const creds = { ...(config.credentials || {}), baseUrl: config.base_url || (config.credentials as PmsCredentials)?.baseUrl } as PmsCredentials
      const propertyId = creds.propertyId || config.property_id
      const token = await getApaleoToken(creds, { admin, hotelId: hotel_id })
      const resMap = await buildApaleoReservationMap(token, propertyId!)
      const key = String(room_number || '').trim().toLowerCase()
      const reservationId = resMap.get(key)
      if (!reservationId) {
        return new Response(JSON.stringify({ ok: false, message: `Aucune réservation pour ${room_number}`, known_rooms: [...resMap.keys()] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const folioRes = await fetch(
        `https://api.apaleo.com/finance/v1/folios?reservationIds=${encodeURIComponent(reservationId)}&pageSize=50`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
      )
      const folioData = folioRes.ok ? await folioRes.json() : { folios: [] }
      const folios = (folioData.folios || []) as any[]
      const detailed: any[] = []
      for (const f of folios) {
        // Le détail des charges est dans le folio lui-même (expand=charges).
        const cRes = await fetch(`https://api.apaleo.com/finance/v1/folios/${f.id}?expand=charges`,
          { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
        const cStatus = cRes.status
        const cData = cRes.ok ? await cRes.json() : {}
        detailed.push({
          id: f.id, isMainFolio: f.isMainFolio, status: f.status,
          currency: f.balance?.currency,
          detail_status: cStatus,
          charges: (cData.charges || []).map((c: any) => ({ name: c.name, amount: c.amount, quantity: c.quantity, serviceType: c.serviceType })),
        })
      }

      return new Response(JSON.stringify({ ok: true, room_number, reservationId, folios: detailed }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ─── POST MODE ────────────────────────────────────────────────
    // On envoie au PMS les prestations facturées qui n'ont pas encore été
    // transmises. La cafetière peut ajouter de nouvelles prestations à tout
    // moment : on n'envoie QUE le delta (différence entre les prestations
    // déclarées et celles déjà envoyées, mémorisées dans `sent_items`).
    let logsQuery = admin
      .from('breakfast_logs')
      .select('*')
      .eq('hotel_id', hotel_id)
      .eq('log_date', date)
      .eq('included', false)
      .gt('total_amount', 0)
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
        JSON.stringify({ error: noConfigMessage, sent: 0, failed: 0 }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const creds = { ...(config.credentials || {}), baseUrl: config.base_url || (config.credentials as PmsCredentials)?.baseUrl } as PmsCredentials
    let sent = 0
    let failed = 0

    const itemsOf = (log: any): BreakfastItem[] => {
      const items = Array.isArray(log.items) ? log.items : []
      if (items.length > 0) {
        return items
          .filter((i: any) => i && Number(i.qty) > 0)
          .map((i: any) => ({
            name: i.name || '',
            qty: Number(i.qty),
            price: Number(i.price),
            productId: i.pms_product_id ?? i.productId ?? null,
            taxCode: i.pms_tax_code ?? i.taxCode ?? null,
          }))
      }
      return [{
        name: log.breakfast_type || '',
        qty: Number(log.people_count) || 1,
        price: Number(log.unit_price) || Number(log.total_amount),
      }]
    }

    // Calcule le delta : prestations déclarées non encore envoyées au PMS.
    // `sent_items` mémorise les quantités déjà facturées par prestation.
    const deltaItemsOf = (log: any): BreakfastItem[] => {
      const current = itemsOf(log)
      const sent = Array.isArray(log.sent_items) ? log.sent_items : []
      const sentMap: Record<string, number> = {}
      for (const s of sent) {
        const key = String(s?.name ?? '')
        sentMap[key] = (sentMap[key] || 0) + Number(s?.qty || 0)
      }
      return current
        .map((it) => ({ ...it, qty: it.qty - (sentMap[it.name] || 0) }))
        .filter((it) => it.qty > 0)
    }



    if (config.pms_type === 'apaleo') {
      const propertyId = creds.propertyId || config.property_id
      if (!propertyId) throw new Error('Property ID Apaleo manquant')
      const token = await getApaleoToken(creds, { admin, hotelId: hotel_id })
      const resMap = await buildApaleoReservationMap(token, propertyId)

      for (const log of logs) {
        const delta = deltaItemsOf(log)
        if (delta.length === 0) continue // Rien de nouveau à facturer.
        try {
          const reservationId = resMap.get(String(log.room_number).trim().toLowerCase())
          if (!reservationId) throw new Error(`Aucune réservation en cours pour la chambre ${log.room_number}`)
          for (const it of delta) {
            await postApaleoCharge(token, reservationId, `Petit-déjeuner ${it.name}`.trim(), Number(it.price), currency, Number(it.qty))
          }
          await admin.from('breakfast_logs')
            .update({ pms_status: 'sent', sent_items: itemsOf(log) as unknown as never })
            .eq('id', log.id)
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
        const delta = deltaItemsOf(log)
        if (delta.length === 0) continue // Rien de nouveau à facturer.
        try {
          const match = map.get(String(log.room_number).trim().toLowerCase())
          if (!match) throw new Error(`Aucune réservation en cours pour la chambre ${log.room_number}`)
          await postMewsOrder(creds, serviceId, match.customerId, match.reservationId, delta, currency, bfCfg?.pms_tax_code || null)
          await admin.from('breakfast_logs')
            .update({ pms_status: 'sent', sent_items: itemsOf(log) as unknown as never })
            .eq('id', log.id)
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
