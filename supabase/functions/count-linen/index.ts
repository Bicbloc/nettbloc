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
    const { image, linenTypeId, hotelId } = await req.json();
    
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

    // Get training samples for this linen type
    const { data: trainingSamples, error: samplesError } = await supabase
      .from('linen_training_samples')
      .select('actual_count, notes')
      .eq('linen_type_id', linenTypeId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Build prompt with few-shot examples
    let examplesText = '';
    if (trainingSamples && trainingSamples.length > 0) {
      examplesText = '\n\nVoici des exemples de comptages précédents pour ce type de linge:\n';
      trainingSamples.forEach((sample, idx) => {
        examplesText += `Exemple ${idx + 1}: ${sample.actual_count} pièces`;
        if (sample.notes) examplesText += ` (${sample.notes})`;
        examplesText += '\n';
      });
    }

    const systemPrompt = `Tu es un expert en comptage de linge d'hôtel. Tu dois analyser des photos de piles de linge et compter le nombre exact de pièces visibles.

Informations sur le type de linge à compter:
- Nom: ${linenType.name}
- Catégorie: ${linenType.category}
${linenType.dimensions ? `- Dimensions: ${linenType.dimensions}` : ''}
${linenType.color ? `- Couleur: ${linenType.color}` : ''}
${examplesText}

Instructions:
1. Analyse attentivement l'image pour compter chaque pièce de linge
2. Fais attention aux plis et superpositions qui peuvent cacher des pièces
3. Si des pièces sont partiellement visibles, compte-les si tu peux identifier qu'il s'agit bien d'une pièce séparée
4. Donne un nombre entier précis
5. Indique ton niveau de confiance (0.0 à 1.0)

Réponds UNIQUEMENT avec un JSON valide au format suivant (sans markdown):
{"count": nombre_de_pieces, "confidence": niveau_de_confiance, "notes": "observations_optionnelles"}`;

    // Call Lovable AI with vision
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Compte le nombre de pièces de linge dans cette image.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: image
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
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
      // Remove markdown code blocks if present
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : aiContent;
      result = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiContent);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to parse AI response',
          rawResponse: aiContent 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        count: result.count || 0,
        confidence: result.confidence || 0,
        notes: result.notes || '',
        linenType: linenType.name
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in count-linen:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});