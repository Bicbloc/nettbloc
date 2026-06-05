import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Require an authenticated user to prevent anonymous AI-cost abuse.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  {
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }


  try {
    const { 
      image, 
      linenTypeId, 
      hotelId, 
      liveMode = false, 
      useRuler = false, 
      detectMode = false,
      quickDetect = false // NEW: Ultra-fast detection for live preview
    } = await req.json();
    
    if (!image || !linenTypeId || !hotelId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fire-and-forget AI token usage logging
    const logAiUsage = (aiData: any, usedModel: string) => {
      try {
        const u = aiData?.usage || {};
        supabase.from('ai_usage_logs').insert({
          hotel_id: hotelId ?? null,
          function_name: 'count-linen',
          model: usedModel,
          prompt_tokens: u.prompt_tokens ?? 0,
          completion_tokens: u.completion_tokens ?? 0,
          total_tokens: u.total_tokens ?? ((u.prompt_tokens ?? 0) + (u.completion_tokens ?? 0)),
        }).then(() => {}, () => {});
      } catch (_) { /* ignore */ }
    };

    // Get linen type details including thickness for ruler-based calculation
    const { data: linenType, error: linenError } = await supabase
      .from('linen_types')
      .select('*')
      .eq('id', linenTypeId)
      .eq('hotel_id', hotelId)
      .single();

    if (linenError || !linenType) {
      return new Response(
        JSON.stringify({ error: 'Linen type not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all linen types for detection mode (to identify which type it is)
    let allLinenTypes: any[] = [];
    if (detectMode && !quickDetect) {
      const { data: types } = await supabase
        .from('linen_types')
        .select('id, name, category, dimensions, average_thickness_cm')
        .eq('hotel_id', hotelId)
        .eq('is_active', true);
      allLinenTypes = types || [];
    }

    // Get average thickness (default 2cm if not configured)
    const avgThickness = linenType.average_thickness_cm || 2.0;

    // Model selection - Optimized for accuracy:
    // - Quick/Live: Flash-lite (fast preview)
    // - Detect: Flash (balanced)
    // - Ruler/Validate: Pro (highest accuracy for final count)
    let model = 'google/gemini-2.5-flash';
    if (quickDetect) {
      model = 'google/gemini-2.5-flash-lite';
    } else if (liveMode) {
      model = 'google/gemini-2.5-flash';
    } else if (detectMode) {
      model = 'google/gemini-2.5-flash';
    } else if (useRuler) {
      model = 'google/gemini-2.5-pro';
    } else {
      // Validation mode = highest precision
      model = 'google/gemini-2.5-pro';
    }
    
    // ========== IMPROVED PROMPTS WITH NUMBERED ANNOTATION ==========
    
    // Core counting methodology shared across modes
    const countingMethodology = `
MÉTHODOLOGIE DE COMPTAGE PRÉCIS (PROTOCOLE STRICT):
Tu es un EXPERT certifié en inventaire textile hôtelier. Compte AVEC RIGUEUR.

ÉTAPE 1 — IDENTIFIER LE TYPE D'EMPILEMENT:
- "stacked_flat": pliés empilés horizontalement (le plus courant en lingerie hôtelière).
- "stacked_vertical": debout côte à côte (sur tranche).
- "rolled": roulés en cylindres.
- "loose": en vrac, non empilés.

ÉTAPE 2 — IDENTIFIER LES FRONTIÈRES ENTRE ARTICLES:
Chaque article a un BORD PLIÉ visible (un "ourlet" ou "tranche du pli").
La frontière entre 2 articles est marquée par:
  • Une ligne d'ombre fine et continue (créée par l'espace minuscule entre 2 plis).
  • Un changement subtil de teinte ou texture.
  • Un léger décalage horizontal du bord.
NE PAS confondre avec:
  • Les plis INTERNES d'un même article (un drap plié en 4 a 1 ou 2 plis internes
    qui ne sont PAS des frontières).
  • Les coutures décoratives.
  • Les ombres portées par l'éclairage.

ÉTAPE 3 — COMPTER EN NUMÉROTANT (DEUX SENS):
1) Comptage ASCENDANT: numérote chaque article du BAS vers le HAUT: #1, #2, #3, ... #N.
2) Comptage DESCENDANT: recompte du HAUT vers le BAS: #N, #N-1, ... #1.
3) Si les deux totaux DIFFÈRENT, fais un 3ème passage en zoomant mentalement
   sur la zone d'incertitude et tranche.
4) Énumère le résultat dans "counting_detail".

ÉTAPE 4 — VALIDATION GÉOMÉTRIQUE:
- Estime la HAUTEUR totale visible de la pile (en cm).
- Épaisseur moyenne par article: ${avgThickness} cm.
- Vérifie: hauteur_pile / ${avgThickness} ≈ N. Si écart > 25%, recompte.
- Reporte ta hauteur estimée dans "pile_height_cm".

PIÈGES À ÉVITER:
- Un article plié en deux peut paraître être 2 articles → vérifier la continuité
  des bords latéraux (un seul article a des bords ALIGNÉS).
- Articles très fins (taies) qui semblent collés → utiliser les ombres entre couches.
- Haut/bas partiellement coupés par le cadre → estimer en signalant dans "notes".
- Éclairage rasant qui crée de FAUSSES lignes d'ombre → croiser avec la géométrie.

NIVEAU DE CONFIANCE:
- 0.95+ : pile bien éclairée, frontières nettes, deux comptages identiques.
- 0.80-0.95 : pile claire mais 1-2 zones d'incertitude.
- 0.60-0.80 : éclairage moyen ou pile partiellement masquée.
- < 0.60 : conditions difficiles, suggérer une nouvelle photo.
`;

    // QUICK DETECT (live preview - fastest)
    const quickDetectPrompt = `Expert comptage linge hôtellerie. Article: ${linenType.name}.
${countingMethodology}
ÉTAPE 5 — Estime la largeur totale de la pile en cm.

JSON UNIQUEMENT (aucun autre texte):
{"pile":true,"count":N,"confidence":0.0-1.0,"width_cm":N,"pile_type":"stacked_flat|stacked_vertical|rolled|loose|single","position":"center","bounds":{"x":0.1,"y":0.1,"w":0.8,"h":0.8},"counting_detail":"#1 bas, #2, ... #N haut"}

Si AUCUNE pile visible:
{"pile":false,"count":0,"confidence":0,"width_cm":0,"pile_type":"none","position":"center","bounds":{"x":0,"y":0,"w":0,"h":0}}`;
    
    // Detection mode
    const detectPrompt = `Compte précisément les ${linenType.name}.
${countingMethodology}
Estime la largeur en cm. Draps typiques: 200-240cm, serviettes: 50-100cm, taies: 50cm.
JSON uniquement: {"pile":true,"count":N,"confidence":0.X,"width_cm":N,"pile_height_cm":N,"pile_type":"stacked_flat|stacked_vertical|rolled|loose","position":"center","bounds":{"x":0.1,"y":0.1,"w":0.8,"h":0.8},"counting_detail":"#1, #2, ..."}`;
    
    // Live mode
    const livePrompt = `Compte les ${linenType.name} en numérotant chaque article du bas vers le haut.
${countingMethodology}
JSON uniquement: {"count":N,"confidence":0.X,"pile_type":"stacked_flat|stacked_vertical|rolled|loose","counting_detail":"#1, #2, ..."}`;
    
    // RULER MODE (highest precision via measurement)
    const rulerPrompt = `Compte les ${linenType.name} avec la règle visible dans l'image.
${countingMethodology}

PROTOCOLE RÈGLE:
1) Identifie la règle (graduations en cm).
2) Mesure la hauteur EXACTE de la pile en cm (utilise les graduations).
3) Calcule: N = hauteur_cm / ${avgThickness}.
4) Vérifie en comptant visuellement les couches → les 2 méthodes doivent concorder.
5) Si écart > 10%, choisis la méthode visuelle (plus fiable que l'épaisseur moyenne).

JSON uniquement: {"count":N,"confidence":0.9,"ruler_detected":true,"pile_height_cm":N,"measurement_method":"ruler_calculation","counting_detail":"#1, #2, ...","visual_count":N,"calculated_count":N}`;

    // VALIDATION mode (full precision with explicit step-by-step)
    let fullPrompt = `Tu es un EXPERT en inventaire textile hôtelier (15 ans d'expérience).
Article à compter: ${linenType.name}.
${countingMethodology}

EXIGENCES OBLIGATOIRES:
1) Effectue les DEUX comptages (ascendant + descendant).
2) Effectue la VALIDATION GÉOMÉTRIQUE (hauteur / épaisseur).
3) Dans "counting_detail", liste CHAQUE article numéroté: "#1 bas, #2, #3, ..., #N haut".
4) Dans "notes", indique tout doute ou zone difficile (ex: "ombre suspecte entre #4 et #5").
5) Dans "pile_height_cm", reporte ta mesure de hauteur.
6) Si confidence < 0.75, suggère explicitement une nouvelle photo dans "notes".

JSON uniquement: {"count":N,"confidence":0.X,"pile_type":"type","pile_height_cm":N,"notes":"description","counting_detail":"#1 bas, #2, ... #N haut","ascending_count":N,"descending_count":N}`;

    // Get training samples + corrections for improved accuracy (not in quick/live mode)
    if (!liveMode && !quickDetect) {
      const { data: trainingSamples } = await supabase
        .from('linen_training_samples')
        .select('ai_predicted_count, actual_count, notes, scan_method, created_at')
        .eq('linen_type_id', linenTypeId)
        .order('created_at', { ascending: false })
        .limit(15);

      if (trainingSamples && trainingSamples.length > 0) {
        const corrections = trainingSamples.filter(s => s.ai_predicted_count !== s.actual_count);
        if (corrections.length > 0) {
          // Compute systematic bias
          const totalDiff = corrections.reduce((sum, s) => sum + ((s.ai_predicted_count || 0) - s.actual_count), 0);
          const avgBias = totalDiff / corrections.length;
          const biasNote = Math.abs(avgBias) >= 0.5
            ? `\n⚠️ BIAIS SYSTÉMATIQUE DÉTECTÉ: tu as tendance à ${avgBias > 0 ? 'SUR-COMPTER' : 'SOUS-COMPTER'} en moyenne de ${Math.abs(avgBias).toFixed(1)} article(s). CORRIGE ce biais.`
            : '';

          const appendix = `\n\n📚 HISTORIQUE DES CORRECTIONS (${corrections.length} corrections sur les 15 derniers scans):\n` +
            corrections.slice(0, 10).map((sample) => {
              const diff = (sample.ai_predicted_count || 0) - sample.actual_count;
              return diff > 0 
                ? `IA:${sample.ai_predicted_count} → Réel:${sample.actual_count} (sur-compté de ${diff})` 
                : `IA:${sample.ai_predicted_count} → Réel:${sample.actual_count} (sous-compté de ${-diff})`;
            }).join('\n') + biasNote +
            '\n\nUTILISE CES CORRECTIONS pour calibrer ton comptage actuel.';
          
          fullPrompt += appendix;
        }
      }
    }

    // Select the appropriate prompt
    let systemPrompt: string;
    if (quickDetect) {
      systemPrompt = quickDetectPrompt;
    } else if (detectMode) {
      systemPrompt = detectPrompt;
    } else if (liveMode) {
      systemPrompt = livePrompt;
    } else if (useRuler) {
      systemPrompt = rulerPrompt;
    } else {
      systemPrompt = fullPrompt;
    }

    const modeLabel = quickDetect ? 'QUICK' : detectMode ? 'DETECT' : liveMode ? 'LIVE' : useRuler ? 'RULER' : 'VALIDATE';
    console.log(`[count-linen] Mode: ${modeLabel}, Model: ${model}, Thickness: ${avgThickness}cm`);

    // Helper: single AI call returning parsed result
    const callAI = async (prompt: string, temp: number, maxTokens: number, timeoutMs: number) => {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  { type: 'image_url', image_url: { url: image } }
                ]
              }
            ],
            temperature: temp,
            max_tokens: maxTokens
          }),
          signal: ctrl.signal
        });
        clearTimeout(tid);
        return r;
      } catch (e) {
        clearTimeout(tid);
        throw e;
      }
    };

    const parseAIResult = (raw: string): any => {
      try {
        let jsonStr = raw.trim();
        jsonStr = jsonStr.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
        const jsonMatch = jsonStr.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
        if (jsonMatch) jsonStr = jsonMatch[0];
        return JSON.parse(jsonStr);
      } catch {
        return null;
      }
    };

    const timeout = quickDetect ? 8000 : (liveMode || detectMode) ? 10000 : 45000;

    try {
      // ===== PASS 1 =====
      const aiResponse = await callAI(systemPrompt, 0, quickDetect ? 120 : (liveMode || detectMode) ? 200 : 500, timeout);

      // Handle specific error codes
      if (aiResponse.status === 402) {
        console.error('[count-linen] 402 - Insufficient AI credits');
        return new Response(
          JSON.stringify({ 
            error: 'AI_CREDITS_INSUFFICIENT',
            message: 'Crédits IA insuffisants. Utilisez le mode manuel.',
            fallback: 'manual'
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (aiResponse.status === 429) {
        console.error('[count-linen] 429 - Rate limited');
        return new Response(
          JSON.stringify({ 
            error: 'RATE_LIMITED',
            message: 'Trop de requêtes. Réessayez dans quelques secondes.',
            fallback: 'retry'
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('[count-linen] AI Gateway error:', aiResponse.status, errorText);
        return new Response(
          JSON.stringify({ error: 'AI service error', details: errorText }),
          { status: aiResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const aiData = await aiResponse.json();
      logAiUsage(aiData, model);
      const aiContent = aiData.choices?.[0]?.message?.content || '';
      let result = parseAIResult(aiContent);
      if (!result) {
        console.error('[count-linen] Parse failed, raw:', aiContent.substring(0, 100));
        result = {
          pile: false, count: 0, confidence: 0, width_cm: 0,
          position: 'center', bounds: { x: 0, y: 0, w: 0, h: 0 },
          notes: 'Detection failed - try repositioning'
        };
      }

      // ===== MULTI-PASS CONSENSUS (VALIDATE mode) — best-of-3 majority vote =====
      // Run extra independent recounts to converge towards 99% reliability.
      // Triggered whenever the first pass isn't already near-certain.
      const shouldConsensus = !liveMode && !quickDetect && !detectMode && !useRuler
        && result.count > 0
        && (result.count > 3 || (result.confidence ?? 0) < 0.95);

      if (shouldConsensus) {
        const votes: number[] = [Number(result.count)];
        const resultsByCount: Record<number, any> = { [result.count]: result };

        const runRecount = async (temp: number) => {
          try {
            const consensusPrompt = systemPrompt +
              `\n\nRECOMPTE INDÉPENDAMMENT depuis zéro (n'utilise aucune estimation précédente).` +
              `\nApplique le double comptage (ascendant + descendant) et la validation géométrique.`;
            const r2 = await callAI(consensusPrompt, temp, 500, 30000);
            if (!r2.ok) return null;
            const d2 = await r2.json();
            logAiUsage(d2, model);
            const parsed = parseAIResult(d2.choices?.[0]?.message?.content || '');
            if (parsed && typeof parsed.count === 'number') {
              votes.push(Number(parsed.count));
              resultsByCount[parsed.count] = parsed;
              return parsed;
            }
          } catch (e) {
            console.warn('[count-linen] Recount failed:', (e as Error).message);
          }
          return null;
        };

        // Two more independent passes (deterministic + slight variation)
        await runRecount(0);
        // Only run the 3rd pass if the first two disagree (saves time when they agree)
        if (votes[0] !== votes[1]) {
          await runRecount(0.15);
        }

        // Tally votes → pick the majority count
        const tally: Record<number, number> = {};
        for (const v of votes) tally[v] = (tally[v] || 0) + 1;
        let bestCount = votes[0];
        let bestVotes = 0;
        for (const [c, n] of Object.entries(tally)) {
          if (n > bestVotes) { bestVotes = n; bestCount = Number(c); }
        }

        console.log(`[count-linen] Consensus votes=${JSON.stringify(votes)} → ${bestCount} (${bestVotes}/${votes.length})`);

        const chosen = resultsByCount[bestCount] || result;
        if (bestVotes === votes.length) {
          // Unanimous → maximum confidence
          result = { ...chosen, confidence: 0.99, notes: (chosen.notes || '') + ` [Consensus unanime ${votes.length} passes]` };
        } else if (bestVotes >= 2) {
          // Majority agreement
          result = { ...chosen, confidence: Math.max(0.9, chosen.confidence || 0.9), notes: (chosen.notes || '') + ` [Majorité ${bestVotes}/${votes.length}: ${bestCount}]` };
        } else {
          // No agreement → keep first pass but flag uncertainty
          result = { ...result, confidence: Math.min(result.confidence || 0.7, 0.8), notes: (result.notes || '') + ` [Désaccord: passes=${votes.join(',')}]` };
        }
      }

      // ===== GEOMETRIC VALIDATION (cross-check via thickness) =====
      if (!quickDetect && !liveMode && result.pile_height_cm && result.count > 0 && avgThickness > 0) {
        const expectedCount = result.pile_height_cm / avgThickness;
        const ratio = result.count / expectedCount;
        if (ratio < 0.6 || ratio > 1.6) {
          // Big mismatch → lower confidence and warn
          result.confidence = Math.min(result.confidence || 0.5, 0.65);
          result.notes = (result.notes || '') + ` [⚠️ Vérification géométrique: ${result.count} articles vs ${expectedCount.toFixed(1)} attendus (${result.pile_height_cm}cm / ${avgThickness}cm)]`;
        }
      }

      console.log(`[count-linen] Final: count=${result.count}, confidence=${result.confidence}, mode=${modeLabel}`);

      // Build response with detection-specific fields
      const response: any = {
        count: result.count || 0,
        confidence: result.confidence || 0,
        notes: result.notes || '',
        counting_detail: result.counting_detail || '',
        linenType: linenType.name,
        model: model,
        mode: modeLabel.toLowerCase(),
        // Ruler-specific fields
        ruler_detected: result.ruler_detected || false,
        pile_height_cm: result.pile_height_cm || null,
        measurement_method: result.measurement_method || 'visual_count',
        item_thickness_cm: avgThickness,
        ascending_count: result.ascending_count ?? null,
        descending_count: result.descending_count ?? null,
      };

      // Add detection-specific fields
      if (detectMode || quickDetect) {
        response.detected_type = result.detected_type || null;
        response.type_match = result.type_match !== undefined ? result.type_match : true;
        response.dimensions = result.dimensions || { width_cm: result.width_cm || null, height_cm: null };
        response.pile_detected = result.pile_detected ?? result.pile ?? false;
        response.pile_type = result.pile_type || 'stacked_flat';
        response.pile_position = result.position || 'center';
        response.pile_bounds = result.bounds || null;
      }
      
      if (result.pile_type) {
        response.pile_type = result.pile_type;
      }

      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError') {
        console.error('[count-linen] Request timeout');
        return new Response(
          JSON.stringify({ 
            error: 'TIMEOUT',
            message: 'Délai dépassé. Réessayez.',
            fallback: 'retry'
          }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw fetchError;
    }

  } catch (error) {
    console.error('[count-linen] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message, fallback: 'manual' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
