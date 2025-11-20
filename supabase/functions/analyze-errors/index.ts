import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { hotelId, days = 30 } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Configuration manquante");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Analysing errors for hotel:', hotelId, 'over', days, 'days');

    // Récupérer l'historique des validations
    const { data: history, error: historyError } = await supabase
      .from('pattern_validation_history')
      .select('*')
      .eq('hotel_id', hotelId)
      .gte('validation_date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('validation_date', { ascending: false });

    if (historyError) throw historyError;

    if (!history || history.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          hasData: false,
          message: "Aucune donnée d'historique disponible"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Analyser les tendances d'erreurs
    const { data: trends, error: trendsError } = await supabase
      .rpc('analyze_error_trends', { 
        p_hotel_id: hotelId,
        p_days: days 
      });

    if (trendsError) {
      console.error('Error calling analyze_error_trends:', trendsError);
      throw trendsError;
    }

    // Analyse détaillée des erreurs
    const errorPatterns: any[] = [];
    const fieldIssues: { [key: string]: { count: number; examples: any[] } } = {};
    
    history.forEach((record: any) => {
      const metrics = record.metrics;
      
      if (metrics && metrics.fieldMetrics) {
        Object.entries(metrics.fieldMetrics).forEach(([field, metric]: [string, any]) => {
          if (metric.f1Score < 0.6) {
            if (!fieldIssues[field]) {
              fieldIssues[field] = { count: 0, examples: [] };
            }
            fieldIssues[field].count++;
            fieldIssues[field].examples.push({
              date: record.validation_date,
              f1Score: metric.f1Score,
              precision: metric.precision,
              recall: metric.recall,
              reportName: record.report_name
            });
          }
        });
      }
    });

    // Identifier les champs avec erreurs récurrentes
    const priorityFields = Object.entries(fieldIssues)
      .filter(([_, data]) => data.count >= 2) // Au moins 2 occurrences
      .map(([field, data]) => ({
        field,
        occurrences: data.count,
        avgF1: data.examples.reduce((sum, ex) => sum + ex.f1Score, 0) / data.examples.length,
        recentExamples: data.examples.slice(0, 3)
      }))
      .sort((a, b) => b.occurrences - a.occurrences);

    // Générer des recommandations prioritaires
    const recommendations = generatePriorityRecommendations(priorityFields, trends, history);

    const result = {
      success: true,
      hasData: true,
      analysis: {
        totalValidations: history.length,
        periodDays: days,
        overallTrends: trends,
        priorityFields,
        recommendations,
        recentHistory: history.slice(0, 5).map((h: any) => ({
          date: h.validation_date,
          reportName: h.report_name,
          f1Score: h.metrics?.f1Score || 0
        }))
      }
    };

    console.log('Error analysis completed:', {
      totalValidations: history.length,
      priorityFields: priorityFields.length,
      recommendations: recommendations.length
    });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in analyze-errors function:", error);
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

function generatePriorityRecommendations(
  priorityFields: any[],
  trends: any,
  history: any[]
): any[] {
  const recommendations = [];

  // Recommandation 1: Champs avec le plus d'erreurs
  if (priorityFields.length > 0) {
    const topField = priorityFields[0];
    recommendations.push({
      priority: 'high',
      category: 'field_performance',
      field: topField.field,
      title: `Améliorer la détection du champ "${topField.field}"`,
      description: `Ce champ a échoué ${topField.occurrences} fois avec un F1-Score moyen de ${(topField.avgF1 * 100).toFixed(1)}%`,
      suggestion: `Ajoutez plus d'exemples d'annotations pour ce champ spécifique. Analysez les patterns dans les erreurs récurrentes.`,
      impact: 'high'
    });
  }

  // Recommandation 2: Tendance globale
  if (trends && trends.avg_overall_f1 < 0.7) {
    recommendations.push({
      priority: 'high',
      category: 'overall_accuracy',
      title: 'Performance globale en dessous du seuil',
      description: `Le F1-Score moyen est de ${(trends.avg_overall_f1 * 100).toFixed(1)}%, en dessous du seuil recommandé de 70%`,
      suggestion: 'Revisitez vos patterns d\'extraction et ajoutez plus de données d\'entraînement variées.',
      impact: 'critical'
    });
  }

  // Recommandation 3: Champs multiples en difficulté
  const multipleIssueFields = priorityFields.filter(f => f.avgF1 < 0.5);
  if (multipleIssueFields.length >= 2) {
    recommendations.push({
      priority: 'medium',
      category: 'multiple_fields',
      fields: multipleIssueFields.map((f: any) => f.field),
      title: `${multipleIssueFields.length} champs nécessitent une attention`,
      description: 'Plusieurs champs ont des performances médiocres de manière récurrente',
      suggestion: 'Envisagez de revoir complètement les patterns d\'extraction ou d\'utiliser un PMS différent si disponible.',
      impact: 'medium'
    });
  }

  // Recommandation 4: Analyse de tendance
  if (history.length >= 3) {
    const recentF1 = history.slice(0, 3).map((h: any) => h.metrics?.f1Score || 0);
    const olderF1 = history.slice(3, 6).map((h: any) => h.metrics?.f1Score || 0);
    
    if (recentF1.length > 0 && olderF1.length > 0) {
      const recentAvg = recentF1.reduce((a, b) => a + b, 0) / recentF1.length;
      const olderAvg = olderF1.reduce((a, b) => a + b, 0) / olderF1.length;
      
      if (recentAvg < olderAvg - 0.1) {
        recommendations.push({
          priority: 'medium',
          category: 'degradation',
          title: 'Dégradation des performances détectée',
          description: `Les performances récentes (${(recentAvg * 100).toFixed(1)}%) sont inférieures aux performances passées (${(olderAvg * 100).toFixed(1)}%)`,
          suggestion: 'Vérifiez si le format des rapports a changé ou si de nouvelles données nécessitent des patterns mis à jour.',
          impact: 'high'
        });
      }
    }
  }

  // Trier par priorité et impact
  return recommendations.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.impact as keyof typeof priorityOrder] - priorityOrder[b.impact as keyof typeof priorityOrder];
  });
}
