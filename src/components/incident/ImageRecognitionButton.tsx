import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface RecognitionResult {
  category: string;
  item: string;
  problem_type: string;
  severity: string;
  description: string;
  confidence: number;
  suggested_title: string;
}

interface ImageRecognitionButtonProps {
  imageFile: File | null;
  onResult: (result: RecognitionResult) => void;
  disabled?: boolean;
  className?: string;
}

export function ImageRecognitionButton({
  imageFile,
  onResult,
  disabled,
  className,
}: ImageRecognitionButtonProps) {
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasResult, setHasResult] = useState(false);

  const analyzeImage = async () => {
    if (!imageFile) {
      toast({
        title: "Aucune image",
        description: "Veuillez d'abord ajouter une photo",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setHasResult(false);

    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      const imageBase64 = await base64Promise;

      console.log('🔍 Analyzing image with AI...');

      const { data, error } = await supabase.functions.invoke('recognize-incident-item', {
        body: { imageBase64 },
      });

      if (error) {
        console.error('Recognition error:', error);
        throw new Error(error.message || 'Erreur lors de l\'analyse');
      }

      if (!data.success) {
        throw new Error(data.error || 'Échec de l\'analyse');
      }

      console.log('✅ Recognition result:', data);

      onResult({
        category: data.category,
        item: data.item,
        problem_type: data.problem_type,
        severity: data.severity,
        description: data.description,
        confidence: data.confidence,
        suggested_title: data.suggested_title,
      });

      setHasResult(true);

      toast({
        title: "Analyse terminée",
        description: `Élément identifié: ${data.item} (${Math.round(data.confidence * 100)}% confiance)`,
      });

    } catch (error: any) {
      console.error('Image analysis failed:', error);
      toast({
        title: "Erreur d'analyse",
        description: error.message || "Impossible d'analyser l'image",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Button
      type="button"
      variant={hasResult ? "default" : "outline"}
      size="sm"
      onClick={analyzeImage}
      disabled={disabled || !imageFile || isAnalyzing}
      className={cn(
        "gap-2 transition-all",
        hasResult && "bg-green-500 hover:bg-green-600",
        className
      )}
    >
      {isAnalyzing ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyse en cours...
        </>
      ) : hasResult ? (
        <>
          <CheckCircle2 className="h-4 w-4" />
          Analysé
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4" />
          Analyser avec l'IA
        </>
      )}
    </Button>
  );
}
