import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

interface DispatchPayload {
  hotel_id: string
  event_type: string
  record: Record<string, unknown>
}

const EVENT_LABELS: Record<string, string> = {
  'incident.created': '🛠️ Nouvel incident',
  'incident.updated': '🔄 Incident mis à jour',
  'lost_found.created': '🧳 Nouvel objet trouvé',
  'task.created': '✅ Nouveau ticket / tâche',
  'task.updated': '🔄 Tâche mise à jour',
  'report.created': '📊 Nouveau rapport quotidien',
}

function buildText(eventType: string, r: Record<string, any>): string {
  const label = EVENT_LABELS[eventType] ?? eventType
  const lines: string[] = [`*${label}*`]
  const add = (k: string, v: unknown) => {
    if (v !== null && v !== undefined && String(v).trim() !== '') lines.push(`• ${k}: ${v}`)
  }

  switch (eventType) {
    case 'incident.created':
    case 'incident.updated':
      add('Titre', r.title)
      add('Description', r.description)
      add('Priorité', r.priority)
      add('Statut', r.status)
      add('Emplacement', r.location_reference)
      add('Signalé par', r.reported_by_name)
      break
    case 'lost_found.created':
      add('Objet', r.object_description)
      add('Catégorie', r.object_category)
      add('Chambre', r.room_number)
      add('Détails', r.location_details)
      add('Client', r.guest_name)
      add('Statut', r.status)
      break
    case 'task.created':
    case 'task.updated':
      add('Titre', r.title)
      add('Description', r.description)
      add('Emplacement', r.location_reference)
      add('Assignée à', r.assigned_to_name)
      add('Priorité', r.priority)
      add('Statut', r.status)
      break
    case 'report.created':
      add('Date', r.report_date)
      add('Chambres nettoyées', r.total_rooms_cleaned)
      add('Heures travaillées', r.total_hours_worked)
      add('Résumé', r.summary)
      break
    default:
      add('Données', JSON.stringify(r))
  }
  return lines.join('\n')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const payload = (await req.json()) as DispatchPayload
    const { hotel_id, event_type, record } = payload

    if (!hotel_id || !event_type) {
      return new Response(JSON.stringify({ error: 'hotel_id and event_type are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: webhooks, error } = await supabase
      .from('hotel_webhooks')
      .select('id, provider, target_url, events')
      .eq('hotel_id', hotel_id)
      .eq('is_active', true)

    if (error) throw error

    const matching = (webhooks ?? []).filter(
      (w: any) => Array.isArray(w.events) && w.events.includes(event_type),
    )

    const text = buildText(event_type, record ?? {})

    const results = await Promise.allSettled(
      matching.map(async (w: any) => {
        let body: string
        if (w.provider === 'slack') {
          body = JSON.stringify({ text, blocks: [{ type: 'section', text: { type: 'mrkdwn', text } }] })
        } else {
          // Zapier / generic: full JSON + readable message
          body = JSON.stringify({
            event_type,
            hotel_id,
            message: text,
            data: record,
            timestamp: new Date().toISOString(),
          })
        }

        let status = 'sent'
        let responseCode: number | null = null
        let errMsg: string | null = null
        try {
          const resp = await fetch(w.target_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          })
          responseCode = resp.status
          if (!resp.ok) {
            status = 'failed'
            errMsg = `HTTP ${resp.status}`
          }
          await resp.text()
        } catch (e) {
          status = 'failed'
          errMsg = e instanceof Error ? e.message : String(e)
        }

        await supabase.from('webhook_deliveries').insert({
          hotel_id,
          webhook_id: w.id,
          event_type,
          status,
          response_code: responseCode,
          error: errMsg,
        })
        return { webhook_id: w.id, status }
      }),
    )

    return new Response(JSON.stringify({ dispatched: results.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    console.error('dispatch-webhooks error', e)
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
