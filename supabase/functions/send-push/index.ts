import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// ---- Helpers pour générer un access token OAuth2 à partir du service account ----

function pemToBinary(pem: string): Uint8Array {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64url(input: ArrayBuffer | string): string {
  let str: string;
  if (typeof input === 'string') {
    str = btoa(input);
  } else {
    const bytes = new Uint8Array(input);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    str = btoa(binary);
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBinary(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );

  const jwt = `${unsigned}.${base64url(signature)}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!resp.ok) {
    throw new Error(`OAuth token error ${resp.status}: ${await resp.text()}`);
  }

  const data = await resp.json();
  return data.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const hotelId = body.hotel_id;
    const title = body.title || 'Nettobloc';
    const message = body.body || '';

    if (!hotelId) {
      return new Response(JSON.stringify({ error: 'hotel_id requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceAccountRaw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!serviceAccountRaw) {
      return new Response(JSON.stringify({ error: 'FIREBASE_SERVICE_ACCOUNT non configuré' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const serviceAccount = JSON.parse(serviceAccountRaw);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Récupérer les tokens des appareils de l'hôtel
    const { data: tokens, error } = await supabase
      .from('device_push_tokens')
      .select('token')
      .eq('hotel_id', hotelId);

    if (error) {
      console.error('Erreur lecture tokens:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, info: 'Aucun appareil enregistré' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = await getAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    let sent = 0;
    const staleTokens: string[] = [];

    await Promise.all(
      tokens.map(async ({ token }) => {
        const payload = {
          message: {
            token,
            notification: { title, body: message },
            android: {
              priority: 'HIGH',
              notification: { sound: 'default', default_sound: true },
            },
            apns: {
              payload: { aps: { sound: 'default' } },
            },
          },
        };

        const r = await fetch(fcmUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (r.ok) {
          sent++;
        } else {
          const errText = await r.text();
          console.warn('FCM error pour token:', r.status, errText);
          // Token invalide / désinscrit → à nettoyer
          if (r.status === 404 || r.status === 400) {
            staleTokens.push(token);
          }
        }
      }),
    );

    // Nettoyage des tokens invalides
    if (staleTokens.length > 0) {
      await supabase.from('device_push_tokens').delete().in('token', staleTokens);
    }

    return new Response(JSON.stringify({ sent, total: tokens.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('send-push exception:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
