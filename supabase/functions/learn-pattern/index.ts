import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { textSample, annotations, context, mode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Mode "apply" : appliquer les patterns appris à tout le texte
    if (mode === 'apply') {
      const { learnedPatterns, fullText } = await req.json();
      
      const applyPrompt = `Tu es un expert en extraction de données de rapports PDF d'hôtel.

Voici des patterns qui ont été appris à partir d'annotations manuelles:
${JSON.stringify(learnedPatterns, null, 2)}

Applique ces patterns au texte complet suivant et extrait TOUTES les chambres avec leurs informations.

Texte complet:
${fullText}

Retourne un JSON avec la structure:
{
  "rooms": [
    {
      "roomNumber": "101",
      "status": "dirty|clean|occupied|checkout|arrival|stayover",
      "cleaningType": "full|quick|none",
      "arrivalDate": "DD/MM/YYYY ou vide",
      "departureDate": "DD/MM/YYYY ou vide",
      "guestName": "nom du client si disponible",
      "nightInfo": "Nuit X/Y si disponible",
      "confidence": 0.0-1.0
    }
  ],
  "totalFound": nombre_total_chambres
}`;

      const applyResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "user", content: applyPrompt },
          ],
          temperature: 0.1,
        }),
      });

      if (!applyResponse.ok) {
        const errorText = await applyResponse.text();
        console.error("AI gateway error:", applyResponse.status, errorText);
        throw new Error(`AI gateway error: ${applyResponse.status}`);
      }

      const applyData = await applyResponse.json();
      const applyContent = applyData.choices[0]?.message?.content || "";
      
      const extractedRooms = parseJsonFromResponse(applyContent);
      
      return new Response(
        JSON.stringify({
          success: true,
          mode: 'apply',
          extractedRooms: extractedRooms,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mode "learn" : apprendre à partir de quelques annotations et appliquer au reste
    const systemPrompt = `Tu es un expert en extraction de données de rapports PDF d'hôtel. Tu dois:
1. Analyser les annotations fournies par l'utilisateur (quelques exemples)
2. Identifier les patterns (format de chambre, mots-clés de statut, format de dates)
3. Appliquer ces patterns à TOUT le texte pour extraire toutes les chambres

Contexte:
- Type PMS: ${context.pmsType || 'inconnu'}
- Nom du rapport: ${context.reportName || 'inconnu'}
- Hotel ID: ${context.hotelId || 'inconnu'}

IMPORTANT: 
- Les patterns doivent être SPÉCIFIQUES à ce format de rapport
- Utilise les annotations comme exemples pour comprendre le format
- Extrait TOUTES les chambres du texte, pas seulement celles annotées

Pour déterminer le type de nettoyage:
- "full" (À blanc) = départ, nouveau client arrive, changement complet
- "quick" (Recouche) = client reste (Nuit X/Y où X > 1), juste rafraîchissement
- "none" = pas de nettoyage nécessaire

Indices pour "quick" (recouche):
- "Nuit 2/3", "Nuit 3/5" = client reste
- Pas de date de départ aujourd'hui
- Mot-clé "recouche", "stay", "stayover"

Indices pour "full" (à blanc):
- Date de départ = aujourd'hui
- "DIR", "SAL", "DIRTY", "départ", "checkout"
- Nouvelle arrivée le même jour`;

    const userPrompt = `Voici le texte COMPLET du rapport:
${textSample}

Annotations manuelles (exemples fournis par l'utilisateur):
${JSON.stringify(annotations, null, 2)}

À partir de ces ${annotations.length} annotations exemples, identifie les patterns et extrait TOUTES les chambres du texte.

Réponds en JSON:
{
  "patterns": {
    "roomNumberFormat": "description du format de numéro de chambre détecté",
    "roomNumberRegex": "regex pour capturer les numéros",
    "statusKeywords": {
      "MOT_CLE": { "status": "dirty|clean|occupied|checkout|arrival|stayover", "cleaning": "full|quick|none" }
    },
    "dateFormat": "format de date détecté",
    "lineFormat": "description du format de ligne"
  },
  "rooms": [
    {
      "roomNumber": "101",
      "status": "checkout",
      "cleaningType": "full",
      "arrivalDate": "",
      "departureDate": "15/05/2025",
      "guestName": "Nom Client",
      "nightInfo": "",
      "confidence": 0.95,
      "originalLine": "ligne du texte original"
    }
  ],
  "totalFound": nombre_chambres,
  "suggestions": ["suggestion 1", "suggestion 2"]
}`;

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
        temperature: 0.2,
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
    const result = parseJsonFromResponse(aiResponse);

    return new Response(
      JSON.stringify({
        success: true,
        mode: 'learn',
        patterns: result.patterns || {},
        rooms: result.rooms || [],
        totalFound: result.totalFound || result.rooms?.length || 0,
        suggestions: result.suggestions || [],
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

function parseJsonFromResponse(text: string): any {
  try {
    // Essayer de parser directement
    return JSON.parse(text);
  } catch {
    // Essayer d'extraire le JSON d'un bloc de code
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    
    // Essayer de trouver un objet JSON dans le texte
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }
    
    throw new Error("Impossible d'extraire le JSON de la réponse IA");
  }
}
