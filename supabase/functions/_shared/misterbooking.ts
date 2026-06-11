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

// Récupère les séjours « en chambre » du jour (occupation actuelle) via l'API
// CRM. Essaie successivement les valeurs de statut acceptées par MisterBooking
// et journalise celle qui fonctionne, afin de figer la bonne valeur ensuite.
export async function mbFetchBookings(
  hotelId: number,
  startDate?: string,
  endDate?: string,
): Promise<MbBooking[]> {
  const start = startDate || today();
  const end = endDate || start;
  const statuses = ['inHouse', 'stays', 'new'];
  let lastError: unknown = null;

  for (const status of statuses) {
    try {
      const list = await mbCrmBookings(hotelId, start, end, status);
      console.log(
        `[misterbooking] crm/bookings hotel=${hotelId} ${start}->${end} status=${status} -> ${list.length} réservations`,
      );
      if (list.length > 0) return list;
      lastError = null; // requête valide mais vide : on tente le statut suivant
    } catch (err) {
      lastError = err;
      console.warn(`[misterbooking] crm/bookings status=${status} échec: ${(err as Error).message}`);
    }
  }

  if (lastError) throw lastError;
  return [];
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
    arrivalDate: arrival || null,
    departureDate: departure || null,
  };
}
