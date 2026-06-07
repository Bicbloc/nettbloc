import { createClient } from 'npm:@supabase/supabase-js@2'

// Page de retour OAuth d'Apaleo (flux Authorization Code).
// Apaleo redirige le navigateur ici avec ?code=...&state=<hotel_id>.
// On échange le code contre un refresh token que l'on stocke dans la config PMS.

const html = (title: string, message: string, ok: boolean) => `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;
    display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}
  .card{background:#1e293b;border-radius:16px;padding:32px;max-width:420px;text-align:center;
    box-shadow:0 10px 40px rgba(0,0,0,.4)}
  .icon{font-size:48px;margin-bottom:12px}
  h1{font-size:20px;margin:0 0 8px}
  p{color:#94a3b8;font-size:14px;line-height:1.5;margin:0}
</style></head>
<body><div class="card">
  <div class="icon">${ok ? '✅' : '⚠️'}</div>
  <h1>${title}</h1>
  <p>${message}</p>
</div></body></html>`

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const hotelId = url.searchParams.get('state') || ''
  const error = url.searchParams.get('error')

  const respondHtml = (title: string, message: string, ok: boolean, status = 200) =>
    new Response(html(title, message, ok), {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })

  if (error) {
    return respondHtml('Connexion refusée', `Apaleo a renvoyé une erreur : ${error}`, false, 400)
  }
  if (!code || !hotelId) {
    return respondHtml('Lien invalide', 'Code d’autorisation ou identifiant hôtel manquant.', false, 400)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)

    const { data: config } = await admin
      .from('hotel_pms_configs')
      .select('id, credentials')
      .eq('hotel_id', hotelId)
      .eq('pms_type', 'apaleo')
      .maybeSingle()

    if (!config) {
      return respondHtml('Configuration introuvable', 'Aucune configuration Apaleo pour cet hôtel.', false, 404)
    }

    const creds = (config.credentials || {}) as Record<string, string>
    const clientId = (creds.clientId || '').trim()
    const clientSecret = (creds.clientSecret || '').trim()
    if (!clientId || !clientSecret) {
      return respondHtml('Identifiants manquants', 'Renseignez d’abord le Client ID et le Client Secret.', false, 400)
    }

    const redirectUri = `${supabaseUrl}/functions/v1/apaleo-oauth-callback`
    const tokenRes = await fetch('https://identity.apaleo.com/connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenRes.ok) {
      const txt = await tokenRes.text()
      return respondHtml('Échec de l’échange', `Apaleo a refusé le code [${tokenRes.status}]: ${txt}`, false, 400)
    }

    const data = await tokenRes.json()
    const refreshToken = data.refresh_token
    if (!refreshToken) {
      return respondHtml(
        'Refresh token absent',
        'Apaleo n’a pas renvoyé de refresh token. Vérifiez que le scope « offline_access » est demandé.',
        false,
        400,
      )
    }

    await admin
      .from('hotel_pms_configs')
      .update({ credentials: { ...creds, refreshToken } })
      .eq('id', config.id)

    return respondHtml(
      'Apaleo connecté',
      'L’autorisation a réussi. Vous pouvez fermer cette fenêtre et revenir à Nettobloc.',
      true,
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur interne'
    return respondHtml('Erreur', msg, false, 500)
  }
})
