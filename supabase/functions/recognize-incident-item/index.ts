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
    const { imageBase64, imageUrl, context } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Prepare image content
    let imageContent: { type: string; image_url?: { url: string }; text?: string }[] = [];
    
    if (imageBase64) {
      imageContent.push({
        type: "image_url",
        image_url: { url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}` }
      });
    } else if (imageUrl) {
      imageContent.push({
        type: "image_url",
        image_url: { url: imageUrl }
      });
    }

    const systemPrompt = `Tu es un assistant expert en identification d'incidents hôteliers.
Analyse l'image fournie et identifie:
1. La CATÉGORIE de l'élément (Plomberie, Électricité, Mobilier, Ménage, Climatisation, Autre)
2. L'ITEM spécifique (WC, Lavabo, Douche, Robinetterie, Prise électrique, Interrupteur, Éclairage, Lit, Armoire, Bureau, Chaise, Climatisation, Chauffage, etc.)
3. Le TYPE de problème (Cassé/En panne, Manquant, Sale/À nettoyer, Usé/À remplacer, Fuite, Autre)
4. La GRAVITÉ estimée (low, medium, high, urgent)
5. Une DESCRIPTION courte du problème visible

Réponds UNIQUEMENT en JSON valide avec cette structure:
{
  "category": "string",
  "item": "string", 
  "problem_type": "string",
  "severity": "low|medium|high|urgent",
  "description": "string",
  "confidence": 0.0-1.0,
  "suggested_title": "string"
}`;

    const userPrompt = `Analyse cette image d'un incident dans une chambre d'hôtel.${context ? `\n\nContexte supplémentaire: ${context}` : ''}`;

    imageContent.push({ type: "text", text: userPrompt });

    console.log('📸 Analyzing incident image with AI...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: imageContent }
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Limite de requêtes atteinte, veuillez réessayer dans quelques instants' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: 'Crédits insuffisants pour l\'analyse IA' 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';
    
    console.log('🤖 AI Response:', content);

    // Parse JSON from response
    let result;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      result = {
        category: "Autre",
        item: "Non identifié",
        problem_type: "Autre",
        severity: "medium",
        description: "Impossible d'identifier précisément l'élément",
        confidence: 0.3,
        suggested_title: "Incident à vérifier"
      };
    }

    return new Response(JSON.stringify({
      success: true,
      ...result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in recognize-incident-item:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
