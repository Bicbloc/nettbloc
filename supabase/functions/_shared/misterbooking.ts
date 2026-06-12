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
export async function mbPost<T = any>(path: string, payload: unknown): Promise<T> {
  const rawBody = JSON.stringify(payload);
  const wsse = await buildWsseHeader();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Wsse': wsse,
  };
  const signature = await mbSignBody(rawBody);
  if (signature) headers['X-Signature'] = signature;

  const res = await fetch(`${MB_BASE_URL}/${path.replace(/^\//, '')}`, {
    method: 'POST',
    headers,
    body: rawBody,
  });
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

  // 1. Inventaire complet, par défaut « à nettoyer ».
  for (const m of mapping) {
    const num = String(m.roomNumber || '').trim();
    if (!num) continue;
    byNumber.set(num.toLowerCase(), {
      roomNumber: num,
      roomId: m.roomId,
      status: 'needs-cleaning',
      cleaningType: 'none',
    });
  }

  // 2. Superposition des séjours actuels.
  for (const b of bookings) {
    const r = mbBookingToRoom(b, todayStr);
    if (!r.roomNumber) continue;
    const key = r.roomNumber.toLowerCase();
    const existing = byNumber.get(key);
    byNumber.set(key, {
      roomNumber: r.roomNumber,
      roomId: r.roomId || existing?.roomId,
      status: r.status,
      cleaningType: r.cleaningType,
      guestName: r.guestName ?? undefined,
      guestCount: r.guestCount ?? undefined,
      arrivalDate: r.arrivalDate ?? undefined,
      departureDate: r.departureDate ?? undefined,
    });
  }

  return Array.from(byNumber.values());
}
