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
import { FileUp, Users, ArrowRight } from "lucide-react";
import { HousekeeperSetupDialog } from "./HousekeeperSetupDialog";
import { ManualAssignmentDialog } from "./ManualAssignmentDialog";

interface PdfWorkflowDialogProps {
  onWorkflowComplete: (data: any, housekeepers: string[]) => void;
  currentHousekeepers?: string[];
}

export function PdfWorkflowDialog({ onWorkflowComplete, currentHousekeepers = [] }: PdfWorkflowDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'housekeepers' | 'distribution'>('upload');
  const [pdfData, setPdfData] = useState<any>(null);
  const [housekeepers, setHousekeepers] = useState<string[]>(currentHousekeepers);
  const [isHousekeeperDialogOpen, setIsHousekeeperDialogOpen] = useState(false);
  const [isDistributionDialogOpen, setIsDistributionDialogOpen] = useState(false);
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
      const data = await processPdf(selectedFile);
      setPdfData(data);
      setStep('housekeepers');
      toast({
        title: "PDF analysé",
        description: `${data.length} chambres détectées. Configurez maintenant vos femmes de chambre.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Échec du traitement",
        description: "Une erreur s'est produite lors du traitement du fichier PDF.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleHousekeepersConfigured = (configuredHousekeepers: string[]) => {
    setHousekeepers(configuredHousekeepers);
    setIsHousekeeperDialogOpen(false);
    setStep('distribution');
  };

  const handleDistributionComplete = () => {
    setIsDistributionDialogOpen(false);
    onWorkflowComplete(pdfData, housekeepers);
    setOpen(false);
    resetDialog();
    toast({
      title: "Configuration terminée",
      description: "Les chambres ont été distribuées avec succès.",
    });
  };

  const resetDialog = () => {
    setSelectedFile(null);
    setPdfData(null);
    setStep('upload');
    setHousekeepers(currentHousekeepers);
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const renderUploadStep = () => (
    <>
      <DialogHeader>
        <DialogTitle>Étape 1: Importer un Rapport Mews</DialogTitle>
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
      
      <DialogFooter>
        <Button variant="outline" onClick={() => setOpen(false)}>
          Annuler
        </Button>
        <Button
          onClick={handlePdfUpload}
          disabled={!selectedFile || isUploading}
        >
          {isUploading ? "Analyse en cours..." : "Analyser le PDF"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </DialogFooter>
    </>
  );

  const renderHousekeepersStep = () => (
    <>
      <DialogHeader>
        <DialogTitle>Étape 2: Configurer les femmes de chambre</DialogTitle>
        <DialogDescription>
          {pdfData?.length} chambres détectées. Configurez maintenant vos femmes de chambre.
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4">
        <div className="text-center p-6 border rounded-lg">
          <Users className="h-12 w-12 text-primary mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Configuration requise</h3>
          <p className="text-muted-foreground mb-4">
            Ajoutez les femmes de chambre qui seront responsables du nettoyage des {pdfData?.length} chambres détectées.
          </p>
          <Button onClick={() => setIsHousekeeperDialogOpen(true)}>
            <Users className="mr-2 h-4 w-4" />
            Configurer les femmes de chambre
          </Button>
        </div>
        
        {housekeepers.length > 0 && (
          <div className="text-center text-green-600">
            ✓ {housekeepers.length} femme(s) de chambre configurée(s)
          </div>
        )}
      </div>
      
      <DialogFooter>
        <Button variant="outline" onClick={() => setStep('upload')}>
          Retour
        </Button>
        <Button
          onClick={() => setIsDistributionDialogOpen(true)}
          disabled={housekeepers.length === 0}
        >
          Distribuer les chambres
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </DialogFooter>
    </>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>
            <FileUp className="mr-2 h-4 w-4" />
            Importer un Rapport
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          {step === 'upload' && renderUploadStep()}
          {step === 'housekeepers' && renderHousekeepersStep()}
        </DialogContent>
      </Dialog>

      <HousekeeperSetupDialog
        isOpen={isHousekeeperDialogOpen}
        onClose={() => setIsHousekeeperDialogOpen(false)}
        onHousekeepersConfirmed={handleHousekeepersConfigured}
        initialHousekeepers={housekeepers}
      />

      {pdfData && (
        <ManualAssignmentDialog
          isOpen={isDistributionDialogOpen}
          onClose={() => setIsDistributionDialogOpen(false)}
          rooms={pdfData}
          housekeeperNames={housekeepers}
          onAssignRooms={handleDistributionComplete}
          housekeeperPreferredFloors={{}}
        />
      )}
    </>
  );
}