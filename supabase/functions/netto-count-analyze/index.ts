/**
 * Netto Count - AI Analysis Edge Function
 * Uses Lovable AI to count items in images
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logAiUsage } from "../_shared/aiUsage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalyzeRequest {
  imageBase64: string;
  itemTypes: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, itemTypes }: AnalyzeRequest = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!itemTypes || itemTypes.length === 0) {
      return new Response(
        JSON.stringify({ error: "No item types specified" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("🔍 Analyzing image for items:", itemTypes.join(", "));

    // Build the prompt for counting
    const itemList = itemTypes.map((item, i) => `${i + 1}. ${item}`).join("\n");
    
    const systemPrompt = `You are an expert at counting items in images, specifically linens and textiles for hotel/laundry inventory.

Your task is to count the following items in the provided image:
${itemList}

IMPORTANT RULES:
1. Count ONLY the items listed above
2. Be precise - count each visible item individually
3. If an item type is not visible, report 0
4. If items are stacked, estimate the count based on visible layers
5. Respond ONLY with a valid JSON object

Response format (no markdown, just raw JSON):
{
  "counts": {
    "Item Name": number,
    ...
  },
  "confidence": number (0-1),
  "notes": "optional observations"
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
                text: `Please count the following items in this image: ${itemTypes.join(", ")}. Respond with JSON only.`,
              },
              {
                type: "image_url",
                image_url: { url: imageBase64 },
              },
            ],
          },
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    console.log("📊 AI Response:", content);

    // Parse the JSON response
    let parsedResult;
    try {
      // Remove any markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsedResult = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      
      // Try to extract counts using regex as fallback
      const counts: Record<string, number> = {};
      itemTypes.forEach(item => {
        const regex = new RegExp(`"${item}"\\s*:\\s*(\\d+)`, "i");
        const match = content.match(regex);
        counts[item] = match ? parseInt(match[1], 10) : 0;
      });
      
      parsedResult = { counts, confidence: 0.5, notes: "Parsed with fallback method" };
    }

    // Ensure all requested items have a count
    const finalCounts: Record<string, number> = {};
    itemTypes.forEach(item => {
      finalCounts[item] = parsedResult.counts?.[item] || 0;
    });

    const result = {
      counts: finalCounts,
      confidence: parsedResult.confidence || 0.8,
      notes: parsedResult.notes || null,
      total: Object.values(finalCounts).reduce((sum, count) => sum + count, 0),
    };

    console.log("✅ Final result:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("❌ Analysis error:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || "Analysis failed",
        counts: {},
        confidence: 0,
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
