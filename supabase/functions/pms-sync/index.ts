import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface PmsCredentials {
  clientToken?: string;
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
  propertyId?: string;
  baseUrl?: string;
}

interface ExtractedRoom {
  roomNumber: string;
  status: string;
  cleaningType: string;
  condition?: string | null;
  floor?: number;
  roomType?: string;
  guestName?: string;
  arrivalDate?: string;
  departureDate?: string;
  notes?: string;
}

// ─── Mews Connector ───────────────────────────────────────────────
async function fetchMewsRooms(credentials: PmsCredentials): Promise<ExtractedRoom[]> {
  const baseUrl = credentials.baseUrl || 'https://api.mews.com/api/connector/v1';
  
  // 1. Fetch spaces (rooms)
  const spacesRes = await fetch(`${baseUrl}/spaces/getAll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ClientToken: credentials.clientToken,
      AccessToken: credentials.accessToken,
      LanguageCode: 'fr-FR',
      Extent: {
        Spaces: true,
        SpaceCategories: true,
        SpaceFeatures: true,
      }
    }),
  });

  if (!spacesRes.ok) {
    const errBody = await spacesRes.text();
    throw new Error(`Mews spaces/getAll failed [${spacesRes.status}]: ${errBody}`);
  }

  const spacesData = await spacesRes.json();
  const spaces = spacesData.Spaces || [];
  const categories = spacesData.SpaceCategories || [];

  // Build category map
  const categoryMap: Record<string, string> = {};
  for (const cat of categories) {
    categoryMap[cat.Id] = cat.ShortName || cat.Name || 'Standard';
  }

  // 2. Fetch reservations for today
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const reservationsRes = await fetch(`${baseUrl}/reservations/getAll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ClientToken: credentials.clientToken,
      AccessToken: credentials.accessToken,
      StartUtc: `${today}T00:00:00Z`,
      EndUtc: `${tomorrow}T23:59:59Z`,
      Extent: {
        Reservations: true,
        Customers: true,
      },
      States: ['Confirmed', 'Started'],
    }),
  });

  let reservations: any[] = [];
  let customers: any[] = [];
  if (reservationsRes.ok) {
    const resData = await reservationsRes.json();
    reservations = resData.Reservations || [];
    customers = resData.Customers || [];
  }

  // Build customer map
  const customerMap: Record<string, string> = {};
  for (const c of customers) {
    customerMap[c.Id] = `${c.LastName || ''} ${c.FirstName || ''}`.trim();
  }

  // Build reservation map by space (room)
  const reservationBySpace: Record<string, any> = {};
  for (const r of reservations) {
    if (r.AssignedSpaceId) {
      reservationBySpace[r.AssignedSpaceId] = r;
    }
  }

  // 3. Map to ExtractedRoom[]
  return spaces
    .filter((s: any) => s.Type === 'Room' || !s.Type)
    .map((space: any) => {
      const reservation = reservationBySpace[space.Id];
      const hasReservation = !!reservation;
      
      let cleaningType = 'recouche';
      let status = 'occupied';

      if (!hasReservation) {
        cleaningType = 'depart';
        status = 'vacant';
      } else if (reservation) {
        const checkIn = reservation.StartUtc?.split('T')[0];
        const checkOut = reservation.EndUtc?.split('T')[0];
        if (checkOut === today) {
          cleaningType = 'depart';
          status = 'checkout';
        } else if (checkIn === today) {
          cleaningType = 'arrivee';
          status = 'arrival';
        }
      }

      const floor = space.FloorNumber || (space.Number ? parseInt(space.Number.toString().slice(0, -2)) || undefined : undefined);

      return {
        roomNumber: space.Number || space.Name || space.Id,
        status,
        cleaningType,
        floor,
        roomType: categoryMap[space.CategoryId] || undefined,
        guestName: reservation ? customerMap[reservation.CustomerId] : undefined,
        arrivalDate: reservation?.StartUtc?.split('T')[0],
        departureDate: reservation?.EndUtc?.split('T')[0],
      };
    });
}

// Parse une réponse JSON en évitant l'erreur "unexpected end of JSON input"
async function safeJson(res: Response, label: string): Promise<any> {
  const text = await res.text();
  if (!text || !text.trim()) {
    throw new Error(`${label}: réponse vide du serveur (HTTP ${res.status})`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label}: réponse invalide (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
}

// GET JSON robuste : en-tête Accept (pas Content-Type sur un GET), retry si corps vide
async function getJson(url: string, token: string, label: string): Promise<any> {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`${label} échouée [${res.status}]: ${errBody || 'vérifiez le Property ID'}`);
    }
    const text = await res.text();
    if (text && text.trim()) {
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`${label}: réponse invalide (HTTP ${res.status}): ${text.slice(0, 200)}`);
      }
    }
    console.warn(`${label}: corps vide (HTTP ${res.status}), tentative ${attempt}/2`);
  }
  throw new Error(`${label}: réponse vide du serveur après 2 tentatives.`);
}


// ─── Apaleo Connector ─────────────────────────────────────────────
async function fetchApaleoRooms(credentials: PmsCredentials): Promise<ExtractedRoom[]> {
  const propertyId = credentials.propertyId;
  if (!credentials.clientId || !credentials.clientSecret) {
    throw new Error('Client ID et Client Secret Apaleo requis.');
  }
  if (!propertyId) {
    throw new Error('Property ID Apaleo manquant.');
  }

  // 1. Get OAuth token (scope requis pour accéder aux unités et réservations)
  const tokenRes = await fetch('https://identity.apaleo.com/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    throw new Error(`Authentification Apaleo échouée [${tokenRes.status}]: ${errBody || 'vérifiez Client ID / Client Secret'}`);
  }

  const tokenData = await safeJson(tokenRes, 'Authentification Apaleo');
  const access_token = tokenData.access_token;
  if (!access_token) {
    throw new Error('Token Apaleo non reçu — vérifiez Client ID / Client Secret et les scopes du compte.');
  }

  // 2. Fetch units (rooms)
  const unitsData = await getJson(
    `https://api.apaleo.com/inventory/v1/units?propertyId=${propertyId}&pageSize=200`,
    access_token,
    'Récupération des chambres Apaleo'
  );
  const units = unitsData.units || [];

  // 2b. Fetch housekeeping conditions (Clean/Dirty/...) from Operations API
  const conditionByUnit: Record<string, string> = {};
  try {
    const opsData = await getJson(
      `https://api.apaleo.com/operations/v1/units?propertyId=${propertyId}&pageSize=200`,
      access_token,
      'États de ménage Apaleo'
    );
    const opsUnits = opsData?.units || [];
    for (const ou of opsUnits) {
      const cond = ou?.status?.condition || ou?.condition;
      if (ou?.id && cond) conditionByUnit[ou.id] = cond;
    }
  } catch (e) {
    console.warn('Conditions de ménage Apaleo non récupérées:', e instanceof Error ? e.message : e);
  }

  // 3. Fetch reservations for today
  const today = new Date().toISOString().split('T')[0];
  let reservations: any[] = [];
  try {
    const resData = await getJson(
      `https://api.apaleo.com/booking/v1/reservations?propertyIds=${propertyId}&dateFilter=Stay&from=${today}&to=${today}&status=Confirmed,InHouse&pageSize=200`,
      access_token,
      'Réservations Apaleo'
    );
    reservations = resData.reservations || [];
  } catch (e) {
    console.warn('Réservations Apaleo non récupérées:', e instanceof Error ? e.message : e);
  }


  // Build reservation map by unit
  const reservationByUnit: Record<string, any> = {};
  for (const r of reservations) {
    if (r.unit?.id) {
      reservationByUnit[r.unit.id] = r;
    }
  }

  return units.map((unit: any) => {
    const reservation = reservationByUnit[unit.id];
    const condition = conditionByUnit[unit.id]; // Clean | Dirty | CleanToBeInspected | OutOfService | OutOfOrder
    let cleaningType = 'none';
    let status = 'vacant';

    if (condition === 'OutOfService' || condition === 'OutOfOrder') {
      // Chambre hors service : pas de ménage
      cleaningType = 'hors_service';
      status = 'out-of-service';
    } else if (reservation) {
      const departure = reservation.departure?.split('T')[0];
      const arrival = reservation.arrival?.split('T')[0];
      if (departure === today) {
        cleaningType = 'depart';
        status = 'checkout';
      } else if (arrival === today) {
        cleaningType = 'arrivee';
        status = 'arrival';
      } else {
        cleaningType = 'recouche';
        status = 'occupied';
      }
    } else {
      // Aucune réservation : on se fie à l'état de ménage Apaleo
      if (condition === 'Dirty') {
        cleaningType = 'depart';
        status = 'checkout';
      } else if (condition === 'Clean' || condition === 'CleanToBeInspected') {
        cleaningType = 'none';
        status = 'clean';
      } else {
        // Pas d'info de condition : repli sur l'ancien comportement (à blanc)
        cleaningType = 'depart';
        status = 'vacant';
      }
    }

    return {
      roomNumber: unit.name || unit.id,
      status,
      cleaningType,
      condition: condition ?? null,
      floor: unit.floor ? parseInt(unit.floor) : undefined,
      roomType: unit.unitGroup?.name,
      guestName: reservation?.primaryGuest ? `${reservation.primaryGuest.lastName || ''} ${reservation.primaryGuest.firstName || ''}`.trim() : undefined,
      arrivalDate: reservation?.arrival?.split('T')[0],
      departureDate: reservation?.departure?.split('T')[0],
    };
  });
}

// ─── Main handler ─────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub as string;

    // Parse request
    const { hotel_id, action } = await req.json();
    if (!hotel_id) {
      return new Response(JSON.stringify({ error: 'hotel_id required' }), { status: 400, headers: corsHeaders });
    }

    // Use service role for DB operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify hotel ownership
    const { data: hotel } = await adminClient
      .from('hotels')
      .select('id, user_id')
      .eq('id', hotel_id)
      .single();

    if (!hotel || hotel.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Not authorized for this hotel' }), { status: 403, headers: corsHeaders });
    }

    // Get PMS config.
    // For a connection test, we don't require is_active=true (the user is
    // typically testing before enabling automatic sync). For real syncs, only
    // active configs are synced.
    let configQuery = adminClient
      .from('hotel_pms_configs')
      .select('*')
      .eq('hotel_id', hotel_id);

    // Only the automatic 'sync' action requires an active config.
    // 'test' and 'import' run on demand even before activation.
    if (action === 'sync') {
      configQuery = configQuery.eq('is_active', true);
    }

    const { data: pmsConfig } = await configQuery.maybeSingle();

    if (!pmsConfig) {
      return new Response(JSON.stringify({
        success: false,
        error: action === 'test'
          ? 'Aucune configuration PMS trouvée. Sauvegardez d\'abord vos identifiants.'
          : 'Aucune configuration PMS active trouvée.',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Test connection only
    if (action === 'test') {
      try {
        const credentials = pmsConfig.credentials as PmsCredentials;
        let rooms: ExtractedRoom[] = [];

        switch (pmsConfig.pms_type) {
          case 'mews':
            rooms = await fetchMewsRooms(credentials);
            break;
          case 'apaleo':
            rooms = await fetchApaleoRooms(credentials);
            break;
          default:
            return new Response(JSON.stringify({ success: false, error: `Le PMS '${pmsConfig.pms_type}' n'est pas encore supporté pour la synchro API directe.` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ 
          success: true, 
          message: `Connexion réussie : ${rooms.length} chambres trouvées`,
          rooms_count: rooms.length,
          rooms: rooms.map(r => ({
            roomNumber: r.roomNumber,
            floor: r.floor ?? null,
            roomType: r.roomType ?? null,
            cleaningType: r.cleaningType,
            condition: r.condition ?? null,
            guestName: r.guestName ?? null,
            arrivalDate: r.arrivalDate ?? null,
            departureDate: r.departureDate ?? null,
          })),
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return new Response(JSON.stringify({ success: false, error: msg }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Full sync
    // Create sync log
    const { data: syncLog } = await adminClient
      .from('pms_sync_logs')
      .insert({
        hotel_id,
        pms_type: pmsConfig.pms_type,
        status: 'running',
      })
      .select('id')
      .single();

    try {
      const credentials = pmsConfig.credentials as PmsCredentials;
      let rooms: ExtractedRoom[] = [];

      switch (pmsConfig.pms_type) {
        case 'mews':
          rooms = await fetchMewsRooms(credentials);
          break;
        case 'apaleo':
          rooms = await fetchApaleoRooms(credentials);
          break;
        default:
          throw new Error(`PMS type '${pmsConfig.pms_type}' not supported`);
      }

      // Map cleaningType (depart/arrivee/recouche) -> cleaning_type stocké en base
      const toDbCleaningType = (t?: string): string => {
        switch ((t || '').toLowerCase()) {
          case 'depart':
          case 'arrivee':
          case 'full':
          case 'a_blanc':
            return 'a_blanc';
          case 'recouche':
          case 'quick':
          case 'occupied':
            return 'recouche';
          default:
            return 'none';
        }
      };

      // Upsert rooms into the rooms table (colonnes existantes uniquement)
      for (const room of rooms) {
        await adminClient
          .from('rooms')
          .upsert({
            hotel_id,
            room_number: room.roomNumber,
            status: 'needs-cleaning',
            cleaning_type: toDbCleaningType(room.cleaningType),
            floor: room.floor ?? null,
            room_type: room.roomType ?? null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'hotel_id,room_number' });
      }

      // Update sync status
      await adminClient
        .from('pms_sync_logs')
        .update({
          status: 'success',
          sync_ended_at: new Date().toISOString(),
          rooms_synced: rooms.length,
        })
        .eq('id', syncLog?.id);

      await adminClient
        .from('hotel_pms_configs')
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: 'success',
          last_sync_error: null,
        })
        .eq('id', pmsConfig.id);

      return new Response(JSON.stringify({
        success: true,
        rooms_synced: rooms.length,
        message: `${rooms.length} chambres synchronisées avec succès`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Sync failed';

      await adminClient
        .from('pms_sync_logs')
        .update({
          status: 'error',
          sync_ended_at: new Date().toISOString(),
          error_message: msg,
        })
        .eq('id', syncLog?.id);

      await adminClient
        .from('hotel_pms_configs')
        .update({
          last_sync_status: 'error',
          last_sync_error: msg,
        })
        .eq('id', pmsConfig.id);

      return new Response(JSON.stringify({ success: false, error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal error';
    console.error('pms-sync error:', msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
