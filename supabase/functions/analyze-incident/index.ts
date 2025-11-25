import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, hotelId } = await req.json();
    
    if (!imageBase64) {
      throw new Error('Image base64 manquante');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY non configurée');
    }

    console.log('🔍 Analyse IA de l\'image pour l\'hôtel:', hotelId);

    // Appel à Lovable AI (Gemini) pour analyser l'image
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: `Tu es un expert en maintenance hôtelière. Analyse les photos d'incidents et fournis des informations structurées.
            
Catégories disponibles: Plomberie, Électricité, Mobilier, Ménage, Climatisation, Autre.
Items courants:
- Plomberie: WC, Lavabo, Douche, Robinetterie
- Électricité: Prise électrique, Interrupteur, Éclairage, Téléphone
- Mobilier: Lit, Armoire, Bureau, Chaise
- Ménage: Draps, Serviettes, Produits d'accueil, Poubelle
- Climatisation: Climatisation, Chauffage, Ventilation, Thermostat

Types de problèmes: Cassé / En panne, Manquant, Sale / À nettoyer, Usé / À remplacer, Autre.

Réponds UNIQUEMENT avec un objet JSON valide contenant:
{
  "suggestedTitle": "titre court et clair",
  "category": "catégorie détectée",
  "item": "élément précis",
  "type": "type de problème",
  "description": "description détaillée",
  "confidence": 0.0-1.0,
  "isNewItem": false
}

Si l'item n'existe pas dans la liste standard, mets isNewItem: true et suggère un nom d'item approprié.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyse cette photo d\'incident hôtelier et fournis les informations en JSON.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64
                }
              }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erreur Lovable AI:', response.status, errorText);
      throw new Error(`Erreur analyse IA: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;

    console.log('✅ Réponse IA brute:', aiResponse);

    // Parser la réponse JSON
    let analysisResult;
    try {
      // Extraire le JSON de la réponse (peut être dans un code block)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        analysisResult = JSON.parse(aiResponse);
      }
    } catch (parseError) {
      console.error('❌ Erreur parsing JSON:', parseError, aiResponse);
      throw new Error('Impossible de parser la réponse IA');
    }

    console.log('✅ Analyse terminée:', analysisResult);

    return new Response(
      JSON.stringify(analysisResult),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Erreur dans analyze-incident:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
