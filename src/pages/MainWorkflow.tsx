import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, 
  FileText, 
  Users, 
  Settings, 
  Smartphone, 
  QrCode,
  CheckCircle,
  Clock,
  MapPin,
  Plus,
  Download,
  Share
} from "lucide-react";
import { WorkflowService, type WorkflowState, type Room, type Housekeeper } from "@/services/WorkflowService";
import { AccessCodeService } from "@/services/AccessCodeService";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MainWorkflow: React.FC = () => {
  const [workflowState, setWorkflowState] = useState<WorkflowState>(WorkflowService.getState());
  const [currentStep, setCurrentStep] = useState<'connect' | 'upload' | 'personnel' | 'distribute' | 'mobile'>('connect');
  
  // États pour les étapes
  const [hotelCode, setHotelCode] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [newHousekeeperName, setNewHousekeeperName] = useState('');
  const [distributionMethod, setDistributionMethod] = useState<'random' | 'floor' | 'balanced'>('balanced');
  const [isDistributing, setIsDistributing] = useState(false);
  const [showQRCodes, setShowQRCodes] = useState(false);

  // Synchronisation temps réel
  const { connectionStatus, isConnected } = useRealtimeSync({
    hotelId: workflowState.hotel?.id,
    tables: ['rooms', 'assignments', 'housekeepers', 'user_sessions'],
    onUpdate: (payload) => {
      console.log('📡 Mise à jour temps réel:', payload);
      // Recharger les données si nécessaire
      if (workflowState.hotel) {
        WorkflowService.loadHousekeepers();
      }
    }
  });

  // S'abonner aux changements du WorkflowService
  useEffect(() => {
    const unsubscribe = WorkflowService.subscribe((newState) => {
      setWorkflowState(newState);
    });

    return unsubscribe;
  }, []);

  // Étape 1: Connexion client
  const handleConnect = async () => {
    if (!hotelCode.trim()) {
      toast({
        variant: "destructive",
        title: "Code requis",
        description: "Veuillez saisir votre code hôtel"
      });
      return;
    }

    setIsConnecting(true);
    try {
      await WorkflowService.connectClient(hotelCode);
      setCurrentStep('upload');
    } catch (error) {
      console.error('Erreur connexion:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  // Étape 2: Upload et analyse PDF
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setUploadedFile(file);
    } else {
      toast({
        variant: "destructive",
        title: "Format invalide",
        description: "Veuillez sélectionner un fichier PDF"
      });
    }
  };

  const handleAnalyze = async () => {
    if (!uploadedFile) return;

    setIsAnalyzing(true);
    try {
      await WorkflowService.analyzeReport(uploadedFile);
      setCurrentStep('personnel');
    } catch (error) {
      console.error('Erreur analyse:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Étape 3: Gestion personnel
  const handleAddHousekeeper = async () => {
    if (!newHousekeeperName.trim()) {
      toast({
        variant: "destructive",
        title: "Nom requis",
        description: "Veuillez saisir un nom"
      });
      return;
    }

    try {
      await WorkflowService.createHousekeeper(newHousekeeperName);
      setNewHousekeeperName('');
    } catch (error) {
      console.error('Erreur ajout femme de chambre:', error);
    }
  };

  const handleLoadPersonnel = async () => {
    if (workflowState.housekeepers.length === 0) {
      toast({
        variant: "destructive",
        title: "Personnel requis",
        description: "Ajoutez au moins une femme de chambre"
      });
      return;
    }
    setCurrentStep('distribute');
  };

  // Étape 4: Distribution
  const handleDistribute = async () => {
    setIsDistributing(true);
    try {
      await WorkflowService.distributeRooms(distributionMethod);
      setCurrentStep('mobile');
    } catch (error) {
      console.error('Erreur distribution:', error);
    } finally {
      setIsDistributing(false);
    }
  };

  // Étape 5: Accès mobile et QR codes
  const generateQRCode = (housekeeper: Housekeeper) => {
    const qrUrl = WorkflowService.generateAccessQRCode(housekeeper);
    
    // Ouvrir dans un nouvel onglet pour génération QR
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}`;
    window.open(qrApiUrl, '_blank');
  };

  const copyAccessCode = async (code: string) => {
    await AccessCodeService.copyCodeToClipboard(code);
  };

  const resetWorkflow = () => {
    WorkflowService.reset();
    setCurrentStep('connect');
    setHotelCode('');
    setUploadedFile(null);
    setNewHousekeeperName('');
  };

  const getStepProgress = () => {
    const steps = ['connect', 'upload', 'personnel', 'distribute', 'mobile'];
    return ((steps.indexOf(currentStep) + 1) / steps.length) * 100;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header avec progression */}
        <Card className="shadow-modern-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              NetBloc - Solution Housekeeping Complète
            </CardTitle>
            <div className="space-y-2">
              <Progress value={getStepProgress()} className="w-full" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span className={currentStep === 'connect' ? 'text-primary font-medium' : ''}>1. Connexion</span>
                <span className={currentStep === 'upload' ? 'text-primary font-medium' : ''}>2. Analyse</span>
                <span className={currentStep === 'personnel' ? 'text-primary font-medium' : ''}>3. Personnel</span>
                <span className={currentStep === 'distribute' ? 'text-primary font-medium' : ''}>4. Distribution</span>
                <span className={currentStep === 'mobile' ? 'text-primary font-medium' : ''}>5. Mobile</span>
              </div>
            </div>
            
            {/* Indicateur connexion temps réel */}
            <div className="flex items-center justify-center gap-2 mt-4">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-muted-foreground">
                {isConnected ? 'Synchronisation active' : 'Hors ligne'}
              </span>
            </div>
          </CardHeader>
        </Card>

        {/* Étape 1: Connexion Client */}
        {currentStep === 'connect' && (
          <Card className="shadow-modern-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Connexion à votre établissement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="hotelCode">Code de votre hôtel</Label>
                <Input
                  id="hotelCode"
                  placeholder="Ex: HTL001"
                  value={hotelCode}
                  onChange={(e) => setHotelCode(e.target.value.toUpperCase())}
                  className="text-lg"
                />
              </div>
              <Button 
                onClick={handleConnect} 
                disabled={isConnecting || !hotelCode.trim()}
                className="w-full"
                size="lg"
              >
                {isConnecting ? 'Connexion...' : 'Se connecter'}
              </Button>
              
              {workflowState.hotel && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800">
                      Connecté à {workflowState.hotel.name}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Étape 2: Upload & Analyse */}
        {currentStep === 'upload' && (
          <Card className="shadow-modern-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Analyse de votre rapport
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <div className="space-y-2">
                  <Label htmlFor="pdfUpload" className="text-lg font-medium cursor-pointer">
                    Glissez votre rapport PDF ici ou cliquez pour sélectionner
                  </Label>
                  <Input
                    id="pdfUpload"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
                
                {uploadedFile && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <span className="text-blue-800 font-medium">
                      📄 {uploadedFile.name}
                    </span>
                  </div>
                )}
              </div>

              <Button
                onClick={handleAnalyze}
                disabled={!uploadedFile || isAnalyzing}
                className="w-full"
                size="lg"
              >
                {isAnalyzing ? 'Analyse en cours...' : 'Analyser le rapport'}
              </Button>

              {workflowState.isAnalyzed && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800">
                      {workflowState.rooms.length} chambres détectées et analysées
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Étape 3: Gestion Personnel */}
        {currentStep === 'personnel' && (
          <div className="grid lg:grid-cols-2 gap-6">
            
            {/* Personnel existant */}
            <Card className="shadow-modern-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Personnel existant
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {workflowState.housekeepers.length > 0 ? (
                  <div className="space-y-2">
                    {workflowState.housekeepers.map((hk) => (
                      <div key={hk.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <span className="font-medium">{hk.name}</span>
                          <div className="text-sm text-muted-foreground">
                            Code: {hk.access_code}
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          Active
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Aucun personnel existant</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Ajouter nouveau personnel */}
            <Card className="shadow-modern-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Nouveau personnel
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="housekeeperName">Nom de la femme de chambre</Label>
                  <Input
                    id="housekeeperName"
                    placeholder="Ex: Marie Dupont"
                    value={newHousekeeperName}
                    onChange={(e) => setNewHousekeeperName(e.target.value)}
                  />
                </div>
                
                <Button
                  onClick={handleAddHousekeeper}
                  disabled={!newHousekeeperName.trim()}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter et générer code
                </Button>

                <Separator />

                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    Ou inviter par email
                  </p>
                  <Button variant="outline" className="w-full">
                    <Share className="h-4 w-4 mr-2" />
                    Envoyer invitation
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Bouton continuer pour étape personnel */}
        {currentStep === 'personnel' && (
          <Card>
            <CardContent className="pt-6">
              <Button
                onClick={handleLoadPersonnel}
                disabled={workflowState.housekeepers.length === 0}
                className="w-full"
                size="lg"
              >
                Continuer vers la distribution ({workflowState.housekeepers.length} femme(s) de chambre)
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Étape 4: Distribution */}
        {currentStep === 'distribute' && (
          <Card className="shadow-modern-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Distribution des chambres
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Résumé */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {workflowState.rooms.length}
                  </div>
                  <div className="text-sm text-blue-800">Chambres total</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {workflowState.housekeepers.length}
                  </div>
                  <div className="text-sm text-green-800">Femmes de chambre</div>
                </div>
              </div>

              {/* Méthode de distribution */}
              <div className="space-y-2">
                <Label>Méthode de distribution</Label>
                <Select value={distributionMethod} onValueChange={(value: any) => setDistributionMethod(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balanced">Équilibrée (recommandé)</SelectItem>
                    <SelectItem value="floor">Par étage</SelectItem>
                    <SelectItem value="random">Aléatoire</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleDistribute}
                disabled={isDistributing}
                className="w-full"
                size="lg"
              >
                {isDistributing ? 'Distribution en cours...' : 'Exécuter la distribution'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Étape 5: Interface Mobile & QR Codes */}
        {currentStep === 'mobile' && (
          <div className="space-y-6">
            
            <Card className="shadow-modern-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Accès mobile configuré
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center p-6 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-600" />
                  <h3 className="text-xl font-bold text-green-800 mb-2">
                    Distribution terminée avec succès!
                  </h3>
                  <p className="text-green-700">
                    {workflowState.rooms.length} chambres assignées à {workflowState.housekeepers.length} femme(s) de chambre
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Codes d'accès et QR codes */}
            <div className="grid lg:grid-cols-2 gap-6">
              
              <Card className="shadow-modern-lg">
                <CardHeader>
                  <CardTitle>Codes d'accès mobile</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {workflowState.housekeepers.map((hk) => (
                    <div key={hk.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{hk.name}</span>
                        <Badge variant="outline">Active</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="px-2 py-1 bg-muted rounded text-sm font-mono">
                          {hk.access_code}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyAccessCode(hk.access_code)}
                        >
                          Copier
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => generateQRCode(hk)}
                        >
                          <QrCode className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="shadow-modern-lg">
                <CardHeader>
                  <CardTitle>Actions disponibles</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => window.open('/mobile', '_blank')}
                  >
                    <Smartphone className="h-4 w-4 mr-2" />
                    Tester interface mobile
                  </Button>
                  
                  <Button variant="outline" className="w-full justify-start">
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger rapport PDF
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => setShowQRCodes(true)}
                  >
                    <QrCode className="h-4 w-4 mr-2" />
                    Afficher tous les QR codes
                  </Button>

                  <Separator />

                  <Button 
                    variant="destructive" 
                    className="w-full"
                    onClick={resetWorkflow}
                  >
                    Nouveau workflow
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

      </div>

      {/* Dialog QR Codes */}
      <Dialog open={showQRCodes} onOpenChange={setShowQRCodes}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>QR Codes d'accès mobile</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {workflowState.housekeepers.map((hk) => (
              <div key={hk.id} className="text-center p-4 border rounded-lg">
                <h4 className="font-medium mb-2">{hk.name}</h4>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(WorkflowService.generateAccessQRCode(hk))}`}
                  alt={`QR Code ${hk.name}`}
                  className="mx-auto mb-2"
                />
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {hk.access_code}
                </code>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MainWorkflow;