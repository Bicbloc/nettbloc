import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, History, CheckCircle, AlertCircle, FileText, Sparkles, Settings2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrainingWizard } from "@/components/training/TrainingWizard";
import { CleaningTypeMapperPage } from "@/components/pms/CleaningTypeMapperPage";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface TrainingTabProps {
  currentHotelId: string | null;
}

export function TrainingTab({ currentHotelId }: TrainingTabProps) {
  const [showWizard, setShowWizard] = useState(false);
  const [showMapper, setShowMapper] = useState(false);
  // Fetch training patterns for this hotel
  const { data: patterns, isLoading } = useQuery({
    queryKey: ['training-patterns', currentHotelId],
    queryFn: async () => {
      if (!currentHotelId) return [];
      
      const { data, error } = await supabase
        .from('report_training_patterns')
        .select('*')
        .eq('hotel_id', currentHotelId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentHotelId
  });

  if (!currentHotelId) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Veuillez d'abord configurer votre hôtel pour accéder à l'entraînement IA.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (showMapper) {
    return (
      <CleaningTypeMapperPage 
        hotelId={currentHotelId} 
        onBack={() => setShowMapper(false)} 
      />
    );
  }

  if (showWizard) {
    return (
      <div className="space-y-4">
        <Button 
          variant="outline" 
          onClick={() => setShowWizard(false)}
          className="mb-4"
        >
          ← Retour à la liste
        </Button>
        <TrainingWizard hotelId={currentHotelId} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10">
                <Brain className="h-8 w-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  Entraînement IA
                  <Sparkles className="h-5 w-5 text-yellow-500" />
                </CardTitle>
                <CardDescription className="text-base mt-1">
                  Apprenez à l'IA à reconnaître le format de vos rapports PMS
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setShowMapper(true)} variant="outline" size="lg" className="gap-2">
                <Settings2 className="h-5 w-5" />
                Mapping nettoyage
              </Button>
              <Button onClick={() => setShowWizard(true)} size="lg" className="gap-2">
                <Brain className="h-5 w-5" />
                Nouvel entraînement
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Comment ça marche ?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h4 className="font-medium">Importez un rapport</h4>
                <p className="text-sm text-muted-foreground">
                  Uploadez un PDF ou copiez/collez le texte de votre rapport PMS quotidien.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h4 className="font-medium">Vérifiez les données</h4>
                <p className="text-sm text-muted-foreground">
                  L'IA extrait les chambres. Corrigez les erreurs si nécessaire.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h4 className="font-medium">Validez l'entraînement</h4>
                <p className="text-sm text-muted-foreground">
                  Sauvegardez pour que l'IA apprenne votre format de rapport.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Previous trainings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Historique des entraînements
          </CardTitle>
          <CardDescription>
            {patterns?.length || 0} pattern(s) enregistré(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : patterns && patterns.length > 0 ? (
            <div className="space-y-3">
              {patterns.map((pattern: any) => {
                 const extractedData = pattern.extracted_data;
                 const roomCount = Array.isArray(extractedData)
                   ? extractedData.length
                   : extractedData?.rooms?.length || 0;
                 
                 return (
                  <div 
                    key={pattern.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${pattern.validated ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                        {pattern.validated ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                      </div>
                      <div>
                        <h4 className="font-medium">{pattern.report_name || 'Rapport sans nom'}</h4>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(pattern.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {pattern.pms_type && (
                        <Badge variant="outline">{pattern.pms_type}</Badge>
                      )}
                      <Badge variant="secondary">{roomCount} chambres</Badge>
                      {pattern.validated && (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                          Validé
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Brain className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-4">
                Aucun entraînement effectué pour le moment.
              </p>
              <Button onClick={() => setShowWizard(true)} variant="outline" className="gap-2">
                <Brain className="h-4 w-4" />
                Commencer l'entraînement
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
