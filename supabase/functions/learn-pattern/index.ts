import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Règles métier AMÉLIORÉES pour la détection du type de nettoyage
const MEWS_CLEANING_RULES = `
LOGIQUE MÉTIER POUR DÉTECTION DU TYPE DE NETTOYAGE:

RÈGLE 0 - Out of order (priorité maximale):
- Si "Out of order", "OOO", "HS", "Hors service" → AUCUN nettoyage
- cleaningType = "none", status = "out_of_order"

RÈGLE 1 - INS/SAL sans client = Chambre propre:
- Si statut "INS" ou "SAL" ET pas de nom de client → AUCUN nettoyage (chambre vide et propre)
- cleaningType = "none", status = "clean"
- Ex: "101 INS" sans nom = chambre propre, pas besoin de nettoyer

RÈGLE 2 - DIR sans client = À Blanc:
- Si statut "DIR" ou "DEP" ET pas de nom de client → À BLANC (départ effectué)
- cleaningType = "full" ou "a_blanc"

RÈGLE 3 - Nuit X/Y (Pattern le plus fiable quand client présent):
- Si "Nuit 2/3", "Nuit 3/5", "Night 2/4" → X > 1 = RECOUCHE (client reste)
- Si "Nuit 1/3", "Night 1/2" → X = 1 = À BLANC (premier jour, arrivée)
- Si pas de "Nuit X/Y" → vérifier les autres règles

RÈGLE 4 - Blocs de réservation (heures):
- Si 2 heures dans la ligne (ex: "11:00" et "15:00") → départ + arrivée même jour = À BLANC
- Si heure départ seule (08:00-12:00) sans heure arrivée → départ = À BLANC
- Si heure arrivée seule (14:00-19:00) sans heure départ → arrivée = À BLANC

RÈGLE 5 - Mots-clés de statut avec client:
- SAL + nom client → RECOUCHE
- DIR, DEP, DEPART, CHECKOUT, OUT + nom client → À BLANC
- INS, STAYOVER, OCC, OCCUPIED + nom client → RECOUCHE
- ARR, ARRIVAL, CHECKIN, IN → À BLANC (arrivée)

PRIORITÉ: Règle 0 > Règle 1 > Règle 2 > Règle 3 > Règle 4 > Règle 5

DÉTECTION DE PRÉSENCE CLIENT:
- Un client est présent si: nom propre visible (ex: "Jean DUPONT", "Lucy NORTHEAST")
- Ou pattern "X × Adultes" avec X > 0
- Pas de client si: ligne ne contient que numéro + statut sans nom
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

IMPORTANT - NOUVELLE LOGIQUE:
1. D'abord vérifie si "Out of order" → cleaningType = "none"
2. Puis vérifie si statut (INS/SAL/DIR) SANS nom de client → si INS/SAL sans client = "none" (propre)
3. Si DIR sans client = "full" (à blanc)
4. Si client présent, applique les règles Nuit X/Y ou heures
5. "Nuit X/Y" avec X > 1 = TOUJOURS "quick" (recouche)
6. 2 blocs d'heures (départ + arrivée) = TOUJOURS "full" (à blanc)

Pour chaque chambre, indique:
- hasGuest: true/false (y a-t-il un nom de client visible?)
- rawStatus: le statut brut détecté (INS, DIR, SAL, etc.)
- detectionReason: explication complète de la décision

Retourne un JSON avec la structure:
{
  "rooms": [
    {
      "roomNumber": "101",
      "status": "clean|dirty|occupied|checkout|arrival|stayover|out_of_order",
      "cleaningType": "full|quick|none",
      "arrivalDate": "DD/MM/YYYY ou vide",
      "departureDate": "DD/MM/YYYY ou vide",
      "guestName": "nom du client ou null si pas de client",
      "nightInfo": "Nuit X/Y si disponible",
      "confidence": 0.0-1.0,
      "hasGuest": true|false,
      "rawStatus": "INS|DIR|SAL|etc",
      "detectionReason": "Règle utilisée avec explication détaillée"
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
- Applique STRICTEMENT les règles métier pour le type de nettoyage
- DÉTECTE si chaque chambre a un client (nom visible) ou non`;

    const userPrompt = `Voici le texte COMPLET du rapport:
${textSample}

Annotations manuelles (exemples fournis par l'utilisateur):
${JSON.stringify(annotations, null, 2)}

À partir de ces ${annotations?.length || 0} annotations exemples, identifie les patterns et extrait TOUTES les chambres du texte.

Pour CHAQUE chambre:
1. Détermine d'abord s'il y a un client (nom visible dans la ligne)
2. Vérifie le statut brut (INS, DIR, SAL, etc.)
3. Applique les règles métier:
   - Out of order → none
   - INS/SAL sans client → none (propre)
   - DIR sans client → full (à blanc)
   - Nuit X/Y avec X > 1 → quick (recouche)
   - 2 heures (départ + arrivée) → full (à blanc)

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
    "guestDetectionPattern": "pattern pour détecter les noms de clients",
    "timePatterns": {
      "departure": "pattern pour heures de départ",
      "arrival": "pattern pour heures d'arrivée"
    }
  },
  "rooms": [
    {
      "roomNumber": "101",
      "status": "clean",
      "cleaningType": "none",
      "arrivalDate": "",
      "departureDate": "",
      "guestName": null,
      "nightInfo": "",
      "confidence": 0.95,
      "hasGuest": false,
      "rawStatus": "INS",
      "detectionReason": "INS sans client = Chambre propre, pas de nettoyage",
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
