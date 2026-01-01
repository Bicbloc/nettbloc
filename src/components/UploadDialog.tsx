import { useState, useRef, useEffect } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/use-toast";
import { processPdf } from "@/services/pdfService";
import { FileUp, Sparkles, FileText, Plug, Clock, ArrowLeft, Zap, Trash2 } from "lucide-react";
import { HousekeeperSetupDialog } from './HousekeeperSetupDialog';
import { unifiedParserService } from "@/services/pms";
import { detectionCache } from "@/services/pms/DetectionCache";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface UploadDialogProps {
  onPdfProcessed: (data: any, distributionMethod?: 'random' | 'floor' | 'cleaning-type') => void;
  existingHousekeepers?: string[];
  hotelId?: string;
}

type ImportMethod = 'choice' | 'pdf' | 'api';

export function UploadDialog({ onPdfProcessed, existingHousekeepers = [], hotelId }: UploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [showDistributionOptions, setShowDistributionOptions] = useState(false);
  const [processedData, setProcessedData] = useState<any>(null);
  const [showHousekeeperSetup, setShowHousekeeperSetup] = useState(false);
  const [selectedHousekeepers, setSelectedHousekeepers] = useState<string[]>([]);
  const [hasLearnedPattern, setHasLearnedPattern] = useState(false);
  const [importMethod, setImportMethod] = useState<ImportMethod>('choice');
  const [forceAiExtraction, setForceAiExtraction] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Charger les patterns pour cet hôtel via le service unifié
  useEffect(() => {
    async function loadPatterns() {
      if (hotelId) {
        await unifiedParserService.loadHotelPatterns(hotelId);
        setHasLearnedPattern(true);
      }
    }
    loadPatterns();
  }, [hotelId]);

  // Reset import method when dialog closes
  useEffect(() => {
    if (!open) {
      setImportMethod('choice');
    }
  }, [open]);

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
      console.log("Traitement du fichier:", selectedFile.name, "hotelId:", hotelId, "forceAi:", forceAiExtraction);
      
      // Passer l'option forceAi au service
      const data = await processPdf(selectedFile, hotelId, forceAiExtraction);
      console.log("Données traitées:", data.length, "chambres", forceAiExtraction ? "(IA forcée)" : "");
      
      setProcessedData(data);
      setShowHousekeeperSetup(true);
      
      toast({
        title: "Téléversement réussi",
        description: `${data.length} chambres traitées depuis ${selectedFile.name}${forceAiExtraction ? ' (extraction IA)' : ''}`,
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
      setImportMethod('choice');
      setForceAiExtraction(false);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Écran de choix de méthode d'import
  const renderMethodChoice = () => (
    <>
      <DialogHeader>
        <DialogTitle>Importer les chambres</DialogTitle>
        <DialogDescription>
          Choisissez comment importer les données de vos chambres
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-3 py-4">
        {/* Option PDF */}
        <button
          onClick={() => setImportMethod('pdf')}
          className="w-full p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-left group"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <FileUp className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Télécharger un rapport PDF</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Importez un rapport depuis votre PMS (Mews, Apaleo, Opera, Protel, etc.)
              </p>
              <div className="flex items-center gap-2 mt-2">
                {hasLearnedPattern ? (
                  <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                    <Sparkles className="h-3 w-3 mr-1" />
                    IA entraînée
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    <FileText className="h-3 w-3 mr-1" />
                    Extraction auto
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </button>

        {/* Option API - Coming Soon */}
        <div className="w-full p-4 rounded-lg border-2 border-dashed border-border bg-muted/30 relative overflow-hidden">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-muted text-muted-foreground">
              <Plug className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-muted-foreground">Connexion API</h3>
                <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-600 bg-amber-500/10">
                  <Clock className="h-3 w-3 mr-1" />
                  Bientôt disponible
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Synchronisation automatique avec votre PMS
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-background border text-xs text-muted-foreground">
                  <img 
                    src="/lovable-uploads/fab4ce53-a146-478a-a585-fab338cb0095.png" 
                    alt="Mews" 
                    className="h-4 w-4 object-contain grayscale opacity-60"
                  />
                  Mews
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-background border text-xs text-muted-foreground">
                  <img 
                    src="/lovable-uploads/d6290f4a-190e-4ad8-99a9-51307a4cbcc8.png" 
                    alt="Apaleo" 
                    className="h-4 w-4 object-contain grayscale opacity-60"
                  />
                  Apaleo
                </div>
                <span className="text-xs text-muted-foreground">et plus...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  // Écran d'upload PDF
  const renderPdfUpload = () => (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setImportMethod('choice')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <DialogTitle>Importer un Rapport PDF</DialogTitle>
            <DialogDescription>
              Téléversez un rapport pour analyser les statuts des chambres
            </DialogDescription>
          </div>
        </div>
        {/* Indicateur du mode d'extraction */}
        <div className={`mt-3 p-2 rounded-md text-sm flex items-center gap-2 ${
          hasLearnedPattern 
            ? 'bg-primary/10 text-primary border border-primary/20' 
            : 'bg-muted text-muted-foreground'
        }`}>
          {hasLearnedPattern ? (
            <>
              <Sparkles className="h-4 w-4" />
              <span>Extraction IA avec modèle entraîné</span>
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" />
              <span>Extraction standard (regex)</span>
            </>
          )}
        </div>
      </DialogHeader>
      
      {/* Option Forcer Extraction IA */}
      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <Zap className="h-5 w-5 text-amber-500" />
          <div>
            <Label htmlFor="force-ai" className="font-medium cursor-pointer">
              Forcer extraction IA
            </Label>
            <p className="text-xs text-muted-foreground">
              Utilise l'IA même si l'extraction locale fonctionne
            </p>
          </div>
        </div>
        <Switch
          id="force-ai"
          checked={forceAiExtraction}
          onCheckedChange={setForceAiExtraction}
        />
      </div>

      {/* Bouton Vider le cache */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-muted-foreground hover:text-destructive"
        onClick={() => {
          if (hotelId) {
            detectionCache.invalidateForHotel(hotelId);
            unifiedParserService.invalidateCacheForHotel(hotelId);
            toast({
              title: "Cache vidé",
              description: "Le cache d'analyse a été réinitialisé.",
            });
          }
        }}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Vider le cache d'analyse
      </Button>

      <div 
        className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={triggerFileInput}
      >
        <div className="space-y-4">
          <div className="flex justify-center">
            <FileUp className="h-10 w-10 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">
              {selectedFile ? selectedFile.name : "Glissez et déposez votre fichier ici"}
            </p>
            {!selectedFile && (
              <p className="text-xs text-muted-foreground mt-1">
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
          onClick={() => setImportMethod('choice')}
          disabled={isUploading}
        >
          Retour
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
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <FileUp className="mr-2 h-4 w-4" />
          Importer les chambres
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <ScrollArea className="flex-1 pr-4 -mr-4">
          {!showHousekeeperSetup && !showDistributionOptions ? (
            importMethod === 'choice' ? renderMethodChoice() : renderPdfUpload()
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
                  setImportMethod('choice');
                }}
                onHousekeepersConfirmed={handleHousekeepersConfirmed}
                existingHousekeepers={existingHousekeepers}
                roomCount={processedData?.length || 0}
                hotelId={hotelId}
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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
