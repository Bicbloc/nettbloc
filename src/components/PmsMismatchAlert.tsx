import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Send, X } from "lucide-react";
import { patternLearningService, PmsMatchResult } from "@/services/patternLearningService";
import { toast } from "@/components/ui/use-toast";

interface PmsMismatchAlertProps {
  hotelId: string;
  matchResult: PmsMatchResult;
  reportSample: string;
  onDismiss: () => void;
  onUseAnyway: () => void;
}

export function PmsMismatchAlert({
  hotelId,
  matchResult,
  reportSample,
  onDismiss,
  onUseAnyway
}: PmsMismatchAlertProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitRequest = async () => {
    setIsSubmitting(true);
    try {
      const success = await patternLearningService.submitPatternImprovementRequest(
        hotelId,
        reportSample,
        matchResult.unexpectedKeywords,
        matchResult.expectedPms,
        matchResult.detectedPms,
        matchResult.matchScore
      );

      if (success) {
        toast({
          title: "Demande envoyée",
          description: "Un administrateur analysera votre rapport et mettra à jour le pattern.",
        });
        onDismiss();
      } else {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible d'envoyer la demande. Veuillez réessayer.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Une erreur est survenue.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Alert variant="destructive" className="mb-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
      <AlertTriangle className="h-5 w-5 text-amber-600" />
      <AlertTitle className="text-amber-800 dark:text-amber-200">
        Format de rapport différent détecté
      </AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-300">
        <p className="mb-2">
          Ce rapport semble provenir d'un logiciel différent de celui habituellement utilisé.
        </p>
        <p className="text-sm mb-3">
          <strong>Attendu:</strong> {matchResult.expectedPms || "Non défini"} | 
          <strong> Détecté:</strong> {matchResult.detectedPms} | 
          <strong> Correspondance:</strong> {matchResult.matchScore.toFixed(0)}%
        </p>
        
        {matchResult.missingKeywords.length > 0 && (
          <p className="text-xs mb-2">
            <strong>Mots-clés manquants:</strong> {matchResult.missingKeywords.slice(0, 5).join(", ")}
            {matchResult.missingKeywords.length > 5 && "..."}
          </p>
        )}

        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onUseAnyway}
            className="border-amber-500 text-amber-700 hover:bg-amber-100"
          >
            Utiliser quand même
          </Button>
          <Button
            size="sm"
            onClick={handleSubmitRequest}
            disabled={isSubmitting}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Send className="h-4 w-4 mr-1" />
            {isSubmitting ? "Envoi..." : "Demander une mise à jour"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="ml-auto"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
