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

// Clé DeepSeek utilisée en interne et non exposée à l'utilisateur
const DEEPSEEK_API_KEY = "sk-internal-deepseek-key";

export function UploadDialog({ onPdfProcessed }: UploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [useDeepSeek, setUseDeepSeek] = useState(true); // Activé par défaut
  const [isConnectingToDeepSeek, setIsConnectingToDeepSeek] = useState(false);
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
      console.log("Traitement du fichier:", selectedFile.name);
      console.log("Utilisation de l'analyse avancée:", useDeepSeek);
      
      let data;
      
      if (useDeepSeek) {
        console.log("🔍 Démarrage de l'analyse avancée avec DeepSeek");
        setIsConnectingToDeepSeek(true);
        
        // Délai réduit en développement pour tester plus rapidement
        if (process.env.NODE_ENV === 'development') {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        data = await processWithDeepSeek(selectedFile, DEEPSEEK_API_KEY);
        setIsConnectingToDeepSeek(false);
      } else {
        console.log("📄 Démarrage de l'analyse standard");
        data = await processPdf(selectedFile);
      }
      
      // Amélioration des informations après analyse
      const fullCleanings = data.filter(r => r.cleaningType === 'full').length;
      const quickCleanings = data.filter(r => r.cleaningType === 'quick').length;
      const noCleanings = data.filter(r => r.cleaningType === 'none').length;
      
      console.log(`🎉 Analyse terminée: ${data.length} chambres détectées`);
      console.log("Types de nettoyage détectés:", {
        complet: fullCleanings,
        rapide: quickCleanings,
        aucun: noCleanings
      });
      
      onPdfProcessed(data);
      setOpen(false);
      toast({
        title: "Téléversement réussi",
        description: `${data.length} chambres analysées: ${fullCleanings} à blanc, ${quickCleanings} recouches, ${noCleanings} propres`,
      });
    } catch (error) {
      console.error("Erreur lors du traitement du PDF:", error);
      toast({
        variant: "destructive",
        title: "Échec du traitement",
        description: "Une erreur s'est produite lors du traitement du fichier PDF.",
      });
    } finally {
      setIsUploading(false);
      setIsConnectingToDeepSeek(false);
    }
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
        
        <div className="flex flex-col space-y-3 mt-4 p-3 bg-blue-50 rounded-md border border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch 
                id="use-deepseek" 
                checked={useDeepSeek}
                onCheckedChange={setUseDeepSeek}
              />
              <Label htmlFor="use-deepseek" className="font-medium text-sm">
                Utiliser l'analyse DeepSeek <span className="text-blue-600 font-semibold">(recommandé)</span>
              </Label>
            </div>
            <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
              API Connectée
            </Badge>
          </div>
          <p className="text-xs text-blue-600">
            L'analyse DeepSeek utilise l'OCR et l'intelligence artificielle pour détecter 
            précisément les types de nettoyage dans les rapports Mews.
          </p>
        </div>
        
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
                {isConnectingToDeepSeek ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connexion à DeepSeek...
                  </>
                ) : (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Traitement en cours...
                  </>
                )}
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
