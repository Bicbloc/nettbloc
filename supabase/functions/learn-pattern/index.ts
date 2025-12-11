import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Règles métier avancées pour détection précise - OPTIMISÉ APALEO
const CLEANING_RULES = `
### RÈGLES DE DÉTECTION DU TYPE DE NETTOYAGE ###

## RÈGLE SPÉCIALE APALEO - DOUBLONS ##
Dans les rapports Apaleo, UNE MÊME CHAMBRE peut apparaître PLUSIEURS FOIS avec des statuts différents.

RÈGLE CRITIQUE - COMBINAISONS DE STATUTS:
1. Si chambre X apparaît avec "PARTI/DEP" ET "EN ARRIVÉE/ARR" → C'est un À BLANC (checkout_arrival)
   - Le client est parti ET un nouveau arrive le même jour
   - Nécessite un nettoyage COMPLET
   - NE PAS créer 2 entrées, FUSIONNER en UNE seule avec cleaningType="full"

2. Si chambre X apparaît avec "EN ARRIVÉE/ARR" ET "A CONTROLER" → C'est PROPRE (clean)
   - La chambre attend un client mais est déjà prête
   - cleaningType="none", la chambre n'a pas besoin de nettoyage
   - NE PAS créer 2 entrées, FUSIONNER en UNE seule

3. Si chambre X apparaît avec "ARRIVÉ" (client présent) ET "A CONTROLER" → PROPRE
   - Le client est déjà là, chambre inspectée
   - cleaningType="none"

IMPORTANT: Quand tu vois la même chambre plusieurs fois, FUSIONNE les informations!

## PRIORITÉ 1: HORS SERVICE (cleaningType="none", status="out_of_order")
- Mots-clés: OOO, Out of order, HS, Hors service, Maintenance, Blocked
- → Aucun nettoyage requis

## PRIORITÉ 2: À BLANC - Dernier jour OU Départ (cleaningType="full")
CONDITIONS pour À BLANC:
- "Nuit X/X" où X = Y (ex: Nuit 2/2, Nuit 4/4, Nuit 5/5, Nuit 6/6) = DERNIER JOUR = DÉPART = À BLANC
- "Nuit 1/1" = une seule nuit = départ aujourd'hui = À BLANC
- Chambre apparaît avec PARTI/DÉPART ET EN ARRIVÉE = checkout_arrival = À BLANC
- Deux noms de clients différents sur la même ligne = départ + arrivée = À BLANC
- Statut "DIR" ou "DEP" ou "Departure" ou "Check-out"
- Heure de départ visible (ex: 08:16, 09:00) PUIS heure d'arrivée = checkout_arrival

EXEMPLES À BLANC:
- "208 B CLA SAL ... Laure Lepoittevin, Nuit 2/2 21/11/2025" → À BLANC (Nuit 2/2, X=Y, dernier jour)
- "302 COC SAL ... Susanne Incorvaia, Nuit 5/5 21/11/2025" → À BLANC (Nuit 5/5, X=Y, dernier jour)
- "407 B SUP BLC SAL ... YURUI HUANG, Nuit 6/6 21/11/2025" → À BLANC (Nuit 6/6, X=Y, dernier jour)
- "102 PARTI" + "102 EN ARRIVÉE" → À BLANC (checkout_arrival)
- "401 B ... Vanessa Wouters 08:08 11:48 ... PHILIPPE JOSS 14:55" → À BLANC (2 clients = départ+arrivée)

## PRIORITÉ 3: RECOUCHE - Client en séjour qui RESTE (cleaningType="quick", status="stayover")
CONDITIONS pour RECOUCHE:
- "Nuit X/Y" où X < Y (ex: Nuit 2/3, Nuit 2/4, Nuit 4/5) = client reste encore = RECOUCHE
- UN SEUL nom de client visible + statut SAL/INS = séjour en cours
- Pas de "Nuit X/X" (si X=Y c'est un départ!)

EXEMPLES RECOUCHE:
- "216 SUP SAL ... Abdelilah Talsmat, Nuit 4/5 22/11/2025" → RECOUCHE (Nuit 4/5, X<Y, reste 1 nuit)
- "300 PMR CLA SAL ... SAFAE LOUMMOU, Nuit 2/3 22/11/2025" → RECOUCHE (Nuit 2/3, X<Y, reste 1 nuit)
- "318 Twinable CLA SAL ... KATIA Garabedian, Nuit 2/4 23/11/2025" → RECOUCHE (Nuit 2/4, X<Y, reste 2 nuits)

RÈGLE CRITIQUE NUIT X/Y:
- Si X = Y → À BLANC (dernier jour, client part)
- Si X < Y → RECOUCHE (client reste)

## PRIORITÉ 4: ARRIVÉE SEULE (cleaningType="full", status="arrival")
CONDITIONS:
- "EN ARRIVÉE" ou "ARR" SANS doublon "PARTI" pour cette chambre
- Chambre doit être préparée pour nouveau client

## PRIORITÉ 5: PROPRE (cleaningType="none", status="clean")
CONDITIONS:
- "EN ARRIVÉE" + "A CONTROLER" = déjà propre, pas de nettoyage
- "ARRIVÉ" + "A CONTROLER" = client présent, chambre OK
- Statut "INS" ou "Inspected" ou "Clean" ou "Propre" SANS client
- Chambre libre et propre

### INDICES POUR DIFFÉRENCIER ###

À BLANC (checkout_arrival) si:
✓ Même chambre avec PARTI/DEP ET EN ARRIVÉE/ARR
✓ Client parti + nouveau client arrive

RECOUCHE si:
✓ Deux dates visibles (arrivée ET départ) sur la même ligne
✓ Nuit X/Y avec X > 1 (sauf Nuit 1/1)
✓ Client présent + statut SALE/DIRTY/INS

PROPRE si:
✓ EN ARRIVÉE + A CONTROLER (chambre prête)
✓ ARRIVÉ + A CONTROLER (client déjà là)

À BLANC simple si:
✓ Statut DIR/DEP sans doublon "EN ARRIVÉE"
✓ Nuit 1/1 (départ jour même)

### MOTS-CLÉS APALEO ###
- PARTI = checkout/départ
- EN ARRIVÉE = arrivée prévue
- ARRIVÉ = client déjà présent
- A CONTROLER = à inspecter
- RECOUCHE = stayover
- SALE/DIR = dirty

### NOMS À IGNORER (staff, pas clients) ###
staff, superviseur, manager, farid, admin, maintenance, housekeeping, reception
`;

// Définition du tool pour extraction structurée - OPTIMISÉ APALEO
const extractionTool = {
  type: "function",
  function: {
    name: "extract_rooms",
    description: "Extraire les chambres du rapport avec leur type de nettoyage. IMPORTANT: Fusionner les doublons de chambres!",
    parameters: {
      type: "object",
      properties: {
        rooms: {
          type: "array",
          description: "Liste des chambres UNIQUES. Si une chambre apparaît plusieurs fois, la fusionner en une seule entrée.",
          items: {
            type: "object",
            properties: {
              roomNumber: { type: "string", description: "Numéro de chambre" },
              cleaningType: { 
                type: "string", 
                enum: ["full", "quick", "none"],
                description: "full=à blanc (départ ou départ+arrivée), quick=recouche, none=pas de nettoyage (propre/arrivé)" 
              },
              status: { 
                type: "string",
                enum: ["checkout", "checkout_arrival", "stayover", "arrival", "clean", "out_of_order", "occupied"],
                description: "checkout_arrival=PARTI+ARRIVÉE même jour, checkout=départ seul, stayover=recouche, clean=propre"
              },
              hasGuest: { type: "boolean", description: "Client présent (nom visible)" },
              guestName: { type: "string", description: "Nom du client si présent" },
              rawStatuses: { 
                type: "array", 
                items: { type: "string" },
                description: "TOUS les statuts bruts trouvés pour cette chambre (ex: ['PARTI', 'EN ARRIVÉE'])" 
              },
              nightInfo: { type: "string", description: "Info Nuit X/Y si présente" },
              arrivalDate: { type: "string", description: "Date arrivée DD/MM/YYYY" },
              departureDate: { type: "string", description: "Date départ DD/MM/YYYY" },
              reason: { type: "string", description: "Explication de la décision (ex: 'PARTI+EN ARRIVÉE=à blanc')" },
              isMerged: { type: "boolean", description: "True si cette chambre résulte d'une fusion de plusieurs lignes" }
            },
            required: ["roomNumber", "cleaningType", "status", "hasGuest", "reason"]
          }
        },
        patterns: {
          type: "object",
          properties: {
            roomFormat: { type: "string", description: "Format numéro chambre détecté" },
            statusKeywords: { type: "array", items: { type: "string" }, description: "Mots-clés statut trouvés" },
            hasNightInfo: { type: "boolean", description: "Présence de Nuit X/Y" },
            pmsType: { type: "string", description: "Type de PMS détecté (apaleo, mews, etc.)" },
            hasDuplicates: { type: "boolean", description: "True si des chambres apparaissent plusieurs fois" },
            mergedCount: { type: "integer", description: "Nombre de chambres fusionnées" }
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
    const { textSample, annotations, context, mode, learnedPatterns, fullText, exclusions } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const textToAnalyze = mode === 'apply' ? fullText : textSample;
    const patternsInfo = learnedPatterns ? `\nPatterns appris: ${JSON.stringify(learnedPatterns)}` : '';
    const annotationsInfo = annotations?.length ? `\nExemples annotés: ${JSON.stringify(annotations)}` : '';
    const exclusionsInfo = exclusions?.length ? `\nÉléments à IGNORER (ne pas extraire): ${exclusions.map((e: any) => e.text || e).join(', ')}` : '';

    // Détection du type de PMS
    const textUpper = textToAnalyze?.toUpperCase() || '';
    const isApaleo = textUpper.includes('APALEO') || textUpper.includes('HOUSEKEEPING REPORT') || 
                     (textUpper.includes('PARTI') && textUpper.includes('EN ARRIVÉE'));
    
    const pmsSpecificRules = isApaleo ? `
### RÈGLES SPÉCIFIQUES APALEO ###
Ce rapport vient d'APALEO. Applique ces règles:

1. FUSION OBLIGATOIRE: Si tu vois la chambre 101 avec "PARTI" et aussi 101 avec "EN ARRIVÉE", 
   créé UNE SEULE entrée avec status="checkout_arrival" et cleaningType="full"

2. PROPRE SI ARRIVÉE+CONTROLER: Si chambre avec "EN ARRIVÉE" ET "A CONTROLER" → status="clean", cleaningType="none"

3. MOTS-CLÉS APALEO:
   - PARTI = départ
   - EN ARRIVÉE = arrivée attendue
   - ARRIVÉ = client présent
   - A CONTROLER = à inspecter
   - RECOUCHE = client reste

4. NE CRÉE PAS DE DOUBLONS! Chaque numéro de chambre = 1 seule entrée dans le résultat.
` : '';

    const prompt = `Tu es un expert en analyse de rapports hôteliers. Analyse ce rapport et extrais TOUTES les chambres UNIQUES.

${CLEANING_RULES}

${pmsSpecificRules}

### CONTEXTE ###
PMS: ${context?.pmsType || (isApaleo ? 'apaleo' : 'inconnu')}
Rapport: ${context?.reportName || 'inconnu'}
${patternsInfo}
${annotationsInfo}
${exclusionsInfo}

### ANALYSE REQUISE ###
Pour CHAQUE chambre UNIQUE:
1. Identifie le numéro de chambre
2. VÉRIFIE si cette chambre apparaît plusieurs fois avec des statuts différents
3. Si oui, FUSIONNE les informations et applique les règles de combinaison
4. Cherche les dates (arrivée ET départ)
5. Cherche "Nuit X/Y"
6. Détermine le cleaningType et status selon les règles
7. Justifie ta décision dans "reason"

### TEXTE DU RAPPORT ###
${textToAnalyze}

IMPORTANT: 
- NE CRÉE PAS DE DOUBLONS! Si chambre 101 apparaît 2 fois, retourne 1 seule entrée fusionnée.
- PARTI + EN ARRIVÉE = checkout_arrival (à blanc)
- EN ARRIVÉE + A CONTROLER = clean (propre)`;

    console.log("Calling AI with tool calling, text length:", textToAnalyze?.length || 0, "PMS:", isApaleo ? 'apaleo' : 'unknown');

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
          JSON.stringify({ 
            error: "AI_RATE_LIMITED",
            message: "Limite de requêtes dépassée. Réessayez dans quelques secondes.",
            fallback: "manual",
            canRetry: true,
            retryAfter: 5
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ 
            error: "AI_CREDITS_INSUFFICIENT",
            message: "Crédits IA insuffisants. Utilisez le mode manuel ou les règles locales.",
            fallback: "local_parsing",
            canRetry: false,
            suggestion: "Annotez manuellement les chambres ou utilisez l'analyseur local basé sur les règles apprises."
          }),
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
