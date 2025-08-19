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

interface PdfWorkflowDialogProps {
  onWorkflowComplete: (data: any) => void;
}

export function PdfWorkflowDialog({ onWorkflowComplete }: PdfWorkflowDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [open, setOpen] = useState(false);
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
      setSelectedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handlePdfUpload = async () => {
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
      
      // Traiter le PDF
      const data = await processPdf(selectedFile);
      
      toast({
        title: "PDF analysé avec succès",
        description: `${data.length} chambres détectées dans le rapport.`,
      });

      // Terminer le workflow immédiatement
      onWorkflowComplete(data);
      setOpen(false);
      resetDialog();
    } catch (error) {
      console.error("Erreur traitement PDF:", error);
      toast({
        variant: "destructive",
        title: "Échec du traitement",
        description: "Une erreur s'est produite lors du traitement du fichier PDF.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const resetDialog = () => {
    setSelectedFile(null);
  };

  const triggerFileInput = () => {
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
      <DialogContent className="sm:max-w-md md:max-w-lg lg:max-w-xl max-h-[90vh] overflow-y-auto w-[95vw] mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Analyser un Rapport PDF
          </DialogTitle>
          <DialogDescription>
            Téléversez un rapport PDF exporté depuis votre PMS pour analyser les chambres.
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
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button
            onClick={handlePdfUpload}
            disabled={!selectedFile || isUploading}
          >
            {isUploading ? "Analyse en cours..." : "Analyser le PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}