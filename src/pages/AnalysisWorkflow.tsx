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
  Loader2,
  Search,
  X
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { processPdf, Room } from '@/services/pdfService';
import { useNavigate } from 'react-router-dom';
import { AccessCodeManagementService } from '@/services/accessCodeManagementService';

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
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzedRooms, setAnalyzedRooms] = useState<Room[]>([]);
  const [recommendedHousekeepers, setRecommendedHousekeepers] = useState(0);
  const [housekeeperNames, setHousekeeperNames] = useState<string[]>([]);
  const [distributionMethod, setDistributionMethod] = useState<DistributionMethod>('random');
  const [existingHousekeepers, setExistingHousekeepers] = useState<any[]>([]);
  const [selectedExisting, setSelectedExisting] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllExisting, setShowAllExisting] = useState(false);
  const [isLoadingHousekeepers, setIsLoadingHousekeepers] = useState(false);
  
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

  const loadExistingHousekeepers = async () => {
    const selectedHotelId = localStorage.getItem('selectedHotelId');
    if (!selectedHotelId) return;
    
    try {
      setIsLoadingHousekeepers(true);
      const [housekeepersWithCodes, accessCodes] = await Promise.all([
        AccessCodeManagementService.getHousekeepersWithCodes(selectedHotelId),
        AccessCodeManagementService.getHotelAccessCodes(selectedHotelId)
      ]);
      
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

  const filteredExistingHousekeepers = existingHousekeepers.filter(hk => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      hk.name.toLowerCase().includes(query) ||
      (hk.current_access_code || hk.access_code || '').toLowerCase().includes(query)
    );
  });

  useEffect(() => {
    if (currentStep === 3) {
      loadExistingHousekeepers();
    }
  }, [currentStep]);

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

        {/* Barre de recherche */}
        <div className="space-y-2">
          <Label>Rechercher une femme de chambre existante</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou code d'accès..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Femmes de chambre existantes */}
        {(existingHousekeepers.length > 0 || isLoadingHousekeepers) && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-green-700">
                ✅ Femmes de chambre existantes ({filteredExistingHousekeepers.length})
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAllExisting(!showAllExisting)}
              >
                {showAllExisting ? 'Masquer' : 'Voir tout'}
              </Button>
            </div>
            
            {isLoadingHousekeepers ? (
              <div className="text-center py-4 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                Chargement des femmes de chambre...
              </div>
            ) : showAllExisting || searchQuery ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredExistingHousekeepers.map((housekeeper) => (
                  <div
                    key={housekeeper.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
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
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{housekeeper.name}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          Code: {housekeeper.current_access_code || housekeeper.access_code || 'Aucun'}
                        </div>
                      </div>
                      <Badge 
                        variant={housekeeper.is_active && housekeeper.code_is_active ? "default" : "secondary"}
                        className="text-xs shrink-0"
                      >
                        {housekeeper.is_active && housekeeper.code_is_active ? '✅' : '⏸️'}
                      </Badge>
                    </div>
                  </div>
                ))}
                {filteredExistingHousekeepers.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    Aucune femme de chambre trouvée
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-2">
                Cliquez sur "Voir tout" ou utilisez la recherche
              </div>
            )}
          </div>
        )}

        {/* Section sélection actuelle */}
        {selectedExisting.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Femmes existantes sélectionnées ({selectedExisting.length})
            </Label>
            <div className="flex flex-wrap gap-2">
              {selectedExisting.map((name) => (
                <Badge key={name} variant="secondary" className="gap-1">
                  {name}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-destructive" 
                    onClick={() => toggleExistingHousekeeper(name)}
                  />
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {/* Ajouter nouvelles femmes de chambre */}
        <div className="space-y-2">
          <Label>➕ Ajouter une nouvelle femme de chambre</Label>
          <div className="space-y-2">
            {housekeeperNames.map((name, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={name}
                  onChange={(e) => handleHousekeeperNameChange(index, e.target.value)}
                  placeholder={`Femme de chambre ${index + 1}`}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemoveHousekeeper(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={handleAddHousekeeper} className="w-full">
            <Users className="mr-2 h-4 w-4" />
            Ajouter une femme de chambre
          </Button>
        </div>

        {/* Total sélectionné */}
        {(selectedExisting.length > 0 || housekeeperNames.length > 0) && (
          <Alert>
            <AlertDescription>
              <strong>Total sélectionné :</strong> {selectedExisting.length + housekeeperNames.length} femmes de chambre
              {selectedExisting.length > 0 && ` (${selectedExisting.length} existantes, ${housekeeperNames.length} nouvelles)`}
            </AlertDescription>
          </Alert>
        )}
        
        <Button 
          onClick={() => {
            const allSelected = [...selectedExisting, ...housekeeperNames];
            if (allSelected.length === 0) {
              toast({
                variant: "destructive",
                title: "Erreur",
                description: "Veuillez sélectionner ou ajouter au moins une femme de chambre."
              });
              return;
            }
            setHousekeeperNames(allSelected);
            setCurrentStep(4);
          }}
          className="w-full"
        >
          Continuer
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
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
    </div>
  );
};

export default AnalysisWorkflow;