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
    const { image, linenTypeId, hotelId, liveMode = false } = await req.json();
    
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

    // Get linen type details
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

    // Use different models based on mode
    // Live mode: ultra-fast lightweight model for real-time detection
    // Normal mode: balanced flash model for accuracy with good speed
    const model = liveMode ? 'google/gemini-2.5-flash-lite' : 'google/gemini-2.5-flash';
    
    // Simplified prompt for live mode (fewer tokens = faster + cheaper)
    const livePrompt = `Compte le linge "${linenType.name}" dans l'image. Réponds JSON: {"count": N, "confidence": 0-1}`;
    
    // Full prompt for normal mode
    let fullPrompt = `Tu es un expert en comptage de linge d'hôtel. Compte le nombre EXACT de "${linenType.name}" (${linenType.category || 'linge'}) dans cette image.

Informations:
- Nom: ${linenType.name}
- Catégorie: ${linenType.category || 'Non spécifiée'}
${linenType.dimensions ? `- Dimensions: ${linenType.dimensions}` : ''}
${linenType.color ? `- Couleur: ${linenType.color}` : ''}

MÉTHODE:
1. Examine toute l'image systématiquement
2. Identifie les bords et coins de chaque pièce
3. Pour les piles: compte les couches visibles
4. Ne compte pas les ombres ou plis

CONFIANCE:
- 0.9-1.0: Pièces clairement visibles
- 0.7-0.89: Quelques zones d'ombre
- 0.5-0.69: Superpositions difficiles
- <0.5: Image floue ou pile compacte

Réponds UNIQUEMENT en JSON: {"count": N, "confidence": 0-1, "notes": "observations"}`;

    // Get training samples for normal mode only (saves API calls in live mode)
    if (!liveMode) {
      const { data: trainingSamples } = await supabase
        .from('linen_training_samples')
        .select('actual_count, notes')
        .eq('linen_type_id', linenTypeId)
        .order('created_at', { ascending: false })
        .limit(3);

      if (trainingSamples && trainingSamples.length > 0) {
        fullPrompt += '\n\nExemples précédents:\n';
        trainingSamples.forEach((sample, idx) => {
          fullPrompt += `- ${sample.actual_count} pièces${sample.notes ? ` (${sample.notes})` : ''}\n`;
        });
      }
    }

    const systemPrompt = liveMode ? livePrompt : fullPrompt;

    console.log(`[count-linen] Mode: ${liveMode ? 'LIVE' : 'NORMAL'}, Model: ${model}`);

    // Call Lovable AI with vision
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
        max_tokens: liveMode ? 100 : 300
      })
    });

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

    console.log(`[count-linen] Result: count=${result.count}, confidence=${result.confidence}`);

    return new Response(
      JSON.stringify({
        count: result.count || 0,
        confidence: result.confidence || 0,
        notes: result.notes || '',
        linenType: linenType.name,
        model: model,
        mode: liveMode ? 'live' : 'normal'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[count-linen] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message, fallback: 'manual' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
