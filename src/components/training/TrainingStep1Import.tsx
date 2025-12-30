import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Sparkles, AlertCircle, AlertTriangle } from "lucide-react";
import { pmsAdapterFactory, unifiedParserService, ExtractedRoom } from "@/services/pms";
import { TrainingData } from "./TrainingWizard";
import { useExistingTraining } from "./TrainingHistory";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface TrainingStep1ImportProps {
  hotelId: string;
  onComplete: (data: TrainingData) => void;
}

export const TrainingStep1Import = ({ hotelId, onComplete }: TrainingStep1ImportProps) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [detectedPmsType, setDetectedPmsType] = useState<string | null>(null);
  const [pendingData, setPendingData] = useState<TrainingData | null>(null);
  
  // Check if PMS type is already trained
  const { existingPattern, loading: checkingExisting } = useExistingTraining(hotelId, detectedPmsType);

  const extractTextFromPdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Reconstruire les lignes en utilisant la position Y des éléments
      let lastY: number | null = null;
      let lineBuffer = "";
      
      for (const item of textContent.items as any[]) {
        const currentY = item.transform[5]; // Position Y
        
        // Si la position Y change significativement, c'est une nouvelle ligne
        if (lastY !== null && Math.abs(currentY - lastY) > 5) {
          fullText += lineBuffer.trim() + "\n";
          lineBuffer = "";
        }
        
        lineBuffer += item.str + " ";
        lastY = currentY;
      }
      
      // Ajouter la dernière ligne de la page
      if (lineBuffer.trim()) {
        fullText += lineBuffer.trim() + "\n";
      }
      fullText += "\n"; // Séparateur de page
    }
    
    return fullText;
  };

  const processFile = async (file: File) => {
    if (!file.type.includes("pdf")) {
      toast({
        title: "Format non supporté",
        description: "Veuillez importer un fichier PDF",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setDetectedPmsType(null);
    setPendingData(null);

    try {
      const text = await extractTextFromPdf(file);
      console.log("📄 Texte extrait:", text.substring(0, 300));

      // Auto-detect PMS type
      const detection = pmsAdapterFactory.detectPms(text);
      const pmsType = detection.detection.pmsType;
      
      console.log("🔍 PMS détecté:", pmsType, "confiance:", detection.detection.confidence);
      setDetectedPmsType(pmsType);

      // Extract rooms using the detected adapter
      const extractedRooms = detection.adapter.extractRooms(text);
      console.log("🏠 Chambres extraites:", extractedRooms.length);

      const trainingData: TrainingData = {
        reportName: file.name,
        rawText: text,
        extractedRooms,
        detectedPmsType: pmsType,
        validatedCount: 0,
      };

      // Store pending data - will be processed after checking for existing training
      setPendingData(trainingData);

      if (extractedRooms.length === 0) {
        toast({
          title: "Aucune chambre détectée",
          description: "L'IA n'a pas pu détecter de chambres. Vous pourrez les ajouter manuellement à l'étape suivante.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Import réussi",
          description: `${extractedRooms.length} chambres détectées - PMS: ${pmsType.toUpperCase()}`,
        });
      }
    } catch (error) {
      console.error("Erreur lors du traitement:", error);
      toast({
        title: "Erreur",
        description: "Impossible de lire le fichier PDF",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleContinueWithUpdate = () => {
    if (pendingData && existingPattern) {
      // Continue with existing pattern ID for update
      onComplete({
        ...pendingData,
        existingPatternId: existingPattern.id,
      });
    }
  };

  const handleContinueNew = () => {
    if (pendingData) {
      onComplete(pendingData);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleReset = () => {
    setDetectedPmsType(null);
    setPendingData(null);
  };

  // Show existing training warning
  if (pendingData && existingPattern && !checkingExisting) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <AlertTitle className="text-amber-600">PMS déjà entraîné</AlertTitle>
          <AlertDescription className="text-amber-600/80">
            <p className="mb-3">
              Un entraînement existe déjà pour le PMS <strong>{detectedPmsType?.toUpperCase()}</strong>.
            </p>
            <p className="text-sm mb-4">
              Fichier existant : <strong>{existingPattern.report_name}</strong>
              <br />
              Chambres validées : <strong>{
                Array.isArray(existingPattern.extracted_data) 
                  ? existingPattern.extracted_data.length 
                  : existingPattern.extracted_data?.rooms?.length || 0
              }</strong>
            </p>
            <p className="text-sm">
              Vous pouvez soit <strong>mettre à jour</strong> l'entraînement existant avec ce nouveau rapport,
              soit <strong>supprimer</strong> l'ancien depuis l'historique ci-dessus avant de continuer.
            </p>
          </AlertDescription>
        </Alert>

        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={handleReset}>
            Annuler
          </Button>
          <Button onClick={handleContinueWithUpdate} className="gap-2">
            Mettre à jour l'entraînement
          </Button>
        </div>
      </div>
    );
  }

  // If pending data exists and no conflict, continue automatically
  if (pendingData && !existingPattern && !checkingExisting) {
    // Auto-continue after a brief moment
    setTimeout(() => handleContinueNew(), 100);
  }

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50"
        }`}
      >
        {uploading || checkingExisting ? (
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
            <p className="text-lg font-medium">
              {checkingExisting ? "Vérification des entraînements existants..." : "Analyse du rapport en cours..."}
            </p>
            <p className="text-sm text-muted-foreground">
              {checkingExisting ? "Un instant..." : "Extraction du texte et détection des chambres"}
            </p>
          </div>
        ) : (
          <>
            <div className="flex justify-center mb-4">
              <div className="p-4 rounded-full bg-primary/10">
                <Upload className="w-8 h-8 text-primary" />
              </div>
            </div>
            <h3 className="text-lg font-semibold mb-2">
              Glissez votre rapport PDF ici
            </h3>
            <p className="text-muted-foreground mb-4">
              ou cliquez pour sélectionner un fichier
            </p>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </>
        )}
      </div>

      {/* Tips */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <p className="font-medium">Conseil pour un bon entraînement</p>
            <p className="text-sm text-muted-foreground">
              Utilisez un rapport récent avec plusieurs types de chambres (départs, recouches, arrivées) 
              pour que l'IA apprenne tous les cas de figure.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium">PMS supportés</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {pmsAdapterFactory.getAvailablePmsTypes().map((type) => (
                <Badge key={type} variant="secondary" className="text-xs">
                  {type.toUpperCase()}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
