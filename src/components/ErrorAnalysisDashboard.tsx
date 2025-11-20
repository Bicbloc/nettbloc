import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingDown, TrendingUp, Target, Lightbulb, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ErrorAnalysisDashboardProps {
  hotelId: string;
}

export const ErrorAnalysisDashboard = ({ hotelId }: ErrorAnalysisDashboardProps) => {
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [periodDays, setPeriodDays] = useState(30);

  const analyzeErrors = async () => {
    setIsAnalyzing(true);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-errors', {
        body: {
          hotelId,
          days: periodDays
        }
      });

      if (error) throw error;

      if (!data.hasData) {
        toast({
          title: "Aucune donnée",
          description: "Pas assez de validations pour analyser les erreurs",
          variant: "destructive"
        });
        return;
      }

      setAnalysis(data.analysis);
      
      toast({
        title: "Analyse terminée",
        description: `${data.analysis.recommendations.length} recommandations générées`,
      });
    } catch (error) {
      console.error('Erreur analyse:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors de l'analyse",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      default: return 'bg-blue-500 text-white';
    }
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      case 'medium':
        return <Target className="h-4 w-4" />;
      default:
        return <Lightbulb className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Détection des erreurs récurrentes</h3>
            <p className="text-sm text-muted-foreground">
              Analyse automatique des patterns d'erreurs pour identifier les zones d'amélioration prioritaires
            </p>
          </div>

          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Période d'analyse</label>
              <select
                value={periodDays}
                onChange={(e) => setPeriodDays(parseInt(e.target.value))}
                className="w-full p-2 border rounded-md bg-background"
              >
                <option value="7">7 derniers jours</option>
                <option value="30">30 derniers jours</option>
                <option value="90">90 derniers jours</option>
                <option value="180">6 derniers mois</option>
              </select>
            </div>

            <Button
              onClick={analyzeErrors}
              disabled={isAnalyzing}
              size="lg"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
              {isAnalyzing ? "Analyse en cours..." : "Analyser les erreurs"}
            </Button>
          </div>
        </div>
      </Card>

      {analysis && (
        <>
          <Card className="p-4">
            <div className="space-y-4">
              <h4 className="font-semibold">Vue d'ensemble</h4>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded">
                  <div className="text-2xl font-bold">{analysis.totalValidations}</div>
                  <div className="text-xs text-muted-foreground">Validations</div>
                </div>

                <div className="text-center p-3 bg-muted/50 rounded">
                  <div className="text-2xl font-bold">{analysis.priorityFields.length}</div>
                  <div className="text-xs text-muted-foreground">Champs problématiques</div>
                </div>

                <div className="text-center p-3 bg-muted/50 rounded">
                  <div className="text-2xl font-bold">
                    {analysis.overallTrends?.avg_overall_f1 
                      ? (analysis.overallTrends.avg_overall_f1 * 100).toFixed(0) 
                      : '0'}%
                  </div>
                  <div className="text-xs text-muted-foreground">F1-Score moyen</div>
                </div>

                <div className="text-center p-3 bg-muted/50 rounded">
                  <div className="text-2xl font-bold">{analysis.recommendations.length}</div>
                  <div className="text-xs text-muted-foreground">Recommandations</div>
                </div>
              </div>
            </div>
          </Card>

          {analysis.priorityFields.length > 0 && (
            <Card className="p-4">
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-orange-500" />
                  Champs avec erreurs récurrentes
                </h4>
                
                <div className="space-y-3">
                  {analysis.priorityFields.map((field: any, idx: number) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{field.field}</Badge>
                          <span className="text-sm font-medium">
                            {field.occurrences} occurrences
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          F1 moyen: {(field.avgF1 * 100).toFixed(1)}%
                        </div>
                      </div>

                      {field.recentExamples && field.recentExamples.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          <div className="font-medium mb-1">Exemples récents:</div>
                          {field.recentExamples.map((example: any, exIdx: number) => (
                            <div key={exIdx} className="ml-2">
                              • {example.reportName} - F1: {(example.f1Score * 100).toFixed(1)}%
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {analysis.recommendations.length > 0 && (
            <Card className="p-4">
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  Recommandations prioritaires
                </h4>
                
                <div className="space-y-4">
                  {analysis.recommendations.map((rec: any, idx: number) => (
                    <div key={idx} className="border-l-4 border-orange-500 pl-4 py-2">
                      <div className="flex items-start gap-3">
                        <Badge className={`${getImpactColor(rec.impact)} shrink-0`}>
                          <span className="flex items-center gap-1">
                            {getImpactIcon(rec.impact)}
                            {rec.impact}
                          </span>
                        </Badge>
                        
                        <div className="flex-1">
                          <div className="font-semibold text-sm mb-1">{rec.title}</div>
                          <div className="text-sm text-muted-foreground mb-2">
                            {rec.description}
                          </div>
                          <div className="text-sm bg-blue-50 dark:bg-blue-950/20 p-2 rounded">
                            <span className="font-medium">💡 Suggestion: </span>
                            {rec.suggestion}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {analysis.recentHistory && analysis.recentHistory.length > 0 && (
            <Card className="p-4">
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Historique récent
                </h4>
                
                <div className="space-y-2">
                  {analysis.recentHistory.map((record: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {new Date(record.date).toLocaleDateString('fr-FR')}
                        </span>
                        <span className="text-sm">{record.reportName}</span>
                      </div>
                      <Badge variant="outline">
                        F1: {(record.f1Score * 100).toFixed(1)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
