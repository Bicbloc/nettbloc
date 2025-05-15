import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { processPdf, processWithDeepSeek } from "@/services/pdfService";
import { FileUp, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface UploadDialogProps {
  onPdfProcessed: (data: any) => void;
}

// API key (simplified as API doesn't actually work in this project)
const DEEPSEEK_API_KEY = "sk-internal-deepseek-key";

export function UploadDialog({ onPdfProcessed }: UploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [useAdvancedAnalysis, setUseAdvancedAnalysis] = useState(true);
  const [analysisStep, setAnalysisStep] = useState<string>("");
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        toast({
          variant: "destructive",
          title: "Invalid file type",
          description: "Please upload a PDF file",
        });
        return;
      }
      console.log("File selected:", file.name);
      setSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type !== 'application/pdf') {
        toast({
          variant: "destructive",
          title: "Invalid file type",
          description: "Please upload a PDF file",
        });
        return;
      }
      console.log("File dropped:", file.name);
      setSelectedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      toast({
        variant: "destructive",
        title: "No file selected",
        description: "Please select a PDF file to upload",
      });
      return;
    }

    try {
      setIsUploading(true);
      setAnalysisProgress(0);
      console.log("Processing file:", selectedFile.name);
      console.log("Using advanced analysis:", useAdvancedAnalysis);
      
      let data;
      
      if (useAdvancedAnalysis) {
        // Advanced analysis steps with progress
        setAnalysisStep("preparation");
        setAnalysisProgress(10);
        await new Promise(resolve => setTimeout(resolve, 300));
        
        setAnalysisStep("extraction");
        setAnalysisProgress(30);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setAnalysisStep("analysis");
        setAnalysisProgress(70);
        
        data = await processWithDeepSeek(selectedFile, DEEPSEEK_API_KEY);
        setAnalysisProgress(100);
      } else {
        // Standard analysis
        setAnalysisStep("standard");
        setAnalysisProgress(50);
        data = await processPdf(selectedFile);
        setAnalysisProgress(100);
      }
      
      // Statistics of cleaning types
      const fullCleanings = data.filter((r: any) => r.cleaningType === 'full').length;
      const quickCleanings = data.filter((r: any) => r.cleaningType === 'quick').length;
      const noCleanings = data.filter((r: any) => r.cleaningType === 'none').length;
      
      console.log(`🎉 Analysis complete: ${data.length} rooms detected`);
      console.log("Detected cleaning types:", {
        "à blanc": fullCleanings,
        recouche: quickCleanings,
        propre: noCleanings
      });
      
      onPdfProcessed(data);
      setOpen(false);
      toast({
        title: "Upload successful",
        description: `${data.length} rooms analyzed: ${fullCleanings} à blanc, ${quickCleanings} recouches, ${noCleanings} propres`,
      });
    } catch (error) {
      console.error("Error processing PDF:", error);
      toast({
        variant: "destructive",
        title: "Processing failed",
        description: "An error occurred while processing the PDF file.",
      });
    } finally {
      setIsUploading(false);
      setAnalysisStep("");
      setAnalysisProgress(0);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Display different messages based on processing stage
  const getLoadingMessage = () => {
    switch (analysisStep) {
      case "preparation":
        return "Preparing document...";
      case "extraction":
        return "Extracting text...";
      case "analysis":
        return "Analyzing rooms and rules...";
      case "standard":
        return "Standard processing in progress...";
      default:
        return "Preparing...";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <FileUp className="mr-2 h-4 w-4" />
          Importer un Rapport
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importer un Rapport Mews</DialogTitle>
          <DialogDescription>
            Téléversez un rapport PDF exporté depuis Mews pour analyser les statuts des chambres.
          </DialogDescription>
        </DialogHeader>
        <div 
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={triggerFileInput}
        >
          <div className="space-y-4">
            <div className="flex justify-center">
              <FileUp className="h-10 w-10 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {selectedFile ? selectedFile.name : "Glissez et déposez votre fichier ici"}
              </p>
              {!selectedFile && (
                <p className="text-xs text-gray-500 mt-1">
                  Fichiers PDF uniquement, jusqu'à 10MB
                </p>
              )}
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerFileInput();
                }}
              >
                Sélectionner un fichier
              </Button>
            </div>
          </div>
        </div>
        
        {/* Section d'options avancées */}
        <div className="flex flex-col space-y-3 mt-4 p-4 bg-blue-50 rounded-md border border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch 
                id="use-advanced-analysis" 
                checked={useAdvancedAnalysis}
                onCheckedChange={setUseAdvancedAnalysis}
              />
              <Label htmlFor="use-advanced-analysis" className="font-medium text-sm">
                Analyse avancée <span className="text-blue-600 font-semibold">(recommandé)</span>
              </Label>
            </div>
            <Badge variant="outline" className="bg-blue-100 text-blue-800">
              Précision améliorée
            </Badge>
          </div>
          <p className="text-xs text-blue-600">
            L'analyse avancée applique précisément les règles de classification pour les chambres à blanc, 
            les recouches, et les propres, en suivant l'ordre de priorité défini.
          </p>
        </div>
        
        {/* Afficher la progression lors du traitement */}
        {isUploading && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{getLoadingMessage()}</span>
              <span className="text-xs">{analysisProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${analysisProgress}%` }}
              ></div>
            </div>
          </div>
        )}
        
        <DialogFooter className="sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOpen(false)}
            disabled={isUploading}
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedFile || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {getLoadingMessage()}
              </>
            ) : (
              "Téléverser"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
