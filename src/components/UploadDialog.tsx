
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
import { processPdf } from "@/services/pdfService";
import { FileUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface UploadDialogProps {
  onPdfProcessed: (data: any) => void;
}

export function UploadDialog({ onPdfProcessed }: UploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [open, setOpen] = useState(false);
  const [detectedFormat, setDetectedFormat] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        toast({
          variant: "destructive",
          title: "Type de fichier invalide",
          description: "Veuillez téléverser un fichier PDF",
        });
        return;
      }
      console.log("Fichier sélectionné:", file.name);
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
          title: "Type de fichier invalide",
          description: "Veuillez téléverser un fichier PDF",
        });
        return;
      }
      console.log("Fichier déposé:", file.name);
      setSelectedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const simulateProgress = () => {
    setProcessingProgress(0);
    const interval = setInterval(() => {
      setProcessingProgress((prev) => {
        const next = Math.min(prev + 5, 90);
        return next;
      });
    }, 200);
    return interval;
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      toast({
        variant: "destructive",
        title: "Aucun fichier sélectionné",
        description: "Veuillez sélectionner un fichier PDF à téléverser",
      });
      return;
    }

    try {
      setIsUploading(true);
      setDetectedFormat("");
      console.log("Traitement du fichier:", selectedFile.name);
      
      // Simuler une barre de progression
      const progressInterval = simulateProgress();
      
      const data = await processPdf(selectedFile);
      
      // Compléter la progression
      clearInterval(progressInterval);
      setProcessingProgress(100);
      
      console.log("Données traitées:", data.length, "chambres");
      
      // Identifier le format du rapport détecté de manière plus précise
      let formatDetecte = "standard";
      
      // Vérifier en priorité le format Apaleo (plus spécifique)
      if (data.some(room => room.notes?.includes("DIR") || 
                          room.notes?.includes("SAL") || 
                          room.notes?.includes("CL") || 
                          room.notes?.includes("INS"))) {
        formatDetecte = "Apaleo";
      } 
      // Puis vérifier Korner (moins spécifique)
      else if (data.some(room => room.notes?.includes("Korner") ||
                               room.notes?.includes("Recouche") ||
                               room.notes?.includes("Parti"))) {
        formatDetecte = "Hôtel Korner";
      }
      
      setDetectedFormat(formatDetecte);
      
      // Petit délai pour voir la progression à 100%
      setTimeout(() => {
        onPdfProcessed(data);
        setOpen(false);
        toast({
          title: "Téléversement réussi",
          description: `${data.length} chambres traitées depuis ${selectedFile.name} (Format détecté: ${formatDetecte})`,
        });
        setProcessingProgress(0);
      }, 500);
    } catch (error) {
      console.error("Erreur lors du traitement du PDF:", error);
      setProcessingProgress(0);
      toast({
        variant: "destructive",
        title: "Échec du traitement",
        description: "Une erreur s'est produite lors du traitement du fichier PDF.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileInput = () => {
    // Déclencher le clic sur l'input file
    if (fileInputRef.current) {
      fileInputRef.current.click();
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
          <DialogTitle>Importer un Rapport</DialogTitle>
          <DialogDescription>
            Téléversez un rapport PDF (Format Apaleo, Hôtel Korner ou autre) pour analyser les statuts des chambres.
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
        
        {isUploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {detectedFormat ? 
                  `Format détecté: ${detectedFormat}...` : 
                  "Analyse du PDF..."}
              </span>
              <span className="text-sm font-medium">{processingProgress}%</span>
            </div>
            <Progress value={processingProgress} className="h-2" />
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
            {isUploading ? "Traitement en cours..." : "Téléverser"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
