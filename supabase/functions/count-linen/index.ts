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

    const systemPrompt = `Tu es un expert en comptage de linge d'hôtel avec une grande expérience. Tu dois analyser des photos de piles de linge et compter le nombre EXACT de pièces visibles avec précision.

Informations sur le type de linge à compter:
- Nom: ${linenType.name}
- Catégorie: ${linenType.category}
${linenType.dimensions ? `- Dimensions approximatives: ${linenType.dimensions}` : ''}
${linenType.color ? `- Couleur typique: ${linenType.color}` : ''}
${examplesText}

MÉTHODOLOGIE DE COMPTAGE (TRÈS IMPORTANT):
1. 📸 Examine TOUTE l'image de manière systématique, de haut en bas, de gauche à droite
2. 🔍 Identifie les BORDS et COINS de chaque pièce - chaque coin visible = une pièce potentielle
3. 📐 Compte les PLIS et SUPERPOSITIONS: si tu vois plusieurs couches, estime combien de pièces sont empilées
4. 🎯 Pour les PILES: observe l'épaisseur, les bords qui dépassent, les variations de couleur entre les couches
5. ✅ Compte une pièce SI: tu vois au moins 2 bords/coins distincts OU une épaisseur claire OU un bord qui dépasse
6. ⚠️ NE compte PAS: les ombres, les plis d'une même pièce, les reflets

EXEMPLES DE COMPTAGE:
- Pile bien alignée: compte l'épaisseur visible (chaque "couche" = 1 pièce)
- Pile désordonnée: compte chaque bord/coin visible séparément
- Pièce pliée en deux: = 1 seule pièce (même si tu vois 2 épaisseurs)
- Draps roulés: estime par la largeur du rouleau (ex: rouleau épais ≈ 2-3 draps)

NIVEAU DE CONFIANCE:
- 0.9-1.0: Toutes les pièces sont clairement visibles et distinctes
- 0.7-0.89: Bonne visibilité mais quelques zones d'ombre ou superpositions
- 0.5-0.69: Plusieurs pièces superposées difficiles à distinguer
- 0.3-0.49: Image floue, pile très compacte, beaucoup d'incertitude
- 0.0-0.29: Impossible de compter avec précision

NOTES UTILES À AJOUTER:
- Mentionne si des pièces sont partiellement cachées
- Indique si la pile est trop compacte pour un comptage précis
- Suggère de reprendre la photo si nécessaire (confiance < 0.6)
- Décris brièvement ce que tu vois (ex: "pile de 5 serviettes blanches pliées")

Réponds UNIQUEMENT avec un JSON valide au format suivant (sans markdown, sans \`\`\`):
{"count": nombre_exact, "confidence": niveau_confiance, "notes": "description_et_observations"}`;

    // Call Lovable AI with vision
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
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