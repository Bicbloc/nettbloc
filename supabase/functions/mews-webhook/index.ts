import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// ─────────────────────────────────────────────────────────────────
// Webhook Mews — General Webhook (temps réel)
//
// Mews envoie un POST à cet endpoint quand des entités changent. Format :
// {
//   "EnterpriseId": "uuid",
//   "IntegrationId": "uuid",
//   "Events": [
//     { "Discriminator": "ServiceOrderUpdated", "Value": { "Id": "..." } },
//     { "Discriminator": "ResourceUpdated",     "Value": { "Id": "..." } }
//   ]
// }
//
// Les événements ne portent QUE l'ID de l'entité, pas son détail. On ne s'en
// sert donc que comme déclencheur : on identifie l'hôtel via EnterpriseId puis
// on relance une synchronisation ciblée (pms-sync action 'sync_hotel') qui va
// rappeler l'API Mews et refléter l'état réel des chambres/réservations.
//
// Mews attend une réponse rapide (sinon il renvoie le message) : on répond 200
// immédiatement et on traite en arrière-plan via EdgeRuntime.waitUntil.
// ─────────────────────────────────────────────────────────────────

const RELEVANT = new Set(['ServiceOrderUpdated', 'ResourceUpdated', 'ResourceBlockUpdated']);

interface MewsCredentials {
  clientToken?: string;
  accessToken?: string;
  baseUrl?: string;
  enterpriseId?: string;
  [k: string]: unknown;
}

// Récupère (et mémorise) l'EnterpriseId Mews d'une config via configuration/get.
async function resolveEnterpriseId(admin: any, cfg: any): Promise<string | null> {
  const creds = (cfg.credentials || {}) as MewsCredentials;
  if (creds.enterpriseId) return String(creds.enterpriseId);

  const baseUrl = cfg.base_url || creds.baseUrl || 'https://api.mews.com/api/connector/v1';
  if (!creds.clientToken || !creds.accessToken) return null;

  try {
    const res = await fetch(`${baseUrl}/configuration/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ClientToken: creds.clientToken,
        AccessToken: creds.accessToken,
        Client: 'NettoBloc 1.0',
      }),
    });
    if (!res.ok) {
      await res.text().catch(() => {});
      return null;
    }
    const data = await res.json();
    const enterpriseId = data?.Enterprise?.Id ?? data?.EnterpriseId ?? null;
    if (enterpriseId) {
      // Mémorise pour éviter de refaire l'appel à chaque webhook.
      await admin
        .from('hotel_pms_configs')
        .update({ credentials: { ...creds, enterpriseId } })
        .eq('id', cfg.id);
      return String(enterpriseId);
    }
  } catch (e) {
    console.warn('mews-webhook: configuration/get échec', e instanceof Error ? e.message : e);
  }
  return null;
}

async function processWebhook(enterpriseId: string): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: configs } = await admin
    .from('hotel_pms_configs')
    .select('id, hotel_id, credentials, base_url')
    .eq('pms_type', 'mews')
    .eq('is_active', true);

  if (!configs || configs.length === 0) {
    console.log('mews-webhook: aucune config Mews active');
    return;
  }

  // 1. Correspondance directe via enterpriseId déjà mémorisé.
  let matched = configs.find(
    (c: any) => String((c.credentials || {}).enterpriseId || '') === enterpriseId,
  );

  // 2. Sinon, résoudre les enterpriseId manquants puis re-matcher.
  if (!matched) {
    for (const c of configs) {
      if ((c.credentials || {}).enterpriseId) continue;
      const resolved = await resolveEnterpriseId(admin, c);
      if (resolved === enterpriseId) {
        matched = c;
        break;
      }
    }
  }

  if (!matched) {
    console.warn(`mews-webhook: aucun hôtel pour EnterpriseId=${enterpriseId}`);
    return;
  }

  // 3. Déclencher une synchro ciblée de l'hôtel via pms-sync (action privilégiée).
  const res = await fetch(`${supabaseUrl}/functions/v1/pms-sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ action: 'sync_hotel', hotel_id: matched.hotel_id }),
  });
  const out = await res.text();
  console.log(`mews-webhook: sync hôtel=${matched.hotel_id} -> [${res.status}] ${out.slice(0, 200)}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let payload: any = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const enterpriseId = String(payload?.EnterpriseId || '').trim();
  const events: any[] = Array.isArray(payload?.Events) ? payload.Events : [];
  const hasRelevant = events.some((e) => RELEVANT.has(String(e?.Discriminator || '')));

  console.log(
    `mews-webhook reçu: enterprise=${enterpriseId || 'none'} events=${events.length} relevant=${hasRelevant}`,
  );

  // Répondre vite à Mews ; traiter en arrière-plan si pertinent.
  if (enterpriseId && hasRelevant) {
    // @ts-ignore EdgeRuntime est disponible dans le runtime Supabase
    EdgeRuntime.waitUntil(
      processWebhook(enterpriseId).catch((e) =>
        console.error('mews-webhook processing error:', e instanceof Error ? e.message : e),
      ),
    );
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
});
