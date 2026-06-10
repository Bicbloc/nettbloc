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

// Récupère les réservations en cours (séjour englobant la date du jour).
//
// IMPORTANT : la lecture des clients/réservations passe par l'API
// `connectedDevices/customers`. Cette API doit être ACTIVÉE par MisterBooking
// pour les identifiants partenaire (login WSSE). Si elle ne l'est pas,
// MisterBooking renvoie HTTP 200 avec `{ success:"false", data:{ errors:[{ code:"E1001",
// description:"You don't have access to this api" }] } }`. Dans ce cas on lève
// une erreur explicite au lieu de retourner « 0 chambre » silencieusement.
export async function mbFetchBookings(hotelId: number): Promise<MbBooking[]> {
  const data = await mbPost<{
    success?: string | boolean;
    data?: { bookingList?: MbBooking[]; errors?: Array<{ code?: string; description?: string }> };
    errors?: Array<{ code?: string; description?: string }>;
  }>('connectedDevices/customers', { hotelId });

  const errors = data?.data?.errors || data?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0];
    if (first?.code === 'E1001' || /access to this api/i.test(first?.description || '')) {
      throw new Error(
        "Accès à l'API MisterBooking refusé (E1001). MisterBooking doit activer " +
          "l'API « connectedDevices/customers » pour vos identifiants partenaire. " +
          "Contactez le support MisterBooking pour autoriser la lecture des clients/réservations " +
          `pour l'établissement ${hotelId}.`,
      );
    }
    throw new Error(
      `MisterBooking a renvoyé une erreur : ${first?.description || first?.code || 'inconnue'}.`,
    );
  }

  return data?.data?.bookingList || [];
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
