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
    const { image, linenTypeId, hotelId, liveMode = false, useRuler = false } = await req.json();
    
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

    // Get average thickness (default 2cm if not configured)
    const avgThickness = linenType.average_thickness_cm || 2.0;

    // Model selection:
    // - Live mode: ultra-fast for real-time preview
    // - Ruler mode: use powerful model for precise measurement
    // - Normal mode: balanced flash model
    let model = 'google/gemini-2.5-flash';
    if (liveMode) {
      model = 'google/gemini-2.5-flash-lite';
    } else if (useRuler) {
      model = 'google/gemini-2.5-pro'; // Most powerful for ruler detection
    }
    
    // Simplified prompt for live mode
    const livePrompt = `Compte le linge "${linenType.name}" dans l'image. Réponds JSON: {"count": N, "confidence": 0-1}`;
    
    // RULER MODE: Specialized prompt for ruler-based measurement
    const rulerPrompt = `Tu es un expert en mesure et comptage de linge avec règle étalon.

OBJET: "${linenType.name}" (${linenType.category || 'linge'})
ÉPAISSEUR CONNUE: ${avgThickness} cm par pièce pliée

## ÉTAPE 1: DÉTECTER LA RÈGLE ÉTALON
Cherche une règle colorée graduée (0-30cm) avec des bandes alternées:
- Rouge (0-5cm), Orange (5-10cm), Jaune (10-15cm), Vert (15-20cm), Bleu (20-25cm), Violet (25-30cm)

Si règle détectée:
1. Calibre l'échelle (pixels par cm)
2. Mesure la HAUTEUR TOTALE de la pile en cm
3. CALCUL: nombre = hauteur_cm ÷ ${avgThickness}
4. Arrondir au nombre entier le plus proche

## ÉTAPE 2: VÉRIFICATION VISUELLE
- Compte les strates/plis horizontaux visibles sur le côté
- Compare avec le calcul mathématique
- En cas de différence, privilégie le calcul si la règle est claire

## RÉPONSE JSON OBLIGATOIRE
{
  "count": N,
  "confidence": 0-1,
  "ruler_detected": true/false,
  "pile_height_cm": X.X,
  "measurement_method": "ruler_calculation" | "visual_count",
  "notes": "Description de la méthode"
}`;

    // Full prompt for normal mode (improved for stacks)
    let fullPrompt = `Tu es un expert en comptage de linge d'hôtel avec une spécialisation dans le comptage de piles.

OBJET À COMPTER: "${linenType.name}" (${linenType.category || 'linge'})
${linenType.dimensions ? `Dimensions: ${linenType.dimensions}` : ''}
${linenType.color ? `Couleur: ${linenType.color}` : ''}
ÉPAISSEUR MOYENNE PLIÉE: ${avgThickness} cm

## MÉTHODE POUR LES PILES DE LINGE

### Étape 1: Analyse de la structure
- Identifie si le linge est posé à plat, plié, ou en pile
- Pour les piles: observe l'épaisseur totale et l'épaisseur d'UNE pièce

### Étape 2: Comptage des couches
- Compte les PLIS/STRATES visibles sur le côté de la pile
- Chaque strate horizontale distincte = 1 pièce
- Si tu vois N strates distinctes, il y a N pièces

### Étape 3: Vérification mathématique
- Estime l'épaisseur totale de la pile
- Divise par ${avgThickness} cm (épaisseur connue de ce type)
- Compare avec le comptage visuel

### ERREURS À ÉVITER
❌ Ne pas compter les ombres comme des pièces
❌ Ne pas confondre un pli de tissu avec une pièce séparée
❌ Ne pas surestimer: en cas de doute, compte MOINS
❌ Les bords repliés d'une même pièce ne sont PAS des pièces supplémentaires
❌ Une pile haute mais fine = MOINS de pièces qu'on pense

### RÈGLE D'OR POUR LES PILES
Si tu vois une pile compacte et homogène:
1. Compte les STRATES distinctes (lignes horizontales sur le côté)
2. Si pile dense sans strates visibles: estimation = hauteur estimée ÷ ${avgThickness}
3. En cas d'incertitude, SOUS-ESTIME plutôt que surestimer

CONFIANCE:
- 0.9-1.0: Pièces séparées, clairement visibles une par une
- 0.7-0.89: Pile avec strates bien définies
- 0.5-0.69: Pile compacte, estimation nécessaire
- <0.5: Impossible de distinguer les couches

Réponds UNIQUEMENT en JSON: {"count": N, "confidence": 0-1, "notes": "méthode utilisée"}`;

    // Get training samples + corrections for improved accuracy (not in live mode)
    if (!liveMode) {
      const { data: trainingSamples } = await supabase
        .from('linen_training_samples')
        .select('ai_predicted_count, actual_count, notes, scan_method, created_at')
        .eq('linen_type_id', linenTypeId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (trainingSamples && trainingSamples.length > 0) {
        const corrections = trainingSamples.filter(s => s.ai_predicted_count !== s.actual_count);
        if (corrections.length > 0) {
          const appendix = '\n\n## ⚠️ APPRENTISSAGE DES ERREURS PASSÉES\n' +
            'Voici des corrections récentes - adapte ton comptage en conséquence:\n' +
            corrections.map((sample) => {
              const diff = (sample.ai_predicted_count || 0) - sample.actual_count;
              const method = sample.scan_method || 'pile';
              if (diff > 0) {
                return `- Méthode ${method}: L'IA avait compté ${sample.ai_predicted_count}, mais il y avait en réalité ${sample.actual_count} (SURESTIMATION de ${diff})${sample.notes ? ` - ${sample.notes}` : ''}`;
              } else {
                return `- Méthode ${method}: L'IA avait compté ${sample.ai_predicted_count}, mais il y avait en réalité ${sample.actual_count} (SOUS-ESTIMATION de ${-diff})${sample.notes ? ` - ${sample.notes}` : ''}`;
              }
            }).join('\n') +
            '\n\n⚠️ Tendance détectée: ajuste ton comptage en fonction de ces corrections.\n';
          
          fullPrompt += appendix;
          // Also add to ruler prompt if using ruler
        }
      }
    }

    // Select the appropriate prompt
    let systemPrompt = liveMode ? livePrompt : (useRuler ? rulerPrompt : fullPrompt);

    console.log(`[count-linen] Mode: ${liveMode ? 'LIVE' : useRuler ? 'RULER' : 'NORMAL'}, Model: ${model}, Thickness: ${avgThickness}cm`);

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
        max_tokens: liveMode ? 100 : 500
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

    console.log(`[count-linen] Result: count=${result.count}, confidence=${result.confidence}, ruler=${result.ruler_detected || false}`);

    return new Response(
      JSON.stringify({
        count: result.count || 0,
        confidence: result.confidence || 0,
        notes: result.notes || '',
        linenType: linenType.name,
        model: model,
        mode: liveMode ? 'live' : (useRuler ? 'ruler' : 'normal'),
        // Ruler-specific fields
        ruler_detected: result.ruler_detected || false,
        pile_height_cm: result.pile_height_cm || null,
        measurement_method: result.measurement_method || 'visual_count',
        item_thickness_cm: avgThickness
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