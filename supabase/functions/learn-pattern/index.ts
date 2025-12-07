import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Règles métier spécifiques Mews pour la détection du type de nettoyage
const MEWS_CLEANING_RULES = `
LOGIQUE MÉTIER POUR DÉTECTION DU TYPE DE NETTOYAGE:

RÈGLE 1 - Nuit X/Y (Pattern le plus fiable):
- Si "Nuit 2/3", "Nuit 3/5", "Night 2/4" → X > 1 = RECOUCHE (client reste)
- Si "Nuit 1/3", "Night 1/2" → X = 1 = À BLANC (premier jour, arrivée)
- Si pas de "Nuit X/Y" → vérifier les autres règles

RÈGLE 2 - Blocs de réservation (heures):
- Si 2 heures dans la ligne (ex: "11:00" et "15:00") → départ + arrivée même jour = À BLANC
- Si heure départ seule (10:00, 11:00, 12:00) sans heure arrivée → départ = À BLANC
- Si heure arrivée seule (14:00, 15:00, 16:00) sans heure départ → arrivée = À BLANC

RÈGLE 3 - Mots-clés de statut:
- SAL, DIR, DEP, DEPART, CHECKOUT, OUT → À BLANC
- INS, STAYOVER, OCC, OCCUPIED → RECOUCHE
- ARR, ARRIVAL, CHECKIN, IN → À BLANC (arrivée)

RÈGLE 4 - Contexte des dates:
- Si date de départ = date du jour → À BLANC
- Si date d'arrivée = date du jour et pas de départ → À BLANC
- Si aucune date ne correspond au jour → probablement RECOUCHE

PRIORITÉ: Règle 1 > Règle 2 > Règle 3 > Règle 4
`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { textSample, annotations, context, mode, learnedPatterns, fullText } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Mode "apply" : appliquer les patterns appris à tout le texte
    if (mode === 'apply') {
      const applyPrompt = `Tu es un expert en extraction de données de rapports PDF d'hôtel.

Voici des patterns qui ont été appris à partir d'annotations manuelles:
${JSON.stringify(learnedPatterns, null, 2)}

${MEWS_CLEANING_RULES}

Applique ces patterns au texte complet suivant et extrait TOUTES les chambres avec leurs informations.

Texte complet:
${fullText}

IMPORTANT pour le type de nettoyage:
- Analyse chaque ligne selon les règles métier ci-dessus
- "Nuit X/Y" avec X > 1 = TOUJOURS recouche (quick)
- 2 blocs d'heures (départ + arrivée) = TOUJOURS à blanc (full)
- En cas de doute, mets "full" (à blanc) car c'est plus sûr

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
      "confidence": 0.0-1.0,
      "detectionReason": "Règle utilisée pour déterminer le type"
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
        }),
      });

      if (!applyResponse.ok) {
        const errorText = await applyResponse.text();
        console.error("AI gateway error:", applyResponse.status, errorText);
        
        if (applyResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: "Limite de requêtes dépassée. Réessayez plus tard." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (applyResponse.status === 402) {
          return new Response(
            JSON.stringify({ error: "Crédits insuffisants. Ajoutez des crédits à votre workspace." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
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
- Type PMS: ${context?.pmsType || 'inconnu'}
- Nom du rapport: ${context?.reportName || 'inconnu'}
- Hotel ID: ${context?.hotelId || 'inconnu'}

${MEWS_CLEANING_RULES}

IMPORTANT: 
- Les patterns doivent être SPÉCIFIQUES à ce format de rapport
- Utilise les annotations comme exemples pour comprendre le format
- Extrait TOUTES les chambres du texte, pas seulement celles annotées
- Applique STRICTEMENT les règles métier pour le type de nettoyage`;

    const userPrompt = `Voici le texte COMPLET du rapport:
${textSample}

Annotations manuelles (exemples fournis par l'utilisateur):
${JSON.stringify(annotations, null, 2)}

À partir de ces ${annotations?.length || 0} annotations exemples, identifie les patterns et extrait TOUTES les chambres du texte.

Pour CHAQUE chambre, applique les règles métier de nettoyage:
- Vérifie d'abord "Nuit X/Y" → X > 1 = recouche (quick)
- Sinon vérifie les blocs d'heures → 2 heures = à blanc (full)
- Sinon vérifie les mots-clés → SAL/DIR = à blanc, INS = recouche
- En cas de doute → à blanc (full)

Réponds en JSON:
{
  "patterns": {
    "roomNumberFormat": "description du format de numéro de chambre détecté",
    "roomNumberRegex": "regex pour capturer les numéros",
    "statusKeywords": {
      "MOT_CLE": { "status": "dirty|clean|occupied|checkout|arrival|stayover", "cleaning": "full|quick|none" }
    },
    "dateFormat": "format de date détecté",
    "lineFormat": "description du format de ligne",
    "nightInfoPattern": "pattern pour Nuit X/Y si détecté",
    "timePatterns": {
      "departure": "pattern pour heures de départ",
      "arrival": "pattern pour heures d'arrivée"
    }
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
      "detectionReason": "Règle utilisée",
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

    console.log("AI Response received, length:", aiResponse.length);

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
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.error("Failed to parse JSON from code block:", e);
      }
    }
    
    // Essayer de trouver un objet JSON dans le texte
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch (e) {
        console.error("Failed to parse JSON object:", e);
      }
    }
    
    console.error("Could not extract JSON from response:", text.substring(0, 500));
    throw new Error("Impossible d'extraire le JSON de la réponse IA");
  }
}
