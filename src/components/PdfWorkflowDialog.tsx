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
import { processPdf, Room } from "@/services/pdfService";
import { FileUp, Users, ArrowRight, CheckCircle } from "lucide-react";
import { HousekeeperSetupDialog } from "./HousekeeperSetupDialog";
import { ManualAssignmentDialog } from "./ManualAssignmentDialog";
import { HotelSessionService } from "@/services/hotelSessionService";
import { Badge } from "@/components/ui/badge";
import { autoDistributeRooms } from "@/components/assignment/RoomDistribution";

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
      
      // Initialiser ou récupérer la session avant tout traitement
      const sessionToken = await HotelSessionService.initializeSession();
      if (!sessionToken) {
        throw new Error("Impossible de créer une session");
      }
      
      // Traiter le PDF
      const data = await processPdf(selectedFile);
      setPdfData(data);
      
      // Sauvegarder les données de chambre dans la session
      await HotelSessionService.updateRoomData(data);
      
      setStep('housekeepers');
      toast({
        title: "PDF analysé et sauvegardé",
        description: `${data.length} chambres détectées. Session créée avec votre adresse IP. Configurez maintenant vos femmes de chambre.`,
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

  const handleHousekeepersConfigured = async (configuredHousekeepers: string[]) => {
    setHousekeepers(configuredHousekeepers);
    
    // Sauvegarder les noms des femmes de chambre dans la session
    try {
      await HotelSessionService.updateHousekeeperNames(configuredHousekeepers);
      console.log('Noms des femmes de chambre sauvegardés:', configuredHousekeepers);
    } catch (error) {
      console.error('Erreur sauvegarde noms femmes de chambre:', error);
      toast({
        variant: "destructive",
        title: "Erreur de sauvegarde",
        description: "Impossible de sauvegarder les noms des femmes de chambre.",
      });
      return;
    }
    
    setIsHousekeeperDialogOpen(false);
    
    // Après configuration des femmes de chambre, procéder automatiquement à la distribution
    if (pdfData && configuredHousekeepers.length > 0) {
      // Distribution automatique par étages
      const roomAssignments = autoDistributeRooms(pdfData, configuredHousekeepers);
      
      if (roomAssignments) {
        // Convertir les assignations en format Record<string, string> pour la base de données
        const assignments: Record<string, string> = {};
        Object.entries(roomAssignments).forEach(([housekeeper, rooms]) => {
          rooms.forEach(room => {
            assignments[room.number] = housekeeper;
          });
        });
        
        // Sauvegarder les assignations
        await HotelSessionService.updateHousekeeperAssignments(assignments);
        await HotelSessionService.markAsDistributed();
        
        // Terminer le workflow
        onWorkflowComplete(pdfData, configuredHousekeepers);
        setOpen(false);
        resetDialog();
        
        toast({
          title: "Configuration terminée",
          description: `Les ${pdfData.length} chambres ont été automatiquement distribuées entre ${configuredHousekeepers.length} femme(s) de chambre.`,
        });
      }
    }
  };

  const handleDistributionComplete = (housekeeperName: string, rooms: Room[]) => {
    // Fermer le dialogue de distribution et terminer le workflow
    setIsDistributionDialogOpen(false);
    onWorkflowComplete(pdfData, housekeepers);
    setOpen(false);
    resetDialog();
    toast({
      title: "Distribution terminée",
      description: "Les chambres ont été distribuées avec succès.",
    });
  };

  const handleWorkflowComplete = () => {
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
        <DialogTitle className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">Étape 1/3</Badge>
          Importer un Rapport Mews
        </DialogTitle>
        <DialogDescription>
          Téléversez un rapport PDF exporté depuis Mews. Les données seront associées à votre session IP pour permettre la synchronisation en temps réel entre l'admin et les interfaces des femmes de chambre.
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
        <DialogTitle className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">Étape 2/3</Badge>
          Configurer les femmes de chambre
        </DialogTitle>
        <DialogDescription>
          {pdfData?.length} chambres détectées et sauvegardées. Configurez maintenant vos femmes de chambre.
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4">
        {/* Résumé de l'étape précédente */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle className="h-4 w-4" />
            <span className="font-medium">PDF traité avec succès</span>
          </div>
          <p className="text-green-700 text-sm mt-1">
            {pdfData?.length} chambres analysées et stockées avec votre session IP
          </p>
        </div>

        <div className="text-center p-6 border rounded-lg">
          <Users className="h-12 w-12 text-primary mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Configuration des équipes</h3>
          <p className="text-muted-foreground mb-4">
            Ajoutez les femmes de chambre qui seront responsables du nettoyage des {pdfData?.length} chambres détectées.
            Chaque femme de chambre recevra un code d'accès pour son interface.
          </p>
          <Button onClick={() => setIsHousekeeperDialogOpen(true)}>
            <Users className="mr-2 h-4 w-4" />
            {housekeepers.length > 0 ? "Modifier les équipes" : "Configurer les femmes de chambre"}
          </Button>
        </div>
        
        {housekeepers.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-800">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">{housekeepers.length} femme(s) de chambre configurée(s)</span>
            </div>
            <div className="text-blue-700 text-sm mt-1">
              {housekeepers.map((name, index) => (
                <Badge key={index} variant="outline" className="mr-1 mt-1">{name}</Badge>
              ))}
            </div>
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
        <Button
          onClick={handleWorkflowComplete}
          disabled={housekeepers.length === 0}
          variant="outline"
        >
          Terminer sans distribution
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
        <DialogContent className="sm:max-w-md md:max-w-lg lg:max-w-xl max-h-[90vh] overflow-y-auto w-[95vw] mx-auto">
          {step === 'upload' && renderUploadStep()}
          {step === 'housekeepers' && renderHousekeepersStep()}
        </DialogContent>
      </Dialog>

      <HousekeeperSetupDialog
        isOpen={isHousekeeperDialogOpen}
        onClose={() => setIsHousekeeperDialogOpen(false)}
        onHousekeepersConfirmed={handleHousekeepersConfigured}
        initialHousekeepers={housekeepers}
        roomCount={pdfData?.length || 0}
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