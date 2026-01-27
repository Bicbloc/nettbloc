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
    
    // Full prompt for normal mode - AMÉLIORÉ pour les piles
    let fullPrompt = `Tu es un expert en comptage de linge d'hôtel avec une spécialisation dans le comptage de piles.

OBJET À COMPTER: "${linenType.name}" (${linenType.category || 'linge'})
${linenType.dimensions ? `Dimensions: ${linenType.dimensions}` : ''}
${linenType.color ? `Couleur: ${linenType.color}` : ''}

## MÉTHODE POUR LES PILES DE LINGE

### Étape 1: Analyse de la structure
- Identifie si le linge est posé à plat, plié, ou en pile
- Pour les piles: observe l'épaisseur totale et l'épaisseur d'UNE pièce

### Étape 2: Comptage des couches
- Compte les PLIS visibles sur le côté de la pile
- Chaque pli = 1 pièce
- Si tu vois N plis distincts, il y a N pièces

### Étape 3: Vérification
- Épaisseur typique d'un drap plié: 1-2 cm
- Épaisseur typique d'une serviette pliée: 2-4 cm
- Divise l'épaisseur totale par l'épaisseur d'une pièce

### ERREURS À ÉVITER
❌ Ne pas compter les ombres comme des pièces
❌ Ne pas confondre un pli de tissu avec une pièce séparée
❌ Ne pas surestimer: en cas de doute, compte MOINS
❌ Les bords repliés d'une même pièce ne sont PAS des pièces supplémentaires

### RÈGLE D'OR POUR LES PILES
Si tu vois une pile compacte et homogène:
1. Compte les STRATES distinctes (lignes horizontales sur le côté)
2. Chaque strate = 1 pièce
3. En cas d'incertitude, SOUS-ESTIME plutôt que surestimer

CONFIANCE:
- 0.9-1.0: Pièces séparées, clairement visibles une par une
- 0.7-0.89: Pile avec strates bien définies
- 0.5-0.69: Pile compacte, estimation nécessaire
- <0.5: Impossible de distinguer les couches

Réponds UNIQUEMENT en JSON: {"count": N, "confidence": 0-1, "notes": "méthode utilisée et observations"}`;

    // Get training samples + corrections for improved accuracy
    if (!liveMode) {
      const { data: trainingSamples } = await supabase
        .from('linen_training_samples')
        .select('ai_count, actual_count, notes, created_at')
        .eq('linen_type_id', linenTypeId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (trainingSamples && trainingSamples.length > 0) {
        const corrections = trainingSamples.filter(s => s.ai_count !== s.actual_count);
        if (corrections.length > 0) {
          fullPrompt += '\n\n## APPRENTISSAGE DES ERREURS PASSÉES\n';
          fullPrompt += 'Voici des corrections récentes - adapte ton comptage en conséquence:\n';
          corrections.forEach((sample) => {
            const diff = (sample.ai_count || 0) - sample.actual_count;
            if (diff > 0) {
              fullPrompt += `- L'IA avait compté ${sample.ai_count}, mais il y avait en réalité ${sample.actual_count} (SURESTIMATION de ${diff})${sample.notes ? ` - ${sample.notes}` : ''}\n`;
            } else {
              fullPrompt += `- L'IA avait compté ${sample.ai_count}, mais il y avait en réalité ${sample.actual_count} (SOUS-ESTIMATION de ${-diff})${sample.notes ? ` - ${sample.notes}` : ''}\n`;
            }
          });
          fullPrompt += '\n⚠️ Tendance détectée: ajuste ton comptage en fonction de ces corrections.\n';
        }
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
