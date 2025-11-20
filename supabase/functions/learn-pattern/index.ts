import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { textSample, annotations, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Construire le prompt pour l'IA
    const systemPrompt = `Tu es un expert en extraction de données de rapports PDF d'hôtel. Tu dois analyser des exemples annotés et générer des règles d'extraction.

Voici le contexte du rapport:
PMS Type: ${context.pmsType || 'inconnu'}
Nombre total de chambres dans ce rapport: ${context.totalRooms || 'inconnu'}

Ta tâche:
1. Analyser les annotations fournies
2. Identifier les patterns (regex, position, format)
3. Générer des règles d'extraction réutilisables
4. Suggérer des améliorations

Réponds en JSON avec cette structure:
{
  "patterns": [
    {
      "field": "roomNumber|status|cleaningType|arrivalDate|departureDate",
      "regex": "pattern regex",
      "description": "description du pattern",
      "confidence": 0-1
    }
  ],
  "suggestions": ["suggestion d'amélioration 1", "suggestion 2"]
}`;

    const userPrompt = `Voici le texte brut du rapport:
${textSample}

Annotations manuelles fournies par l'utilisateur:
${JSON.stringify(annotations, null, 2)}

Analyse ces annotations et génère des règles d'extraction.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requêtes dépassée. Réessayez plus tard." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits insuffisants. Ajoutez des crédits à votre workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || "";

    // Extraire le JSON de la réponse
    let patterns;
    try {
      // Essayer de parser directement
      patterns = JSON.parse(aiResponse);
    } catch {
      // Essayer d'extraire le JSON d'un bloc de code
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        patterns = JSON.parse(jsonMatch[1]);
      } else {
        // Essayer de trouver un objet JSON dans le texte
        const objectMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          patterns = JSON.parse(objectMatch[0]);
        } else {
          throw new Error("Impossible d'extraire les patterns de la réponse IA");
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        patterns: patterns,
        rawResponse: aiResponse
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in learn-pattern function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
