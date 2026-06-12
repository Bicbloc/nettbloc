// ─────────────────────────────────────────────────────────────────
// MisterBooking PMS — helpers partagés
//
// MisterBooking utilise des identifiants PARTENAIRE GLOBAUX (login + mot de
// passe partagé) via l'en-tête WSSE, plus une clé secrète HMAC pour signer le
// corps des requêtes. Ces trois valeurs sont stockées en SECRETS (variables
// d'environnement), PAS dans `hotel_pms_configs`. Seul l'identifiant
// d'établissement MisterBooking (`hotelId` entier) est propre à chaque hôtel,
// stocké dans `hotel_pms_configs.property_id` / `credentials.propertyId`.
// ─────────────────────────────────────────────────────────────────

export const MB_BASE_URL = 'https://api.misterbooking.com/misterbooking';

export function mbConfigured(): boolean {
  return !!(
    Deno.env.get('MISTERBOOKING_WSSE_LOGIN') &&
    Deno.env.get('MISTERBOOKING_WSSE_PASSWORD')
  );
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Génère l'en-tête X-Wsse (usage unique, régénéré à chaque requête).
// Référence PHP : digest = base64(sha1(nonceRaw + timestamp + password)).
async function buildWsseHeader(): Promise<string> {
  const login = (Deno.env.get('MISTERBOOKING_WSSE_LOGIN') || '').trim();
  const password = (Deno.env.get('MISTERBOOKING_WSSE_PASSWORD') || '').trim();
  if (!login || !password) {
    throw new Error('Identifiants WSSE MisterBooking manquants (secrets).');
  }

  // Nonce = 16 octets aléatoires bruts.
  const nonceRaw = new Uint8Array(16);
  crypto.getRandomValues(nonceRaw);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  // digest = base64( sha1( nonceRaw || timestamp || password ) )
  const enc = new TextEncoder();
  const tsBytes = enc.encode(timestamp);
  const pwBytes = enc.encode(password);
  const message = new Uint8Array(nonceRaw.length + tsBytes.length + pwBytes.length);
  message.set(nonceRaw, 0);
  message.set(tsBytes, nonceRaw.length);
  message.set(pwBytes, nonceRaw.length + tsBytes.length);

  const sha1 = new Uint8Array(await crypto.subtle.digest('SHA-1', message));
  const digest = toBase64(sha1);
  const nonceB64 = toBase64(nonceRaw);

  return `AuthToken Login="${login}", PasswordDigest="${digest}", Nonce="${nonceB64}", Created="${timestamp}"`;
}

// Signature HMAC-SHA256 (hex minuscule) du corps brut, avec la clé secrète.
export async function mbSignBody(rawBody: string): Promise<string | null> {
  const secret = Deno.env.get('MISTERBOOKING_HMAC_SECRET');
  if (!secret) return null;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(rawBody)));
  return toHex(sig);
}

// Vérifie une signature HMAC entrante (webhook) en temps constant.
export async function mbVerifySignature(rawBody: string, received: string | null): Promise<boolean> {
  if (!received) return false;
  const expected = await mbSignBody(rawBody);
  if (!expected) return false;
  if (expected.length !== received.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  return diff === 0;
}

// POST authentifié (WSSE + X-Signature) vers un endpoint MisterBooking.
// Les 5xx transitoires (l'API renvoie parfois un 500 vide) sont retentés
// une fois après un court délai, avec un en-tête WSSE régénéré.
export async function mbPost<T = any>(path: string, payload: unknown): Promise<T> {
  const rawBody = JSON.stringify(payload);

  const doRequest = async (): Promise<Response> => {
    const wsse = await buildWsseHeader();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Wsse': wsse,
    };
    const signature = await mbSignBody(rawBody);
    if (signature) headers['X-Signature'] = signature;
    return await fetch(`${MB_BASE_URL}/${path.replace(/^\//, '')}`, {
      method: 'POST',
      headers,
      body: rawBody,
    });
  };

  let res = await doRequest();
  if (res.status >= 500) {
    await res.text().catch(() => '');
    await new Promise((r) => setTimeout(r, 800));
    res = await doRequest();
  }
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`MisterBooking ${path} échoué [${res.status}]: ${text}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

export interface MbBooking {
  bookingId: number;
  status: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  roomId: number; // 0 si non affectée
  customerId: number;
  folderId: number;
  checkIn: boolean | number;
  checkOut: boolean | number;
  roomNumber: string | null;
  // Occupants : crm/bookings renvoie un tableau [{ type, count }].
  occupancy?: Array<{ type?: string; count?: number | string }> | number | string;
  guestInfo?: {
    civility?: string;
    lastName?: string;
    firstName?: string;
    languageId?: string;
    company?: string;
  };
}

// Chambre issue du mappage MisterBooking (inventaire complet de l'hôtel).
export interface MbRoom {
  roomId: number;
  roomNumber: string;
}

const today = () => new Date().toISOString().split('T')[0];

function mbExtractErrors(data: any): Array<{ code?: string; description?: string }> | null {
  const errors = data?.data?.errors || data?.errors;
  return Array.isArray(errors) && errors.length > 0 ? errors : null;
}

// ─── Mapping API (mappingRoomRate) ────────────────────────────────
// Retourne TOUT l'inventaire de chambres de l'hôtel (roomId + numéro), via les
// services d'hébergement. C'est la source documentée du `roomId` utilisé par
// l'API housekeeping. Corps de requête : { hotelId }.
export async function mbFetchRoomMapping(hotelId: number): Promise<MbRoom[]> {
  const data = await mbPost<{
    success?: string | boolean;
    data?: {
      rooms?: Array<{ roomList?: Array<{ id?: number; name?: string }> }>;
      errors?: Array<{ code?: string; description?: string }>;
    };
    errors?: Array<{ code?: string; description?: string }>;
  }>('mappingRoomRate', { hotelId });

  const errors = mbExtractErrors(data);
  if (errors) {
    const first = errors[0];
    throw new Error(
      `MisterBooking (mappingRoomRate) a renvoyé une erreur : ${first?.description || first?.code || 'inconnue'}.`,
    );
  }

  const services = data?.data?.rooms || [];
  const out: MbRoom[] = [];
  const seen = new Set<number>();
  for (const svc of services) {
    for (const r of svc.roomList || []) {
      const num = String(r.name ?? '').trim();
      const id = Number(r.id);
      if (!num || !id || seen.has(id)) continue;
      seen.add(id);
      out.push({ roomId: id, roomNumber: num });
    }
  }
  console.log(`[misterbooking] mappingRoomRate hotel=${hotelId} -> ${out.length} chambres`);
  return out;
}

// ─── CRM API (crm/bookings) ───────────────────────────────────────
// Récupère les réservations sur une plage de dates. `data.bookings` est un
// OBJET indexé par bookingId (pas un tableau). Le paramètre `status` accepte
// (cf. doc) : « new » (nouvelles réservations), « stays » (séjours débutant sur
// la plage), et les séjours « en chambre » (arrivée effectuée, pas encore de
// départ). On essaie plusieurs valeurs et on conserve la première qui répond.
async function mbCrmBookings(
  hotelId: number,
  startDate: string,
  endDate: string,
  status: string,
): Promise<MbBooking[]> {
  const data = await mbPost<{
    success?: string | boolean;
    data?: {
      bookings?: Record<string, MbBooking> | MbBooking[];
      errors?: Array<{ code?: string; description?: string }>;
    };
    errors?: Array<{ code?: string; description?: string }>;
  }>('crm/bookings', { hotelId, startDate, endDate, status });

  const errors = mbExtractErrors(data);
  if (errors) {
    const first = errors[0];
    const e = new Error(
      `MisterBooking (crm/bookings status=${status}) : ${first?.description || first?.code || 'inconnue'}.`,
    );
    (e as any).mbCode = first?.code;
    throw e;
  }

  const raw = data?.data?.bookings;
  const list: MbBooking[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
      ? Object.values(raw)
      : [];
  if (list.length > 0) {
    console.log(`[mb-hk-probe] raw booking (status=${status}) -> ${JSON.stringify(list[0]).slice(0, 1800)}`);
  }
  return list;
}

// Statuts acceptés par crm/bookings (valeurs confirmées en production) :
//  - 'new'     : réservations créées entre les deux dates
//  - 'stay'    : réservations débutant durant la plage (arrivées à venir incluses)
//  - 'inhouse' : séjours en chambre (arrivée effectuée, départ non encore fait)
export type MbBookingStatus = 'new' | 'stay' | 'inhouse';

// Récupère les réservations via l'API CRM pour un ou plusieurs statuts, en
// dédupliquant par bookingId.
export async function mbFetchBookings(
  hotelId: number,
  startDate?: string,
  endDate?: string,
  statuses: MbBookingStatus[] = ['inhouse'],
): Promise<MbBooking[]> {
  const start = startDate || today();
  const end = endDate || start;
  const byId = new Map<number, MbBooking>();
  let lastError: unknown = null;
  let anySuccess = false;

  for (const status of statuses) {
    try {
      const list = await mbCrmBookings(hotelId, start, end, status);
      anySuccess = true;
      for (const b of list) {
        const id = Number(b.bookingId);
        if (!byId.has(id)) byId.set(id, b);
      }
      console.log(
        `[misterbooking] crm/bookings hotel=${hotelId} ${start}->${end} status=${status} -> ${list.length} réservations`,
      );
    } catch (err) {
      lastError = err;
      console.warn(`[misterbooking] crm/bookings status=${status} échec: ${(err as Error).message}`);
    }
  }

  if (!anySuccess && lastError) throw lastError;
  return Array.from(byId.values());
}

// Statut annulé ? (tolérant aux variantes de libellés)
function mbIsCancelled(b: MbBooking): boolean {
  const s = String(b.status || '').toLowerCase();
  return s.includes('cancel') || s.includes('annul') || s.includes('noshow') || s.includes('no-show');
}

// Réservations OPÉRATIONNELLES du jour : séjours en chambre (inhouse) +
// séjours ayant DÉBUTÉ dans le passé récent ou aujourd'hui (status=stay sur
// une fenêtre glissante de ~27 j, limite API < 1 mois). Cette 2e requête est
// indispensable pour voir :
//  - les arrivées du jour (pas encore « inhouse »),
//  - les DÉPARTS du jour : une fois le check-out fait, la réservation sort de
//    « inhouse » mais reste visible via « stay » avec checkOut=1 → la chambre
//    doit passer « à blanc » (sale).
// On ne garde que les réservations chevauchant AUJOURD'HUI
// (startDate <= today <= endDate), hors annulations.
export async function mbFetchOperationalBookings(
  hotelId: number,
  todayStr?: string,
): Promise<MbBooking[]> {
  const todayDate = todayStr || today();
  const shift = (base: string, days: number) => {
    const d = new Date(`${base}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
  };
  const windowStart = shift(todayDate, -27);
  const tomorrow = shift(todayDate, 1);

  const byId = new Map<number, MbBooking>();
  let lastError: unknown = null;
  let anySuccess = false;

  const runs: Array<{ start: string; end: string; status: MbBookingStatus }> = [
    { start: todayDate, end: todayDate, status: 'inhouse' },
    { start: windowStart, end: tomorrow, status: 'stay' },
  ];

  for (const run of runs) {
    try {
      const list = await mbCrmBookings(hotelId, run.start, run.end, run.status);
      anySuccess = true;
      for (const b of list) {
        const id = Number(b.bookingId);
        if (!byId.has(id)) byId.set(id, b);
      }
      console.log(
        `[misterbooking] crm/bookings hotel=${hotelId} ${run.start}->${run.end} status=${run.status} -> ${list.length} réservations`,
      );
    } catch (err) {
      lastError = err;
      console.warn(`[misterbooking] crm/bookings status=${run.status} échec: ${(err as Error).message}`);
    }
  }

  if (!anySuccess && lastError) throw lastError;

  const relevant = Array.from(byId.values()).filter((b) => {
    if (mbIsCancelled(b)) return false;
    const start = (b.startDate || '').split('T')[0];
    const end = (b.endDate || '').split('T')[0];
    if (!start || !end) return false;
    return start <= todayDate && end >= todayDate;
  });
  console.log(
    `[misterbooking] réservations opérationnelles hotel=${hotelId} ${todayDate} -> ${relevant.length}/${byId.size}`,
  );
  return relevant;
}


// PROBE temporaire : tente de LIRE le statut ménage depuis MisterBooking.
// On essaie plusieurs endpoints candidats et on logue la structure brute pour
// déterminer si une API de lecture existe pour ce partenaire.
export async function mbProbeHousekeeping(hotelId: number): Promise<void> {
  const candidates = ['houseKeeping/list', 'houseKeeping/get', 'houseKeeping', 'houseKeeping/status'];
  const today = new Date().toISOString().split('T')[0];
  for (const path of candidates) {
    try {
      const data = await mbPost<any>(path, { hotelId, date: today });
      console.log(`[mb-hk-probe] ${path} OK -> ${JSON.stringify(data).slice(0, 1500)}`);
    } catch (err) {
      console.warn(`[mb-hk-probe] ${path} échec: ${(err as Error).message}`);
    }
  }
}

// Met à jour le statut housekeeping (clean/dirty) de chambres côté MisterBooking.
export async function mbUpdateHousekeeping(
  hotelId: number,
  rooms: Array<{ roomId: number; status: 'clean' | 'dirty'; date: string }>,
): Promise<{ success: boolean; data?: any }> {
  return await mbPost('houseKeeping/update', { hotelId, rooms });
}

// Construit le nom de client lisible depuis guestInfo.
export function mbGuestName(b: MbBooking): string | null {
  const g = b.guestInfo;
  if (!g) return null;
  const name = `${g.lastName || ''} ${g.firstName || ''}`.trim();
  return name || null;
}

const toNum = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// Nombre d'occupants (pax). crm/bookings renvoie `occupancy` sous forme de
// tableau [{ type, count }] : on additionne les `count`. Tolère aussi un
// nombre simple pour compatibilité.
export function mbGuestCount(b: MbBooking): number | null {
  const occ = b.occupancy;
  if (Array.isArray(occ)) {
    const sum = occ.reduce((s, o) => s + toNum(o?.count), 0);
    return sum > 0 ? sum : null;
  }
  const direct = toNum(occ);
  return direct > 0 ? direct : null;
}

// ─── Client Profiles API (crm/customers) ──────────────────────────
// crm/bookings ne renvoie PAS le nom du client (seulement customerId).
// On récupère les fiches clients sur la plage et on indexe par customerId
// pour résoudre « Nom Prénom ».
export interface MbCustomer {
  customerId: number;
  lastName?: string;
  firstName?: string;
  civility?: string;
}

export async function mbFetchCustomers(
  hotelId: number,
  startDate?: string,
  endDate?: string,
): Promise<Map<number, MbCustomer>> {
  // crm/customers filtre par date de réservation : les clients « en chambre »
  // ont souvent réservé il y a plusieurs jours. On élargit la fenêtre à ~30 j
  // en arrière (limite API : 1 mois) pour les retrouver.
  const d = (off: number) => {
    const x = new Date();
    x.setDate(x.getDate() + off);
    return x.toISOString().split('T')[0];
  };
  const start = startDate || d(-30);
  const end = endDate || d(1);
  const map = new Map<number, MbCustomer>();
  try {
    const data = await mbPost<{
      data?: { customers?: Record<string, MbCustomer> | MbCustomer[]; errors?: any[] };
      errors?: any[];
    }>('crm/customers', { hotelId, startDate: start, endDate: end });
    const errors = mbExtractErrors(data);
    if (errors) {
      console.warn(`[misterbooking] crm/customers erreur: ${errors[0]?.description || errors[0]?.code}`);
      return map;
    }
    const raw = data?.data?.customers;
    const list: MbCustomer[] = Array.isArray(raw) ? raw : raw ? Object.values(raw) : [];
    for (const c of list) {
      const id = Number(c.customerId);
      if (id) map.set(id, c);
    }
    console.log(`[misterbooking] crm/customers hotel=${hotelId} -> ${map.size} clients`);
  } catch (err) {
    console.warn(`[misterbooking] crm/customers échec: ${(err as Error).message}`);
  }
  return map;
}

// Renseigne le nom client (guestInfo) des réservations depuis la map clients.
export function mbAttachCustomers(bookings: MbBooking[], customers: Map<number, MbCustomer>): void {
  for (const b of bookings) {
    if (b.guestInfo?.lastName || b.guestInfo?.firstName) continue;
    const c = customers.get(Number(b.customerId));
    if (c && (c.lastName || c.firstName)) {
      b.guestInfo = { lastName: c.lastName, firstName: c.firstName, civility: c.civility };
    }
  }
}


const truthy = (v: boolean | number | undefined) => v === true || v === 1 || (v as unknown) === '1';

// Convertit une réservation MisterBooking en chambre opérationnelle Nettobloc.
export function mbBookingToRoom(b: MbBooking, today: string) {
  const arrival = (b.startDate || '').split('T')[0];
  const departure = (b.endDate || '').split('T')[0];
  let status = 'occupied';
  let cleaningType = 'recouche';

  if (truthy(b.checkOut) || departure === today) {
    status = 'checkout';
    cleaningType = 'depart';
  } else if (arrival === today) {
    status = 'arrival';
    cleaningType = 'arrivee';
  } else {
    status = 'occupied';
    cleaningType = 'recouche';
  }

  return {
    roomNumber: (b.roomNumber || '').toString().trim(),
    roomId: b.roomId,
    status,
    cleaningType,
    guestName: mbGuestName(b),
    guestCount: mbGuestCount(b),
    arrivalDate: arrival || null,
    departureDate: departure || null,
  };
}

export interface MbExtractedRoom {
  roomNumber: string;
  roomId?: number;
  status: string;
  cleaningType: string;
  guestName?: string;
  guestCount?: number;
  arrivalDate?: string;
  departureDate?: string;
}

// Construit la liste complète des chambres : on part de l'inventaire (mapping)
// puis on superpose l'occupation issue des réservations en cours. Les chambres
// sans réservation restent « à nettoyer » (règle registre du projet).
export function mbBuildRoomList(
  mapping: MbRoom[],
  bookings: MbBooking[],
  todayStr: string,
): MbExtractedRoom[] {
  const byNumber = new Map<string, MbExtractedRoom>();

  // 1. Inventaire complet. MisterBooking n'expose PAS d'API de lecture du
  //    statut ménage (Housekeeping API en écriture seule pour ce partenaire).
  //    On marque donc les chambres SANS séjour avec le sentinel 'unknown' :
  //    pms-sync conservera leur état local propre/sale au lieu de l'écraser.
  for (const m of mapping) {
    const num = String(m.roomNumber || '').trim();
    if (!num) continue;
    byNumber.set(num.toLowerCase(), {
      roomNumber: num,
      roomId: m.roomId,
      status: 'unknown',
      cleaningType: 'none',
    });
  }

  // Index roomId -> numéro pour résoudre les réservations dont `roomNumber`
  // est vide (crm/bookings renvoie parfois seulement `roomId`).
  const numberById = new Map<number, string>();
  for (const m of mapping) {
    if (m.roomId) numberById.set(Number(m.roomId), String(m.roomNumber || '').trim());
  }

  // Priorité de superposition quand plusieurs réservations touchent la même
  // chambre (ex. départ + arrivée le même jour) : le DÉPART gagne (la chambre
  // doit repasser « à blanc »), puis l'arrivée, puis la recouche.
  const rank = (s: string) => (s === 'checkout' ? 3 : s === 'arrival' ? 2 : s === 'occupied' ? 1 : 0);

  // 2. Superposition des séjours actuels.
  for (const b of bookings) {
    const r = mbBookingToRoom(b, todayStr);
    if (!r.roomNumber && b.roomId) r.roomNumber = numberById.get(Number(b.roomId)) || '';
    if (!r.roomNumber) continue;
    const key = r.roomNumber.toLowerCase();
    const existing = byNumber.get(key);

    if (existing && rank(existing.status) > rank(r.status)) {
      // On garde le statut prioritaire (départ), mais on complète le client
      // (ex. nom de l'arrivant sur un départ/arrivée le même jour).
      if (!existing.guestName && r.guestName) existing.guestName = r.guestName;
      if (!existing.guestCount && r.guestCount) existing.guestCount = r.guestCount ?? undefined;
      continue;
    }

    byNumber.set(key, {
      roomNumber: r.roomNumber,
      roomId: r.roomId || existing?.roomId,
      status: r.status,
      cleaningType: r.cleaningType,
      guestName: r.guestName ?? existing?.guestName,
      guestCount: r.guestCount ?? existing?.guestCount,
      arrivalDate: r.arrivalDate ?? undefined,
      departureDate: r.departureDate ?? undefined,
    });
  }

  return Array.from(byNumber.values());
}
