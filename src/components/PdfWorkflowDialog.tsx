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
import { FileUp, Users, ArrowRight, CheckCircle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { AccessCodeManagementService } from "@/services/accessCodeManagementService";

interface PdfWorkflowDialogProps {
  onWorkflowComplete: (data: any, housekeepers?: string[], distributionMethod?: 'random' | 'floor' | 'cleaning-type') => void;
  hotelId?: string;
}

export function PdfWorkflowDialog({ onWorkflowComplete, hotelId }: PdfWorkflowDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'housekeepers' | 'distribution'>('upload');
  const [pdfData, setPdfData] = useState<any>(null);
  const [housekeepers, setHousekeepers] = useState<string[]>([]);
  const [newHousekeeperName, setNewHousekeeperName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [existingHousekeepers, setExistingHousekeepers] = useState<any[]>([]);
  const [selectedExisting, setSelectedExisting] = useState<string[]>([]);
  const [isLoadingHousekeepers, setIsLoadingHousekeepers] = useState(false);

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
      setPdfData(data);
      
      toast({
        title: "PDF analysé avec succès",
        description: `${data.length} chambres détectées. Configurez maintenant vos femmes de chambre.`,
      });

      // Charger les femmes de chambre existantes et passer à l'étape suivante
      await loadExistingHousekeepers();
      setStep('housekeepers');
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

  const addHousekeeper = () => {
    if (newHousekeeperName.trim() && !housekeepers.includes(newHousekeeperName.trim())) {
      setHousekeepers([...housekeepers, newHousekeeperName.trim()]);
      setNewHousekeeperName('');
    }
  };

  const removeHousekeeper = (index: number) => {
    setHousekeepers(housekeepers.filter((_, i) => i !== index));
  };

  const loadExistingHousekeepers = async () => {
    if (!hotelId) return;
    
    try {
      setIsLoadingHousekeepers(true);
      
      // Load both housekeepers and their access codes
      const [housekeepersWithCodes, accessCodes] = await Promise.all([
        AccessCodeManagementService.getHousekeepersWithCodes(hotelId),
        AccessCodeManagementService.getHotelAccessCodes(hotelId)
      ]);
      
      // Enhance housekeepers data with access codes
      const enhancedHousekeepers = housekeepersWithCodes.map(hk => {
        const relatedCode = accessCodes.find(code => code.housekeeper_id === hk.id);
        return {
          ...hk,
          current_access_code: relatedCode?.access_code || hk.access_code,
          code_is_active: relatedCode?.is_active ?? true,
          code_used_at: relatedCode?.used_at
        };
      });
      
      setExistingHousekeepers(enhancedHousekeepers);
    } catch (error) {
      console.error('Erreur chargement femmes de chambre:', error);
    } finally {
      setIsLoadingHousekeepers(false);
    }
  };

  const toggleExistingHousekeeper = (name: string) => {
    setSelectedExisting(prev => 
      prev.includes(name) 
        ? prev.filter(n => n !== name)
        : [...prev, name]
    );
  };

  const resetDialog = () => {
    setSelectedFile(null);
    setPdfData(null);
    setStep('upload');
    setHousekeepers([]);
    setNewHousekeeperName('');
    setSelectedExisting([]);
    setExistingHousekeepers([]);
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
          Importer un Rapport PDF
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
          {pdfData?.length} chambres détectées. Ajoutez les femmes de chambre qui seront responsables du nettoyage.
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
            {pdfData?.length} chambres analysées
          </p>
        </div>

        {/* Section pour les femmes de chambre existantes avec codes */}
        {(existingHousekeepers.length > 0 || isLoadingHousekeepers) && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-green-700">
              ✅ Femmes de chambre existantes avec codes d'accès
            </div>
            
            {isLoadingHousekeepers ? (
              <div className="text-center py-4 text-muted-foreground">
                Chargement des femmes de chambre...
              </div>
            ) : (
              <div className="space-y-3">
                {existingHousekeepers.map((housekeeper) => (
                  <div
                    key={housekeeper.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedExisting.includes(housekeeper.name) 
                        ? 'bg-primary/10 border-primary' 
                        : 'bg-muted/50 hover:bg-muted'
                    }`}
                    onClick={() => toggleExistingHousekeeper(housekeeper.name)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        selectedExisting.includes(housekeeper.name) ? 'bg-primary border-primary' : 'border-muted-foreground'
                      }`}>
                        {selectedExisting.includes(housekeeper.name) && (
                          <div className="w-2 h-2 bg-white rounded-full" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{housekeeper.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Code: {housekeeper.current_access_code || housekeeper.access_code || 'Aucun code'}
                        </div>
                        {housekeeper.code_used_at && (
                          <div className="text-xs text-green-600">
                            Dernière utilisation: {new Date(housekeeper.code_used_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <Badge 
                          variant={housekeeper.is_active && housekeeper.code_is_active ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {housekeeper.is_active && housekeeper.code_is_active ? '✅ Actif' : '⏸️ Inactif'}
                        </Badge>
                        {housekeeper.current_access_code && (
                          <Badge variant="outline" className="text-xs">
                            🔑 Code permanent
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Ajouter une nouvelle femme de chambre */}
        <div className="space-y-2">
          <div className="text-sm font-medium">➕ Ajouter une nouvelle femme de chambre</div>
          <div className="flex gap-2">
            <Input
              placeholder="Nom de la femme de chambre"
              value={newHousekeeperName}
              onChange={(e) => setNewHousekeeperName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addHousekeeper();
                }
              }}
            />
            <Button onClick={addHousekeeper} disabled={!newHousekeeperName.trim()}>
              <Users className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          </div>
        </div>

        {/* Liste des nouvelles femmes de chambre */}
        {housekeepers.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Nouvelles femmes de chambre ({housekeepers.length})</h4>
            <div className="space-y-2">
              {housekeepers.map((name, index) => (
                <Card key={index} className="p-3">
                  <div className="flex items-center justify-between">
                    <span>{name}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeHousekeeper(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
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
          onClick={() => setStep('distribution')}
          disabled={selectedExisting.length === 0 && housekeepers.length === 0}
        >
          Choisir la distribution
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </DialogFooter>
    </>
  );

  const renderDistributionStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">Étape 3/3</Badge>
          Méthode de distribution
        </DialogTitle>
        <DialogDescription>
          Comment souhaitez-vous distribuer les {pdfData?.length} chambres aux {housekeepers.length} femmes de chambre ?
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4">
        {/* Résumé */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-800">
            <CheckCircle className="h-4 w-4" />
            <span className="font-medium">{selectedExisting.length + housekeepers.length} femmes de chambre configurées</span>
          </div>
          <div className="text-blue-700 text-sm mt-1 space-x-2">
            {selectedExisting.map((name, index) => (
              <Badge key={`existing-${index}`} variant="outline" className="bg-green-100">{name} ✅</Badge>
            ))}
            {housekeepers.map((name, index) => (
              <Badge key={`new-${index}`} variant="outline">{name} ➕</Badge>
            ))}
          </div>
        </div>

        {/* Options de distribution */}
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full h-auto flex flex-col items-start p-4"
            onClick={() => {
              const allHousekeepers = [...selectedExisting, ...housekeepers];
              onWorkflowComplete(pdfData, allHousekeepers, 'random');
              setOpen(false);
              resetDialog();
            }}
          >
            <div className="font-medium">🎲 Distribution aléatoire</div>
            <div className="text-sm text-muted-foreground">Répartition équitable et aléatoire des chambres</div>
          </Button>
          
          <Button
            variant="outline"
            className="w-full h-auto flex flex-col items-start p-4"
            onClick={() => {
              const allHousekeepers = [...selectedExisting, ...housekeepers];
              onWorkflowComplete(pdfData, allHousekeepers, 'floor');
              setOpen(false);
              resetDialog();
            }}
          >
            <div className="font-medium">🏢 Distribution par étage</div>
            <div className="text-sm text-muted-foreground">Chambres d'étages proches pour la même femme de chambre</div>
          </Button>
          
          <Button
            variant="outline"
            className="w-full h-auto flex flex-col items-start p-4"
            onClick={() => {
              const allHousekeepers = [...selectedExisting, ...housekeepers];
              onWorkflowComplete(pdfData, allHousekeepers, 'cleaning-type');
              setOpen(false);
              resetDialog();
            }}
          >
            <div className="font-medium">🔴⚪ Distribution par type de nettoyage</div>
            <div className="text-sm text-muted-foreground">Séparer les chambres à blanc et les recouches</div>
          </Button>
          
          <Button
            variant="outline"
            className="w-full h-auto flex flex-col items-start p-4"
            onClick={() => {
              const allHousekeepers = [...selectedExisting, ...housekeepers];
              onWorkflowComplete(pdfData, allHousekeepers);
              setOpen(false);
              resetDialog();
            }}
          >
            <div className="font-medium">⚡ Terminer sans distribution automatique</div>
            <div className="text-sm text-muted-foreground">Vous pourrez distribuer manuellement les chambres plus tard</div>
          </Button>
        </div>
      </div>
      
      <DialogFooter>
        <Button variant="outline" onClick={() => setStep('housekeepers')}>
          Retour
        </Button>
      </DialogFooter>
    </>
  );

  return (
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
        {step === 'distribution' && renderDistributionStep()}
      </DialogContent>
    </Dialog>
  );
}