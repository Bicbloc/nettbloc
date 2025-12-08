import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Règles métier avancées pour détection précise
const CLEANING_RULES = `
### RÈGLES DE DÉTECTION DU TYPE DE NETTOYAGE ###

## PRIORITÉ 1: HORS SERVICE (cleaningType="none", status="out_of_order")
- Mots-clés: OOO, Out of order, HS, Hors service, Maintenance, Blocked
- → Aucun nettoyage requis

## PRIORITÉ 2: RECOUCHE - Client en séjour (cleaningType="quick", status="stayover")
CONDITIONS pour RECOUCHE:
- Client avec DATE ARRIVÉE + DATE DÉPART visibles = séjour en cours
- "Nuit X/Y" où X > 1 (ex: Nuit 2/3, Nuit 3/5)
- Statut "INS" ou "SALE" ou "DIRTY" AVEC un nom de client
- "Stay" ou "Stayover" ou "Continue" dans le statut
- Client présent + pas de départ imminent aujourd'hui

EXEMPLES RECOUCHE:
- "102 SGL DIR Farid GAOUTARA 04/05/2025 Adults Guoda Cirtautaite, Night 3/3 07/05/2025" → RECOUCHE (dates arrivée+départ = en séjour)
- "205 DBL INS Martin DUPONT Night 2/4" → RECOUCHE (Nuit 2/4, X>1)
- "301 SALE Jean MARTIN" → RECOUCHE (sale avec client)

## PRIORITÉ 3: À BLANC - Départ sans arrivée (cleaningType="full", status="checkout")
CONDITIONS pour À BLANC:
- Statut "DIR" ou "DEP" ou "Departure" ou "Check-out" SANS nouveau client
- Chambre vide après départ
- "Nuit 1/1" = départ le jour même
- Pas de nom de client OU client parti

EXEMPLES À BLANC:
- "102 DIR" → À BLANC (départ sans client)
- "205 DEP" → À BLANC (departure)
- "301 Check-out 10:00" → À BLANC

## PRIORITÉ 4: ARRIVÉE (cleaningType="full", status="arrival")
CONDITIONS:
- "Nuit 1/Y" où Y > 1 (première nuit d'un séjour multi-nuits)
- Statut "ARR" ou "Arrival" avec client prévu
- Chambre propre + arrivée prévue

## PRIORITÉ 5: PROPRE (cleaningType="none", status="clean")
CONDITIONS:
- Statut "INS" ou "Inspected" ou "Clean" SANS client
- Chambre libre et propre
- Pas de réservation

### INDICES POUR DIFFÉRENCIER ###

RECOUCHE si:
✓ Deux dates visibles (arrivée ET départ) sur la même ligne
✓ Nuit X/Y avec X > 1
✓ Client présent + statut SALE/DIRTY/INS
✓ Mot "Stay" ou "Continue"

À BLANC si:
✓ Statut DIR/DEP sans dates multiples
✓ Pas de nom de client après DIR/DEP
✓ Nuit 1/1 (départ jour même)
✓ Chambre vide après checkout

### NOMS À IGNORER (staff, pas clients) ###
staff, superviseur, manager, farid, admin, maintenance, housekeeping
`;

// Définition du tool pour extraction structurée
const extractionTool = {
  type: "function",
  function: {
    name: "extract_rooms",
    description: "Extraire les chambres du rapport avec leur type de nettoyage",
    parameters: {
      type: "object",
      properties: {
        rooms: {
          type: "array",
          items: {
            type: "object",
            properties: {
              roomNumber: { type: "string", description: "Numéro de chambre" },
              cleaningType: { 
                type: "string", 
                enum: ["full", "quick", "none"],
                description: "full=à blanc, quick=recouche, none=pas de nettoyage" 
              },
              status: { 
                type: "string",
                enum: ["checkout", "stayover", "arrival", "clean", "out_of_order", "occupied"],
                description: "Statut de la chambre"
              },
              hasGuest: { type: "boolean", description: "Client présent (nom visible)" },
              guestName: { type: "string", description: "Nom du client si présent" },
              rawStatus: { type: "string", description: "Statut brut du rapport (DIR/INS/SAL)" },
              nightInfo: { type: "string", description: "Info Nuit X/Y si présente" },
              arrivalDate: { type: "string", description: "Date arrivée DD/MM/YYYY" },
              departureDate: { type: "string", description: "Date départ DD/MM/YYYY" },
              reason: { type: "string", description: "Raison courte de la décision" }
            },
            required: ["roomNumber", "cleaningType", "status", "hasGuest", "reason"]
          }
        },
        patterns: {
          type: "object",
          properties: {
            roomFormat: { type: "string", description: "Format numéro chambre détecté" },
            statusKeywords: { type: "array", items: { type: "string" }, description: "Mots-clés statut trouvés" },
            hasNightInfo: { type: "boolean", description: "Présence de Nuit X/Y" }
          },
          required: ["roomFormat", "statusKeywords", "hasNightInfo"]
        }
      },
      required: ["rooms", "patterns"]
    }
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { textSample, annotations, context, mode, learnedPatterns, fullText } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const textToAnalyze = mode === 'apply' ? fullText : textSample;
    const patternsInfo = learnedPatterns ? `\nPatterns appris: ${JSON.stringify(learnedPatterns)}` : '';
    const annotationsInfo = annotations?.length ? `\nExemples annotés: ${JSON.stringify(annotations)}` : '';

    const prompt = `Tu es un expert en analyse de rapports hôteliers. Analyse ce rapport et extrais TOUTES les chambres.

${CLEANING_RULES}

### CONTEXTE ###
PMS: ${context?.pmsType || 'inconnu'}
Rapport: ${context?.reportName || 'inconnu'}
${patternsInfo}
${annotationsInfo}

### ANALYSE REQUISE ###
Pour CHAQUE chambre:
1. Identifie le numéro de chambre
2. Cherche les dates (arrivée ET départ) - si 2 dates = RECOUCHE
3. Cherche "Nuit X/Y" - si X>1 = RECOUCHE
4. Cherche le statut brut (DIR, INS, SALE, DEP, ARR, OOO)
5. Cherche un nom de client (ignore les noms staff)
6. Applique les règles de priorité ci-dessus
7. Justifie ta décision dans "reason"

### TEXTE DU RAPPORT ###
${textToAnalyze}

IMPORTANT: Sois très attentif aux indices de RECOUCHE vs À BLANC. Une chambre avec un client ET deux dates = RECOUCHE.`;

    console.log("Calling AI with tool calling, text length:", textToAnalyze?.length || 0);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "user", content: prompt }
        ],
        tools: [extractionTool],
        tool_choice: { type: "function", function: { name: "extract_rooms" } }
      }),
    });

    if (!response.ok) {
      const status = response.status;
      console.error("AI gateway error:", status);
      
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requêtes dépassée. Réessayez plus tard." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits insuffisants." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const data = await response.json();
    console.log("AI response received");

    // Extraire les arguments du tool call
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      // Fallback: essayer de parser le content comme JSON
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        console.log("No tool call, trying content parse");
        const parsed = parseJsonFromContent(content);
        if (parsed) {
          return new Response(
            JSON.stringify({
              success: true,
              mode: mode || 'learn',
              rooms: parsed.rooms || [],
              patterns: parsed.patterns || {},
              totalFound: parsed.rooms?.length || 0
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      throw new Error("Pas de réponse structurée de l'IA");
    }

    const result = JSON.parse(toolCall.function.arguments);
    console.log("Extracted rooms:", result.rooms?.length || 0);

    return new Response(
      JSON.stringify({
        success: true,
        mode: mode || 'learn',
        rooms: result.rooms || [],
        patterns: result.patterns || {},
        totalFound: result.rooms?.length || 0,
        extractedRooms: mode === 'apply' ? result : undefined
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in learn-pattern:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function parseJsonFromContent(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {}
    }
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {}
    }
    return null;
  }
}
