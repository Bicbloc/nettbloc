/**
 * Edge function simplifiée pour le parsing IA des rapports
 * Utilisée uniquement en fallback quand le parsing local échoue
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, reportDate, hotelId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    if (!text) {
      throw new Error("No text provided");
    }

    const prompt = `Analyse ce rapport d'hôtel et extrais TOUTES les chambres.

### DATE DU RAPPORT: ${reportDate || 'non spécifiée'} ###

RÈGLES DE DÉTECTION:
1. Si DATE_DÉPART == ${reportDate} → a_blanc (départ aujourd'hui)
2. Si DATE_DÉPART > ${reportDate} → recouche (client reste)
3. Nuit X/Y où X == Y → a_blanc (dernière nuit)
4. Nuit X/Y où X < Y → recouche (séjour en cours)
5. PARTI + ARRIVÉE même chambre → a_blanc
6. Hors service/OOO → none

MOTS-CLÉS:
- À BLANC: parti, départ, checkout, dir, dep
- RECOUCHE: recouche, stayover, sal, séjour
- PROPRE: propre, clean, ins, contrôlé

### RAPPORT ###
${text.substring(0, 8000)}

Extrais chaque chambre avec son type de nettoyage et justifie ta décision.`;

    console.log("Calling AI for report parsing, text length:", text.length);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
