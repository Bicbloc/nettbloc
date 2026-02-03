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

    // Model selection - Use better model for counting accuracy
    let model = 'google/gemini-2.5-flash';
    if (quickDetect) {
      model = 'google/gemini-2.5-flash'; // Better model for accuracy
    } else if (detectMode || liveMode) {
      model = 'google/gemini-2.5-flash';
    } else if (useRuler) {
      model = 'google/gemini-2.5-pro';
    }
    
    // ========== IMPROVED PROMPTS FOR COUNTING ==========
    
    // QUICK DETECT - Clear counting instructions
    const quickDetectPrompt = `You are an expert at counting folded linen items in a stack/pile.

TASK: Count the number of ${linenType.name} items in this image.

COUNTING METHOD:
1. Look for a stack/pile of folded fabric
2. Count the horizontal layers/folds visible from the side
3. Each distinct horizontal layer = 1 item
4. If items are ${avgThickness}cm thick each, estimate based on pile height

RESPOND WITH ONLY THIS JSON (no other text):
{"pile":true,"count":NUMBER,"confidence":0.0-1.0,"width_cm":WIDTH_IN_CM,"position":"center","bounds":{"x":0.1,"y":0.1,"w":0.8,"h":0.8}}

If NO pile visible:
{"pile":false,"count":0,"confidence":0,"width_cm":0,"position":"center","bounds":{"x":0,"y":0,"w":0,"h":0}}`;
    
    // Detection mode
    const detectPrompt = `Count folded linen items. Each layer = 1 item.
Estimate width in cm. Common: sheets 200-240cm, towels 50-100cm, pillowcases 50cm.
JSON only: {"pile":true,"count":N,"confidence":0.X,"width_cm":N,"position":"center","bounds":{"x":0.1,"y":0.1,"w":0.8,"h":0.8}}`;
    
    // Live mode
    const livePrompt = `Count ${linenType.name} items in the pile. Each horizontal fold/layer = 1 item.
JSON only: {"count":N,"confidence":0.X}`;
    
    // RULER MODE
    const rulerPrompt = `Count ${linenType.name} using ruler measurement. Each item ≈ ${avgThickness}cm thick.
Calculate: pile_height_cm / ${avgThickness} = count
JSON only: {"count":N,"confidence":0.9,"ruler_detected":true,"pile_height_cm":N,"measurement_method":"ruler_calculation"}`;

    // VALIDATION mode
    let fullPrompt = `Expert linen counting for ${linenType.name}.
Count horizontal layers/folds. Each layer = 1 item (${avgThickness}cm thick).
Be precise. JSON only: {"count":N,"confidence":0.X,"notes":"description"}`;

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

    // Call Lovable AI - Reasonable timeouts
    const controller = new AbortController();
    const timeout = quickDetect ? 8000 : (liveMode || detectMode) ? 10000 : 30000;
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
          max_tokens: quickDetect ? 120 : (liveMode || detectMode) ? 150 : 300
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
      
      // Parse AI response - handle markdown blocks, incomplete JSON, text responses
      let result;
      try {
        let jsonStr = aiContent.trim();
        
        // Remove markdown code blocks
        jsonStr = jsonStr.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
        
        // Extract JSON object
        const jsonMatch = jsonStr.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
        
        // Try to parse
        result = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('[count-linen] Parse failed, raw:', aiContent.substring(0, 100));
        
        // Fallback: return default detection result
        result = {
          pile: false,
          count: 0,
          confidence: 0,
          width_cm: 0,
          position: 'center',
          bounds: { x: 0, y: 0, w: 0, h: 0 },
          notes: 'Detection failed - try repositioning'
        };
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
        response.dimensions = result.dimensions || { width_cm: result.width_cm || null, height_cm: null };
        response.pile_detected = result.pile_detected ?? result.pile ?? false;
        
        // Pile position and bounds for UI display
        response.pile_position = result.position || 'center';
        response.pile_bounds = result.bounds || null;
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
