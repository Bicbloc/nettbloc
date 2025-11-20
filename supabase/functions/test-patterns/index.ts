import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Annotation {
  text: string;
  field: string;
  value?: string;
  startIndex: number;
  endIndex: number;
}

interface ExtractedRoom {
  roomNumber: string;
  status: string;
  cleaningType: string;
  arrivalDate: string;
  departureDate: string;
}

interface ValidationMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  accuracy: number;
  totalAnnotations: number;
  totalExtracted: number;
  correctMatches: number;
  fieldMetrics: {
    [key: string]: {
      precision: number;
      recall: number;
      f1Score: number;
      matches: number;
      total: number;
    };
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { annotations, extractedRooms, patterns } = await req.json();

    console.log('Testing patterns:', {
      annotationsCount: annotations.length,
      extractedCount: extractedRooms.length,
      patternsProvided: !!patterns
    });

    // Calculer les métriques par champ
    const fieldMetrics: { [key: string]: { tp: number; fp: number; fn: number } } = {
      roomNumber: { tp: 0, fp: 0, fn: 0 },
      status: { tp: 0, fp: 0, fn: 0 },
      cleaningType: { tp: 0, fp: 0, fn: 0 },
      arrivalDate: { tp: 0, fp: 0, fn: 0 },
      departureDate: { tp: 0, fp: 0, fn: 0 }
    };

    // Créer un mapping des annotations par champ et valeur
    const annotationMap: { [key: string]: Set<string> } = {};
    annotations.forEach((ann: Annotation) => {
      if (!annotationMap[ann.field]) {
        annotationMap[ann.field] = new Set();
      }
      annotationMap[ann.field].add((ann.value || ann.text).toLowerCase().trim());
    });

    // Créer un mapping des extractions par champ
    const extractedMap: { [key: string]: Set<string> } = {};
    extractedRooms.forEach((room: ExtractedRoom) => {
      Object.entries(room).forEach(([field, value]) => {
        if (!extractedMap[field]) {
          extractedMap[field] = new Set();
        }
        if (value && typeof value === 'string') {
          extractedMap[field].add(value.toLowerCase().trim());
        }
      });
    });

    // Calculer TP, FP, FN pour chaque champ
    Object.keys(fieldMetrics).forEach(field => {
      const annotated = annotationMap[field] || new Set();
      const extracted = extractedMap[field] || new Set();

      // True Positives: valeurs présentes dans les deux
      annotated.forEach(value => {
        if (extracted.has(value)) {
          fieldMetrics[field].tp++;
        } else {
          fieldMetrics[field].fn++; // False Negatives
        }
      });

      // False Positives: valeurs extraites mais non annotées
      extracted.forEach(value => {
        if (!annotated.has(value)) {
          fieldMetrics[field].fp++;
        }
      });
    });

    // Calculer les métriques globales
    let totalTp = 0, totalFp = 0, totalFn = 0;
    const calculatedFieldMetrics: ValidationMetrics['fieldMetrics'] = {};

    Object.entries(fieldMetrics).forEach(([field, counts]) => {
      totalTp += counts.tp;
      totalFp += counts.fp;
      totalFn += counts.fn;

      const precision = counts.tp + counts.fp > 0 
        ? counts.tp / (counts.tp + counts.fp) 
        : 0;
      const recall = counts.tp + counts.fn > 0 
        ? counts.tp / (counts.tp + counts.fn) 
        : 0;
      const f1Score = precision + recall > 0 
        ? 2 * (precision * recall) / (precision + recall) 
        : 0;

      calculatedFieldMetrics[field] = {
        precision: Math.round(precision * 100) / 100,
        recall: Math.round(recall * 100) / 100,
        f1Score: Math.round(f1Score * 100) / 100,
        matches: counts.tp,
        total: counts.tp + counts.fn
      };
    });

    // Métriques globales
    const globalPrecision = totalTp + totalFp > 0 
      ? totalTp / (totalTp + totalFp) 
      : 0;
    const globalRecall = totalTp + totalFn > 0 
      ? totalTp / (totalTp + totalFn) 
      : 0;
    const globalF1Score = globalPrecision + globalRecall > 0 
      ? 2 * (globalPrecision * globalRecall) / (globalPrecision + globalRecall) 
      : 0;
    const globalAccuracy = totalTp + totalFp + totalFn > 0
      ? totalTp / (totalTp + totalFp + totalFn)
      : 0;

    const metrics: ValidationMetrics = {
      precision: Math.round(globalPrecision * 100) / 100,
      recall: Math.round(globalRecall * 100) / 100,
      f1Score: Math.round(globalF1Score * 100) / 100,
      accuracy: Math.round(globalAccuracy * 100) / 100,
      totalAnnotations: annotations.length,
      totalExtracted: extractedRooms.length,
      correctMatches: totalTp,
      fieldMetrics: calculatedFieldMetrics
    };

    console.log('Validation metrics:', metrics);

    return new Response(
      JSON.stringify({
        success: true,
        metrics,
        summary: {
          quality: metrics.f1Score >= 0.8 ? 'excellent' : metrics.f1Score >= 0.6 ? 'good' : 'needs_improvement',
          recommendations: generateRecommendations(metrics)
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in test-patterns function:", error);
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

function generateRecommendations(metrics: ValidationMetrics): string[] {
  const recommendations: string[] = [];

  if (metrics.precision < 0.7) {
    recommendations.push("Précision faible: trop de fausses détections. Affinez les patterns pour être plus restrictifs.");
  }

  if (metrics.recall < 0.7) {
    recommendations.push("Rappel faible: certaines données ne sont pas détectées. Ajoutez plus d'exemples d'annotations.");
  }

  Object.entries(metrics.fieldMetrics).forEach(([field, fieldMetric]) => {
    if (fieldMetric.f1Score < 0.6) {
      recommendations.push(`Le champ "${field}" a une faible performance (F1: ${fieldMetric.f1Score}). Ajoutez plus d'exemples pour ce champ.`);
    }
  });

  if (recommendations.length === 0) {
    recommendations.push("Excellentes performances! Les patterns fonctionnent bien.");
  }

  return recommendations;
}
