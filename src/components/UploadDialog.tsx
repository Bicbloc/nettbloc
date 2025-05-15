
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
import { FileUp, Star } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useApiKey } from "@/hooks/use-api-key";

interface UploadDialogProps {
  onPdfProcessed: (data: any) => void;
}

export function UploadDialog({ onPdfProcessed }: UploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [useDeepSeek, setUseDeepSeek] = useState(false);
  const [apiKey, setApiKey] = useApiKey("deepseek-api-key", "");
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

    if (useDeepSeek && !apiKey) {
      toast({
        variant: "destructive",
        title: "Clé API manquante",
        description: "Veuillez fournir une clé API DeepSeek pour utiliser cette fonctionnalité",
      });
      return;
    }

    try {
      setIsUploading(true);
      console.log("Traitement du fichier:", selectedFile.name);
      
      let data;
      if (useDeepSeek) {
        console.log("Utilisation de DeepSeek API pour le traitement avec clé:", apiKey.substring(0, 5) + "...");
        data = await processWithDeepSeek(selectedFile, apiKey);
      } else {
        data = await processPdf(selectedFile);
      }
      
      console.log("Données traitées:", data.length, "chambres");
      console.log("Exemples de données:", data.slice(0, 3));
      
      onPdfProcessed(data);
      setOpen(false);
      toast({
        title: "Téléversement réussi",
        description: `${data.length} chambres traitées depuis ${selectedFile.name}`,
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
        <Button className="relative">
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
        
        <div className="mt-6 p-4 border rounded-lg bg-muted/30">
          <div className="flex items-center space-x-2 mb-3">
            <Switch 
              id="use-deepseek" 
              checked={useDeepSeek}
              onCheckedChange={setUseDeepSeek}
            />
            <Label htmlFor="use-deepseek" className="flex items-center gap-2 font-medium">
              <Star className="h-4 w-4" />
              Utiliser DeepSeek AI pour l'analyse avancée
            </Label>
          </div>
          
          {useDeepSeek && (
            <div className="mt-3 space-y-2">
              <Label htmlFor="api-key">Clé API DeepSeek</Label>
              <Input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="flex h-10 w-full"
              />
              <p className="text-xs text-muted-foreground">
                Nécessaire pour l'analyse avancée des chambres et la détection précise du type de nettoyage
              </p>
            </div>
          )}
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
            disabled={!selectedFile || isUploading || (useDeepSeek && !apiKey)}
          >
            {isUploading ? "Traitement en cours..." : "Téléverser"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
