import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileText, 
  Download, 
  Upload, 
  Users, 
  Settings, 
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { processPdf, Room } from '@/services/pdfService';
import { useNavigate } from 'react-router-dom';
import { HousekeeperSetupDialog } from '@/components/HousekeeperSetupDialog';
import { useHousekeeping } from '@/contexts/HousekeepingContext';

type DistributionMethod = 'random' | 'floor' | 'cleaning-type';

interface AnalysisStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  active: boolean;
}

const AnalysisWorkflow = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { housekeeperNames: existingHousekeepers } = useHousekeeping();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzedRooms, setAnalyzedRooms] = useState<Room[]>([]);
  const [recommendedHousekeepers, setRecommendedHousekeepers] = useState(0);
  const [housekeeperNames, setHousekeeperNames] = useState<string[]>([]);
  const [distributionMethod, setDistributionMethod] = useState<DistributionMethod>('random');
  const [showHousekeeperDialog, setShowHousekeeperDialog] = useState(false);
  
  const steps: AnalysisStep[] = [
    {
      id: 1,
      title: "Téléchargement du rapport",
      description: "Importez votre rapport PDF",
      completed: currentStep > 1,
      active: currentStep === 1
    },
    {
      id: 2,
      title: "Analyse automatique",
      description: "Analyse du nombre de femmes de chambre recommandé",
      completed: currentStep > 2,
      active: currentStep === 2
    },
    {
      id: 3,
      title: "Configuration du personnel",
      description: "Saisie des noms des femmes de chambre",
      completed: currentStep > 3,
      active: currentStep === 3
    },
    {
      id: 4,
      title: "Type de distribution",
      description: "Choisissez la méthode de répartition",
      completed: currentStep > 4,
      active: currentStep === 4
    },
    {
      id: 5,
      title: "Application",
      description: "Application de la distribution aux chambres",
      completed: currentStep > 5,
      active: currentStep === 5
    }
  ];

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    try {
      const rooms = await processPdf(selectedFile);
      setAnalyzedRooms(rooms);
      
      // Calculer le nombre recommandé de femmes de chambre
      const roomsToClean = rooms.filter(room => 
        room.cleaningType !== 'none' && room.status !== 'maintenance'
      );
      
      const totalTime = roomsToClean.reduce((total, room) => {
        if (room.cleaningType === 'full') return total + 45; // 45 min pour nettoyage complet
        if (room.cleaningType === 'quick') return total + 25; // 25 min pour nettoyage rapide
        return total;
      }, 0);
      
      const recommended = Math.ceil(totalTime / 360); // 6 heures par personne
      setRecommendedHousekeepers(recommended);
      setCurrentStep(2);
      
      toast({
        title: "Analyse terminée",
        description: `${rooms.length} chambres analysées. ${recommended} femmes de chambre recommandées.`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur d'analyse",
        description: "Impossible d'analyser le fichier PDF."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddHousekeeper = () => {
    const newName = `Femme de chambre ${housekeeperNames.length + 1}`;
    setHousekeeperNames([...housekeeperNames, newName]);
  };

  const handleRemoveHousekeeper = (index: number) => {
    setHousekeeperNames(housekeeperNames.filter((_, i) => i !== index));
  };

  const handleHousekeeperNameChange = (index: number, newName: string) => {
    const updated = [...housekeeperNames];
    updated[index] = newName;
    setHousekeeperNames(updated);
  };

  const handleOpenHousekeeperDialog = () => {
    setShowHousekeeperDialog(true);
  };

  const handleHousekeepersConfirmed = (confirmedHousekeepers: string[]) => {
    setHousekeeperNames(confirmedHousekeepers);
    setShowHousekeeperDialog(false);
    setCurrentStep(4); // Aller directement à l'étape suivante
  };

  const handleApplyDistribution = () => {
    if (housekeeperNames.length === 0) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez ajouter au moins une femme de chambre."
      });
      return;
    }

    // Rediriger vers la page principale avec les données
    navigate('/', {
      state: {
        rooms: analyzedRooms,
        housekeepers: housekeeperNames,
        distributionMethod
      }
    });
  };

  const renderStep1 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Téléchargement du rapport PDF
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div 
          className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center"
          onDrop={(e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files);
            if (files[0]?.type === 'application/pdf') {
              setSelectedFile(files[0]);
            }
          }}
          onDragOver={(e) => e.preventDefault()}
        >
          {selectedFile ? (
            <div className="space-y-2">
              <FileText className="h-8 w-8 mx-auto text-primary" />
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <p>Glissez-déposez votre fichier PDF ici</p>
              <p className="text-sm text-muted-foreground">ou cliquez pour sélectionner</p>
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => fileInputRef.current?.click()}
            className="flex-1"
          >
            <FileText className="mr-2 h-4 w-4" />
            Sélectionner un fichier
          </Button>
          <Button 
            onClick={handleFileUpload}
            disabled={!selectedFile || isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            Analyser
          </Button>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setSelectedFile(file);
          }}
          className="hidden"
        />
      </CardContent>
    </Card>
  );

  const renderStep2 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          Analyse terminée
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p><strong>Chambres analysées :</strong> {analyzedRooms.length}</p>
              <p>
                <strong>Femmes de chambre recommandées :</strong>{' '}
                <Badge variant="default" className="bg-yellow-500 text-yellow-50 font-bold text-lg px-3 py-1">
                  {recommendedHousekeepers}
                </Badge>
              </p>
              <p className="text-sm text-muted-foreground">
                Basé sur 6 heures de travail par personne et les temps de nettoyage estimés.
              </p>
            </div>
          </AlertDescription>
        </Alert>
        
        <Button onClick={() => setCurrentStep(3)} className="w-full">
          Continuer vers la configuration du personnel
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );

  const renderStep3 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Configuration du personnel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            <strong>Nombre recommandé :</strong> {recommendedHousekeepers} femmes de chambre
          </AlertDescription>
        </Alert>

        {existingHousekeepers.length > 0 && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>{existingHousekeepers.length} femmes de chambre existantes détectées.</strong>
              <br />
              Vous pouvez les utiliser ou en ajouter de nouvelles.
            </AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-4">
          <Button 
            onClick={handleOpenHousekeeperDialog}
            className="w-full"
            size="lg"
          >
            <Users className="mr-2 h-4 w-4" />
            Configurer les femmes de chambre
          </Button>

          {housekeeperNames.length > 0 && (
            <div className="space-y-2">
              <Label>Femmes de chambre sélectionnées ({housekeeperNames.length})</Label>
              <div className="flex flex-wrap gap-2">
                {housekeeperNames.map((name, index) => (
                  <Badge key={index} variant="secondary" className="px-3 py-1">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Alert pour chambres non assignées lors de la planification */}
          {analyzedRooms.length > 0 && housekeeperNames.length > 0 && (
            (() => {
              const roomsToClean = analyzedRooms.filter(room => 
                room.cleaningType !== 'none' && room.status !== 'maintenance'
              );
              const maxRoomsPerHousekeeper = Math.ceil(roomsToClean.length / housekeeperNames.length);
              const unassignedCount = Math.max(0, roomsToClean.length - (housekeeperNames.length * 15)); // 15 chambres max par personne
              
              if (unassignedCount > 0) {
                return (
                  <Alert className="border-orange-500 bg-orange-50">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-700">
                      <div className="space-y-2">
                        <p><strong>⚠️ Attention :</strong> {unassignedCount} chambres risquent de rester non-assignées</p>
                        <p className="text-sm">
                          Avec {housekeeperNames.length} femmes de chambre, chacune aura environ {maxRoomsPerHousekeeper} chambres à nettoyer.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleOpenHousekeeperDialog}
                          className="mt-2"
                        >
                          <Users className="h-3 w-3 mr-1" />
                          Ajouter plus de femmes de chambre
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                );
              }
              return null;
            })()
          )}
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setCurrentStep(2)}
            className="flex-1"
          >
            Retour
          </Button>
          <Button 
            onClick={() => setCurrentStep(4)}
            disabled={housekeeperNames.length === 0}
            className="flex-1"
          >
            Continuer
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep4 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Type de distribution
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Méthode de répartition des chambres</Label>
          <Select value={distributionMethod} onValueChange={(value: DistributionMethod) => setDistributionMethod(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Choisissez une méthode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="random">
                <div className="space-y-1">
                  <div className="font-medium">Répartition aléatoire</div>
                  <div className="text-sm text-muted-foreground">Distribution équitable aléatoire</div>
                </div>
              </SelectItem>
              <SelectItem value="floor">
                <div className="space-y-1">
                  <div className="font-medium">Par étage</div>
                  <div className="text-sm text-muted-foreground">Assignation par étage quand possible</div>
                </div>
              </SelectItem>
              <SelectItem value="cleaning-type">
                <div className="space-y-1">
                  <div className="font-medium">Par type de nettoyage</div>
                  <div className="text-sm text-muted-foreground">Grouper par type de nettoyage</div>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Button onClick={handleApplyDistribution} className="w-full">
          Appliquer la distribution
          <CheckCircle className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Analyse de rapport</h1>
        <p className="text-muted-foreground">
          Workflow guidé pour analyser votre rapport et configurer la distribution
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className={`
              flex items-center justify-center w-8 h-8 rounded-full border-2 
              ${step.completed ? 'bg-green-600 border-green-600 text-white' : 
                step.active ? 'border-primary text-primary' : 'border-muted-foreground text-muted-foreground'}
            `}>
              {step.completed ? <CheckCircle className="h-4 w-4" /> : step.id}
            </div>
            <div className="ml-2 hidden md:block">
              <div className={`text-sm font-medium ${step.active ? 'text-foreground' : 'text-muted-foreground'}`}>
                {step.title}
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className={`w-12 h-1 mx-4 ${step.completed ? 'bg-green-600' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>

      <Progress value={(currentStep / 5) * 100} className="w-full" />

      {/* Step Content */}
      <div className="max-w-2xl mx-auto">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </div>

      <div className="text-center">
        <Button variant="outline" onClick={() => navigate('/')}>
          Retour à l'accueil
        </Button>
      </div>

      {/* Dialog de configuration des femmes de chambre */}
      <HousekeeperSetupDialog
        isOpen={showHousekeeperDialog}
        onClose={() => setShowHousekeeperDialog(false)}
        onHousekeepersConfirmed={handleHousekeepersConfirmed}
        initialHousekeepers={housekeeperNames}
        existingHousekeepers={existingHousekeepers}
        roomCount={analyzedRooms.length}
      />
    </div>
  );
};

export default AnalysisWorkflow;