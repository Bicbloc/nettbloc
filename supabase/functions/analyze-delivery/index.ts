import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface LinenType {
  id: string;
  name: string;
  category: string;
  icon: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, linenTypes } = await req.json() as {
      imageBase64: string;
      linenTypes: LinenType[];
    };

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "Image base64 requise" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY non configurée" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the list of linen types for the prompt
    const linenTypesList = linenTypes
      .map((t) => `- "${t.name}" (catégorie: ${t.category}, id: ${t.id})`)
      .join("\n");

    const systemPrompt = `Tu es un assistant spécialisé dans l'analyse de bons de livraison de linge hôtelier.
Tu dois extraire les quantités de linge livrées à partir d'un document (photo de bon de livraison, facture, bordereau).

Types de linge disponibles pour cet hôtel:
${linenTypesList}

INSTRUCTIONS:
1. Analyse attentivement le document
2. Pour chaque type de linge que tu identifies, associe-le au type correspondant dans la liste ci-dessus
3. Extrait la quantité livrée pour chaque article
4. Si tu ne trouves pas de correspondance exacte, utilise le type le plus proche
5. Si tu ne peux pas lire une quantité, mets 0

Tu dois retourner un JSON avec EXACTEMENT ce format (aucun texte autour):
{
  "supplier_name": "nom du fournisseur si visible",
  "delivery_reference": "référence du bon si visible",
  "delivery_date": "date au format YYYY-MM-DD si visible",
  "items": [
    {"linen_type_id": "uuid-du-type", "name": "nom détecté sur le document", "quantity": 10, "confidence": 0.95}
  ],
  "unrecognized_items": [
    {"name": "article non reconnu", "quantity": 5}
  ],
  "notes": "observations ou problèmes de lecture"
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
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyse ce bon de livraison et extrait les quantités de linge. Retourne uniquement le JSON, sans aucun texte autour.",
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requêtes dépassée, réessayez plus tard" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits insuffisants, veuillez recharger votre compte" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Erreur lors de l'analyse IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Extract JSON from the response
    let parsed;
    try {
      // Try to find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({
          error: "Impossible d'analyser le document",
          raw_response: content,
          items: [],
          unrecognized_items: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...parsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in analyze-delivery:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
