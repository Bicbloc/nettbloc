import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnnotationSuggestion {
  id: string;
  text: string;
  field: 'roomNumber' | 'status' | 'cleaningType' | 'nightInfo' | 'guestName';
  lineIndex: number;
  confidence: number;
  patternSource: string;
  startIndex?: number;
  endIndex?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rawText, hotelId, reportName } = await req.json();

    if (!rawText || !hotelId) {
      return new Response(
        JSON.stringify({ error: 'rawText and hotelId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Récupérer les patterns existants validés
    const { data: patterns } = await supabase
      .from('report_training_patterns')
      .select('*')
      .or(`hotel_id.eq.${hotelId},is_default.eq.true`)
      .eq('validated', true)
      .order('accuracy_score', { ascending: false })
      .limit(10);

    // Préparer le contexte des patterns pour l'IA
    const patternContext = (patterns || []).map(p => ({
      name: p.pattern_name || p.report_name,
      pmsType: p.pms_type,
      rules: p.detection_rules,
      sampleRooms: (p.extracted_data as any[])?.slice(0, 5)
    }));

    // Diviser le texte en lignes
    const lines = rawText.split('\n').filter((l: string) => l.trim().length > 3);
    const previewLines = lines.slice(0, 50);
    const sampleText = previewLines.join('\n');

    // Détecter le type de PMS
    const pmsKeywords = {
      apaleo: ['Apaleo', 'PARTI', 'EN ARRIVÉE', 'A CONTROLER', 'Check-out', 'Check-in'],
      mews: ['Mews', 'INS', 'DIR', 'SAL', 'Inspected', 'Clean'],
      opera: ['Opera', 'VD', 'VC', 'OCC', 'VAC']
    };

    let detectedPMS = 'unknown';
    for (const [pms, keywords] of Object.entries(pmsKeywords)) {
      if (keywords.some(kw => rawText.includes(kw))) {
        detectedPMS = pms;
        break;
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Tu es un expert en extraction de données de rapports hôteliers.

Tu dois analyser le texte d'un rapport de ménage et identifier les éléments annotables:
- roomNumber: Numéros de chambre (ex: 101, 215, 1A, Suite 5)
- status: Statuts de chambre (ex: INS, DIR, SAL, PARTI, EN ARRIVÉE, A CONTROLER, VD, VC)
- nightInfo: Information de nuit de séjour (ex: "Nuit 2/3", "Night 1/5", "2/3")
- guestName: Noms de clients (ex: "M. Dupont", "Smith", prénom+nom)

Type de PMS détecté: ${detectedPMS}

${patternContext.length > 0 ? `
Patterns existants pour référence:
${JSON.stringify(patternContext, null, 2)}
` : ''}

RÈGLES IMPORTANTES:
1. Les numéros de chambre sont généralement des nombres de 1-4 chiffres ou alphanumériques (ex: 101, 1A, Suite 5)
2. Les statuts sont souvent des codes courts: INS, DIR, SAL, PARTI, EN ARRIVÉE, A CONTROLER, VD, VC, OCC
3. Les nuits sont au format X/Y ou "Nuit X/Y" ou "Night X/Y"
4. Les noms de clients sont des noms propres (majuscule en début)
5. NE PAS confondre les noms de superviseurs/responsables avec les clients
6. Donner une confiance élevée (>0.8) pour les éléments très clairs

Pour chaque ligne, retourne les annotations détectées.`;

    const userPrompt = `Analyse ces lignes de rapport et identifie TOUS les éléments annotables.
Retourne un JSON avec les suggestions d'annotations.

LIGNES DU RAPPORT:
${sampleText}

Retourne un JSON avec cette structure:
{
  "suggestions": [
    {
      "text": "101",
      "field": "roomNumber",
      "lineIndex": 0,
      "confidence": 0.95
    }
  ],
  "detectedPMS": "${detectedPMS}",
  "patternName": "nom suggéré pour ce pattern"
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
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add credits" }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    
    console.log("AI Response:", content);

    // Parser la réponse JSON de l'IA
    let parsedResult;
    try {
      // Extraire le JSON du contenu (peut être entouré de markdown)
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || 
                       content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      parsedResult = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Parse error:", parseError);
      parsedResult = { suggestions: [], detectedPMS, patternName: reportName };
    }

    // Enrichir les suggestions avec des IDs uniques et le pattern source
    const suggestions: AnnotationSuggestion[] = (parsedResult.suggestions || []).map((s: any, index: number) => ({
      id: `sugg_${Date.now()}_${index}`,
      text: s.text,
      field: s.field,
      lineIndex: s.lineIndex,
      confidence: s.confidence || 0.7,
      patternSource: parsedResult.patternName || `${detectedPMS} pattern`,
      startIndex: s.startIndex,
      endIndex: s.endIndex
    }));

    // Grouper par type pour le résumé
    const summary = {
      roomNumber: suggestions.filter(s => s.field === 'roomNumber').length,
      status: suggestions.filter(s => s.field === 'status').length,
      nightInfo: suggestions.filter(s => s.field === 'nightInfo').length,
      guestName: suggestions.filter(s => s.field === 'guestName').length,
    };

    return new Response(
      JSON.stringify({
        suggestions,
        summary,
        detectedPMS: parsedResult.detectedPMS || detectedPMS,
        patternName: parsedResult.patternName || reportName,
        totalSuggestions: suggestions.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in suggest-annotations:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
