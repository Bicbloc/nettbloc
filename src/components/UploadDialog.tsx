
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
import { HousekeeperSetupDialog } from './HousekeeperSetupDialog';

interface UploadDialogProps {
  onPdfProcessed: (data: any, distributionMethod?: 'random' | 'floor' | 'cleaning-type') => void;
  existingHousekeepers?: string[];
  hotelId?: string;
}

export function UploadDialog({ onPdfProcessed, existingHousekeepers = [], hotelId }: UploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [showDistributionOptions, setShowDistributionOptions] = useState(false);
  const [processedData, setProcessedData] = useState<any>(null);
  const [showHousekeeperSetup, setShowHousekeeperSetup] = useState(false);
  const [selectedHousekeepers, setSelectedHousekeepers] = useState<string[]>([]);
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
      const data = await processPdf(selectedFile);
      console.log("Données traitées:", data.length, "chambres");
      
      setProcessedData(data);
      setShowHousekeeperSetup(true);
      
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

  const handleHousekeepersConfirmed = (housekeepers: string[]) => {
    setSelectedHousekeepers(housekeepers);
    setShowHousekeeperSetup(false);
    setShowDistributionOptions(true);
  };

  const handleDistributionSelect = (method: 'random' | 'floor' | 'cleaning-type') => {
    if (processedData) {
      onPdfProcessed(processedData, method);
      setOpen(false);
      setShowDistributionOptions(false);
      setShowHousekeeperSetup(false);
      setProcessedData(null);
      setSelectedFile(null);
      setSelectedHousekeepers([]);
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
        {!showHousekeeperSetup && !showDistributionOptions ? (
          <>
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
          </>
        ) : showHousekeeperSetup ? (
          <>
            <DialogHeader>
              <DialogTitle>Configuration des femmes de chambre</DialogTitle>
              <DialogDescription>
                Sélectionnez les femmes de chambre existantes ou ajoutez-en de nouvelles avant la distribution.
              </DialogDescription>
            </DialogHeader>
            <HousekeeperSetupDialog
              isOpen={true}
              onClose={() => {
                setShowHousekeeperSetup(false);
                setProcessedData(null);
              }}
              onHousekeepersConfirmed={handleHousekeepersConfirmed}
              existingHousekeepers={existingHousekeepers}
              roomCount={processedData?.length || 0}
            />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Choisir la méthode de redistribution</DialogTitle>
              <DialogDescription>
                Comment souhaitez-vous distribuer les chambres aux femmes de chambre ?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Button
                variant="outline"
                className="w-full h-16 flex flex-col items-start p-4"
                onClick={() => handleDistributionSelect('random')}
              >
                <div className="font-medium">🎲 Distribution aléatoire</div>
                <div className="text-sm text-muted-foreground">Répartition équitable et aléatoire</div>
              </Button>
              
              <Button
                variant="outline"
                className="w-full h-16 flex flex-col items-start p-4"
                onClick={() => handleDistributionSelect('floor')}
              >
                <div className="font-medium">🏢 Par étage</div>
                <div className="text-sm text-muted-foreground">Chambres d'étages proches pour la même femme de chambre</div>
              </Button>
              
              <Button
                variant="outline"
                className="w-full h-16 flex flex-col items-start p-4"
                onClick={() => handleDistributionSelect('cleaning-type')}
              >
                <div className="font-medium">🔴⚪ Par type de nettoyage</div>
                <div className="text-sm text-muted-foreground">Séparer les chambres rouge et blanc</div>
              </Button>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowDistributionOptions(false);
                  setShowHousekeeperSetup(true);
                }}
              >
                Retour
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
