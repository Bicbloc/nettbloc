import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, TrendingUp, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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

interface PatternValidationProps {
  annotations: any[];
  extractedRooms: any[];
  patterns?: any;
  hotelId: string;
  reportName: string;
  pmsType: string;
}

export const PatternValidation = ({ 
  annotations, 
  extractedRooms, 
  patterns,
  hotelId,
  reportName,
  pmsType
}: PatternValidationProps) => {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<ValidationMetrics | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [recommendations, setRecommendations] = useState<string[]>([]);

  const fieldLabels: { [key: string]: string } = {
    roomNumber: 'Numéro de chambre',
    status: 'Statut',
    cleaningType: 'Type de nettoyage',
    arrivalDate: 'Date d\'arrivée',
    departureDate: 'Date de départ'
  };

  const validatePatterns = async () => {
    if (annotations.length === 0 || extractedRooms.length === 0) {
      toast({
        title: "Données insuffisantes",
        description: "Ajoutez des annotations et extrayez des chambres avant de valider",
        variant: "destructive"
      });
      return;
    }

    setIsValidating(true);

    try {
      const { data, error } = await supabase.functions.invoke('test-patterns', {
        body: {
          annotations,
          extractedRooms,
          patterns
        }
      });

      if (error) throw error;

      if (data?.metrics) {
        setMetrics(data.metrics);
        setRecommendations(data.summary?.recommendations || []);
        
        // Sauvegarder dans l'historique
        const user = await supabase.auth.getUser();
        await supabase.from('pattern_validation_history').insert([{
          hotel_id: hotelId,
          report_name: reportName,
          pms_type: pmsType,
          metrics: data.metrics,
          error_analysis: {
            recommendations: data.summary?.recommendations || [],
            quality: data.summary?.quality
          },
          annotations_count: annotations.length,
          extracted_count: extractedRooms.length,
          created_by: user.data.user?.id || ''
        }]);
        
        toast({
          title: "Validation terminée",
          description: `F1-Score: ${(data.metrics.f1Score * 100).toFixed(1)}%`,
        });
      }
    } catch (error) {
      console.error('Erreur validation:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors de la validation",
        variant: "destructive"
      });
    } finally {
      setIsValidating(false);
    }
  };

  const getQualityBadge = (score: number) => {
    if (score >= 0.8) {
      return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Excellent</Badge>;
    } else if (score >= 0.6) {
      return <Badge className="bg-yellow-500"><TrendingUp className="h-3 w-3 mr-1" /> Bon</Badge>;
    } else {
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> À améliorer</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "text-green-600";
    if (score >= 0.6) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Validation des patterns</h3>
            <p className="text-sm text-muted-foreground">
              Comparez l'extraction automatique avec vos annotations pour mesurer la qualité
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
              <span>Annotations manuelles</span>
              <Badge variant="outline">{annotations.length}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
              <span>Chambres extraites</span>
              <Badge variant="outline">{extractedRooms.length}</Badge>
            </div>
          </div>

          <Button
            onClick={validatePatterns}
            disabled={isValidating || annotations.length === 0 || extractedRooms.length === 0}
            className="w-full"
            size="lg"
          >
            {isValidating ? "Validation en cours..." : "Valider les patterns"}
          </Button>
        </div>
      </Card>

      {metrics && (
        <>
          <Card className="p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Métriques globales</h4>
                {getQualityBadge(metrics.f1Score)}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Précision</div>
                  <div className={`text-2xl font-bold ${getScoreColor(metrics.precision)}`}>
                    {(metrics.precision * 100).toFixed(1)}%
                  </div>
                  <Progress value={metrics.precision * 100} className="mt-2" />
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-1">Rappel</div>
                  <div className={`text-2xl font-bold ${getScoreColor(metrics.recall)}`}>
                    {(metrics.recall * 100).toFixed(1)}%
                  </div>
                  <Progress value={metrics.recall * 100} className="mt-2" />
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-1">F1-Score</div>
                  <div className={`text-2xl font-bold ${getScoreColor(metrics.f1Score)}`}>
                    {(metrics.f1Score * 100).toFixed(1)}%
                  </div>
                  <Progress value={metrics.f1Score * 100} className="mt-2" />
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-1">Exactitude</div>
                  <div className={`text-2xl font-bold ${getScoreColor(metrics.accuracy)}`}>
                    {(metrics.accuracy * 100).toFixed(1)}%
                  </div>
                  <Progress value={metrics.accuracy * 100} className="mt-2" />
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-muted-foreground">Correspondances correctes:</span>
                    <span className="font-semibold">{metrics.correctMatches}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-muted-foreground">Erreurs:</span>
                    <span className="font-semibold">
                      {metrics.totalAnnotations + metrics.totalExtracted - metrics.correctMatches}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="space-y-4">
              <h4 className="font-semibold">Métriques par champ</h4>
              
              <div className="space-y-3">
                {Object.entries(metrics.fieldMetrics).map(([field, fieldMetric]) => (
                  <div key={field} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {fieldLabels[field] || field}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {fieldMetric.matches}/{fieldMetric.total} détectés
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">Précision</div>
                        <div className={`font-semibold ${getScoreColor(fieldMetric.precision)}`}>
                          {(fieldMetric.precision * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Rappel</div>
                        <div className={`font-semibold ${getScoreColor(fieldMetric.recall)}`}>
                          {(fieldMetric.recall * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">F1</div>
                        <div className={`font-semibold ${getScoreColor(fieldMetric.f1Score)}`}>
                          {(fieldMetric.f1Score * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                    
                    <Progress value={fieldMetric.f1Score * 100} className="h-1" />
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {recommendations.length > 0 && (
            <Card className="p-4 bg-blue-50 dark:bg-blue-950/20">
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Recommandations
                </h4>
                <ul className="space-y-2">
                  {recommendations.map((rec, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
