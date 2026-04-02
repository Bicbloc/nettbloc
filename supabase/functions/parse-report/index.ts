/**
 * Edge function pour le parsing IA des rapports avec apprentissage par exemples
 * Utilise le few-shot learning : l'hôtel fournit des exemples, l'IA généralise
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
              roomNumber: { type: "string" },
              cleaningType: { 
                type: "string", 
                enum: ["a_blanc", "recouche", "none"],
                description: "a_blanc=départ/nettoyage complet, recouche=client reste, none=propre/hors service" 
              },
              status: { type: "string" },
              nightInfo: { type: "string" },
              departureDate: { type: "string" },
              guestName: { type: "string" },
              reason: { type: "string" }
            },
            required: ["roomNumber", "cleaningType", "reason"]
          }
        },
        pmsType: { type: "string" },
        confidence: { type: "number" }
      },
      required: ["rooms"]
    }
  }
};

interface TrainingExample {
  roomNumber: string;
  cleaningType: "a_blanc" | "recouche" | "none";
  reason: string;
  pattern?: string; // description du pattern détecté
}

function buildTrainingSection(examples: TrainingExample[]): string {
  if (!examples || examples.length === 0) return '';
  
  const grouped: Record<string, TrainingExample[]> = {
    a_blanc: [],
    recouche: [],
    none: [],
  };
  
  for (const ex of examples) {
    if (grouped[ex.cleaningType]) {
      grouped[ex.cleaningType].push(ex);
    }
  }
  
  let section = `\n### EXEMPLES D'ENTRAÎNEMENT DE L'HÔTEL ###
Ces exemples montrent comment CET hôtel classe ses chambres. Utilise ces patterns pour classifier toutes les chambres similaires.\n`;

  if (grouped.recouche.length > 0) {
    section += `\nExemples de RECOUCHE (client reste) :\n`;
    for (const ex of grouped.recouche) {
      section += `- Chambre ${ex.roomNumber} → recouche : ${ex.reason}\n`;
    }
  }
  
  if (grouped.a_blanc.length > 0) {
    section += `\nExemples de À BLANC (nettoyage complet) :\n`;
    for (const ex of grouped.a_blanc) {
      section += `- Chambre ${ex.roomNumber} → a_blanc : ${ex.reason}\n`;
    }
  }
  
  if (grouped.none.length > 0) {
    section += `\nExemples de PROPRE (pas de nettoyage) :\n`;
    for (const ex of grouped.none) {
      section += `- Chambre ${ex.roomNumber} → none : ${ex.reason}\n`;
    }
  }
  
  section += `\nIMPORTANT: Applique ces mêmes patterns à TOUTES les chambres qui présentent des caractéristiques similaires. Par exemple, si une chambre avec 1 seul client et une date de départ future est classée recouche, TOUTES les chambres avec 1 seul client et date de départ future doivent aussi être recouche.\n`;
  
  return section;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, reportDate, hotelId, trainingExamples } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    if (!text) {
      throw new Error("No text provided");
    }

    const trainingSection = buildTrainingSection(trainingExamples || []);
    const hasTraining = trainingExamples && trainingExamples.length > 0;

    const prompt = `Analyse ce rapport d'hôtel et extrais TOUTES les chambres.

### DATE DU RAPPORT: ${reportDate || 'non spécifiée'} ###

${hasTraining ? `${trainingSection}

INSTRUCTION CRITIQUE: Les exemples ci-dessus sont la RÉFÉRENCE ABSOLUE. Identifie le PATTERN de chaque exemple (nombre de clients, dates, statut) et applique-le à toutes les chambres qui partagent le même pattern. Les exemples de l'hôtel PRIMENT sur les règles par défaut.` : ''}

RÈGLES DE DÉTECTION PAR DÉFAUT (utilisées si aucun exemple ne correspond):

RÈGLE PRINCIPALE: La DATE DE DÉPART prime TOUJOURS sur Nuit X/Y.
- Si date départ > date rapport → le client est ENCORE LÀ → recouche
- Si date départ ≤ date rapport → le client est PARTI → a_blanc
- Nuit X/Y n'est qu'un indicateur secondaire (utiliser seulement si pas de date de départ)

PRIORITÉ 1: Nombre de noms clients
  - 2+ noms distincts → a_blanc (checkout + checkin)
  - 1 nom + date départ ≤ ${reportDate} → a_blanc
  - 1 nom + date départ > ${reportDate} → recouche (même si Nuit X/Y où X==Y)
  - 1 nom sans info date → recouche (par défaut)

PRIORITÉ 2: 0 noms (chambre vide)
  - PRO/INS sans client → none
  - SAL/DIR sans client → a_blanc

### RAPPORT ###
${text.substring(0, 12000)}

Extrais chaque chambre avec son type de nettoyage et justifie ta décision en référençant l'exemple d'entraînement ou la règle utilisée.`;

    console.log("Calling AI for report parsing, text length:", text.length, "training examples:", trainingExamples?.length || 0);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
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
            error: "RATE_LIMITED",
            message: "Trop de requêtes. Réessayez dans quelques secondes."
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (status === 402) {
        return new Response(
          JSON.stringify({ 
            error: "CREDITS_INSUFFICIENT",
            message: "Crédits IA insuffisants. Utilisez l'analyse locale."
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI error: ${status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error("No structured response from AI");
    }

    const result = JSON.parse(toolCall.function.arguments);
    console.log("Extracted rooms:", result.rooms?.length || 0);

    return new Response(
      JSON.stringify({
        success: true,
        rooms: result.rooms || [],
        pmsType: result.pmsType || 'unknown',
        confidence: result.confidence || 80
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in parse-report:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
