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

    // Model selection - OPTIMIZED for speed
    // - quickDetect: ultra-fast for live stabilization (~300ms)
    // - detectMode/liveMode: fast model for real-time preview
    // - useRuler: powerful model for precise measurement
    // - validation (normal): balanced flash model
    let model = 'google/gemini-2.5-flash';
    if (quickDetect) {
      model = 'google/gemini-2.5-flash-lite'; // Fastest for live tracking
    } else if (detectMode || liveMode) {
      model = 'google/gemini-2.5-flash-lite';
    } else if (useRuler) {
      model = 'google/gemini-2.5-pro'; // Most powerful for ruler detection
    }
    
    // ========== PROMPT SELECTION ==========

    // QUICK DETECT - Ultra-minimal prompt for live preview (~30 tokens)
    const quickDetectPrompt = `Pile de ${linenType.name} visible? Compte rapide. JSON: {"pile":true/false,"count":N,"confidence":0-1}`;
    
    // Detection mode prompt - for identifying linen type by dimensions
    const detectPrompt = `Expert identification linge hôtel.

TYPES: ${allLinenTypes.map(t => `${t.name}${t.dimensions ? ` (${t.dimensions})` : ''}`).join(', ')}

Identifie type, estime dimensions (cm), compte pièces.
DRAPS: >150cm | SERVIETTES: 50-100cm | TAIES: ~50x70cm

JSON: {"detected_type":"...","count":N,"confidence":0-1,"dimensions":{"width_cm":X,"height_cm":Y},"pile_detected":true/false}`;
    
    // Simplified prompt for live mode
    const livePrompt = `Compte "${linenType.name}" dans l'image. JSON: {"count":N,"confidence":0-1}`;
    
    // RULER MODE: Specialized prompt for ruler-based measurement
    const rulerPrompt = `Expert mesure linge avec règle étalon.
OBJET: "${linenType.name}" | ÉPAISSEUR: ${avgThickness}cm/pièce

Cherche règle colorée 0-30cm. Si détectée:
1. Calibre échelle (px/cm)
2. Mesure hauteur pile
3. Calcul: hauteur_cm ÷ ${avgThickness} = nombre

JSON: {"count":N,"confidence":0-1,"ruler_detected":true/false,"pile_height_cm":X.X,"measurement_method":"ruler_calculation"|"visual_count"}`;

    // Full prompt for VALIDATION mode (final precise count)
    let fullPrompt = `Expert comptage linge d'hôtel - VALIDATION FINALE.

OBJET: "${linenType.name}" | ÉPAISSEUR: ${avgThickness}cm

MÉTHODE COMPTAGE PILE:
1. Compte les STRATES horizontales visibles sur le côté
2. Chaque ligne distincte = 1 pièce
3. Vérification: hauteur estimée ÷ ${avgThickness}

RÈGLES:
- SOUS-ESTIME si incertitude
- Ombres ≠ pièces
- Plis internes ≠ pièces séparées

CONFIANCE: 0.9+ (séparées) | 0.7-0.89 (strates nettes) | 0.5-0.69 (estimation)

JSON: {"count":N,"confidence":0-1,"notes":"méthode"}`;

    // Get training samples + corrections for improved accuracy (not in quick/live mode)
    if (!liveMode && !quickDetect) {
      const { data: trainingSamples } = await supabase
        .from('linen_training_samples')
        .select('ai_predicted_count, actual_count, notes, scan_method, created_at')
        .eq('linen_type_id', linenTypeId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (trainingSamples && trainingSamples.length > 0) {
        const corrections = trainingSamples.filter(s => s.ai_predicted_count !== s.actual_count);
        if (corrections.length > 0) {
          const appendix = '\n\n⚠️ CORRECTIONS PASSÉES:\n' +
            corrections.map((sample) => {
              const diff = (sample.ai_predicted_count || 0) - sample.actual_count;
              return diff > 0 
                ? `IA:${sample.ai_predicted_count}→Réel:${sample.actual_count} (−${diff})` 
                : `IA:${sample.ai_predicted_count}→Réel:${sample.actual_count} (+${-diff})`;
            }).join(' | ');
          
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

    // Call Lovable AI with vision - OPTIMIZED timeouts
    const controller = new AbortController();
    const timeout = quickDetect ? 5000 : (liveMode || detectMode) ? 8000 : 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
                { type: 'text', text: systemPrompt },
                { type: 'image_url', image_url: { url: image } }
              ]
            }
          ],
          temperature: 0.1,
          max_tokens: quickDetect ? 50 : (liveMode || detectMode) ? 100 : 300
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

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
      const aiContent = aiData.choices?.[0]?.message?.content || '';
      
      // Parse AI response
      let result;
      try {
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : aiContent;
        result = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('[count-linen] Failed to parse AI response:', aiContent);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to parse AI response',
            rawResponse: aiContent,
            fallback: 'manual'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[count-linen] Result: count=${result.count}, confidence=${result.confidence}, mode=${modeLabel}`);

      // Build response with detection-specific fields
      const response: any = {
        count: result.count || 0,
        confidence: result.confidence || 0,
        notes: result.notes || '',
        linenType: linenType.name,
        model: model,
        mode: modeLabel.toLowerCase(),
        // Ruler-specific fields
        ruler_detected: result.ruler_detected || false,
        pile_height_cm: result.pile_height_cm || null,
        measurement_method: result.measurement_method || 'visual_count',
        item_thickness_cm: avgThickness
      };

      // Add detection-specific fields
      if (detectMode || quickDetect) {
        response.detected_type = result.detected_type || null;
        response.type_match = result.type_match !== undefined ? result.type_match : true;
        response.dimensions = result.dimensions || { width_cm: null, height_cm: null };
        response.pile_detected = result.pile_detected ?? result.pile ?? false;
      }

      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (fetchError: any) {
      clearTimeout(timeoutId);
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
