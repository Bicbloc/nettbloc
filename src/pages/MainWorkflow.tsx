import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Upload, Users, Settings, BarChart3, Download, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { processPdf, Room as PdfRoom } from "@/services/pdfService";
import { supabase } from "@/integrations/supabase/client";
import QRCode from "qrcode";

interface Housekeeper {
  id: string;
  name: string;
  access_code: string;
  is_active: boolean;
}

interface Room {
  number: string;
  floor?: number;
  cleaningType: string;
  assignedTo?: string;
  estimatedTime?: number;
  status?: string;
  priority?: string;
}

type WorkflowStep = 'upload' | 'housekeepers' | 'distribution' | 'mobile';
type DistributionMethod = 'random' | 'floor' | 'cleaning-type';

export default function MainWorkflow() {
  const { isAuthenticated, loading } = useAuth();
  const { toast } = useToast();
  
  // États du workflow
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('upload');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [existingHousekeepers, setExistingHousekeepers] = useState<Housekeeper[]>([]);
  const [selectedHousekeepers, setSelectedHousekeepers] = useState<string[]>([]);
  const [newHousekeeperName, setNewHousekeeperName] = useState("");
  const [distributionMethod, setDistributionMethod] = useState<DistributionMethod>('random');
  const [hotelId, setHotelId] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  // États pour l'interface mobile
  const [showMobileInterface, setShowMobileInterface] = useState(false);
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});

  if (!loading && !isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  useEffect(() => {
    loadHotelData();
  }, []);

  const loadHotelData = async () => {
    const savedHotelId = localStorage.getItem('selectedHotelId');
    if (savedHotelId) {
      setHotelId(savedHotelId);
      await loadExistingHousekeepers(savedHotelId);
    }
  };

  const loadExistingHousekeepers = async (hotelId: string) => {
    try {
      const { data, error } = await supabase
        .from('housekeepers')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('is_active', true);

      if (error) throw error;
      setExistingHousekeepers(data || []);
    } catch (error) {
      console.error('Erreur chargement femmes de chambre:', error);
    }
  };

  // ÉTAPE 1: Upload PDF
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      toast({
        variant: "destructive",
        title: "Fichier invalide",
        description: "Veuillez sélectionner un fichier PDF"
      });
      return;
    }

    setPdfFile(file);
    setIsProcessing(true);

    try {
      const processedRooms = await processPdf(file);
      setRooms(processedRooms);
      
      toast({
        title: "Rapport analysé",
        description: `${processedRooms.length} chambres détectées`
      });
      
      setCurrentStep('housekeepers');
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur d'analyse",
        description: "Impossible d'analyser le rapport PDF"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // ÉTAPE 2: Gestion des femmes de chambre
  const handleAddNewHousekeeper = async () => {
    if (!newHousekeeperName.trim()) return;

    try {
      const accessCode = `HTL-${Date.now().toString().slice(-4)}-${newHousekeeperName.slice(0,3).toUpperCase()}`;
      
      const { data, error } = await supabase
        .from('housekeepers')
        .insert({
          hotel_id: hotelId,
          name: newHousekeeperName,
          access_code: accessCode,
          user_id: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;

      const newHousekeeper: Housekeeper = {
        id: data.id,
        name: newHousekeeperName,
        access_code: accessCode,
        is_active: true
      };

      setExistingHousekeepers(prev => [...prev, newHousekeeper]);
      setSelectedHousekeepers(prev => [...prev, newHousekeeper.id]);
      setNewHousekeeperName("");

      toast({
        title: "Femme de chambre ajoutée",
        description: `${newHousekeeperName} - Code: ${accessCode}`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'ajouter la femme de chambre"
      });
    }
  };

  const sendInvitationEmail = async (housekeeper: Housekeeper) => {
    // Logique d'envoi d'email d'invitation
    toast({
      title: "Invitation envoyée",
      description: `Email envoyé à ${housekeeper.name}`
    });
  };

  // ÉTAPE 3: Distribution
  const executeDistribution = async () => {
    const selectedHousekeepersData = existingHousekeepers.filter(h => 
      selectedHousekeepers.includes(h.id)
    );

    if (selectedHousekeepersData.length === 0) {
      toast({
        variant: "destructive",
        title: "Aucune femme de chambre sélectionnée",
        description: "Sélectionnez au moins une femme de chambre"
      });
      return;
    }

    // Distribution selon la méthode choisie
    let distributedRooms = [...rooms];
    
    switch (distributionMethod) {
      case 'random':
        distributedRooms = distributeRandomly(rooms, selectedHousekeepersData);
        break;
      case 'floor':
        distributedRooms = distributeByFloor(rooms, selectedHousekeepersData);
        break;
      case 'cleaning-type':
        distributedRooms = distributeByCleaningType(rooms, selectedHousekeepersData);
        break;
    }

    setRooms(distributedRooms);

    // Générer les QR codes pour l'accès mobile
    await generateQRCodes(selectedHousekeepersData);

    setCurrentStep('mobile');
    
    toast({
      title: "Distribution effectuée",
      description: `${distributedRooms.length} chambres distribuées`
    });
  };

  // Méthodes de distribution
  const distributeRandomly = (rooms: Room[], housekeepers: Housekeeper[]): Room[] => {
    return rooms.map((room, index) => ({
      ...room,
      assignedTo: housekeepers[index % housekeepers.length].name
    }));
  };

  const distributeByFloor = (rooms: Room[], housekeepers: Housekeeper[]): Room[] => {
    const roomsByFloor = rooms.reduce((acc, room) => {
      const floor = room.floor || 0; // Utiliser 0 si floor n'est pas défini
      if (!acc[floor]) acc[floor] = [];
      acc[floor].push(room);
      return acc;
    }, {} as Record<number, Room[]>);

    const floors = Object.keys(roomsByFloor).map(Number).sort();
    const result: Room[] = [];

    floors.forEach((floor, floorIndex) => {
      const housekeeper = housekeepers[floorIndex % housekeepers.length];
      roomsByFloor[floor].forEach(room => {
        result.push({ ...room, assignedTo: housekeeper.name });
      });
    });

    return result;
  };

  const distributeByCleaningType = (rooms: Room[], housekeepers: Housekeeper[]): Room[] => {
    const roomsByType = rooms.reduce((acc, room) => {
      if (!acc[room.cleaningType]) acc[room.cleaningType] = [];
      acc[room.cleaningType].push(room);
      return acc;
    }, {} as Record<string, Room[]>);

    const result: Room[] = [];
    let housekeeperIndex = 0;

    Object.values(roomsByType).forEach(typeRooms => {
      typeRooms.forEach(room => {
        result.push({ 
          ...room, 
          assignedTo: housekeepers[housekeeperIndex % housekeepers.length].name 
        });
        housekeeperIndex++;
      });
    });

    return result;
  };

  // Génération des QR codes
  const generateQRCodes = async (housekeepers: Housekeeper[]) => {
    const codes: Record<string, string> = {};
    
    for (const housekeeper of housekeepers) {
      const mobileUrl = `${window.location.origin}/mobile?code=${housekeeper.access_code}`;
      try {
        const qrCode = await QRCode.toDataURL(mobileUrl);
        codes[housekeeper.id] = qrCode;
      } catch (error) {
        console.error('Erreur génération QR code:', error);
      }
    }
    
    setQrCodes(codes);
  };

  const renderUploadStep = () => (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload du rapport PDF
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Sélectionnez votre rapport PDF</h3>
            <p className="text-gray-600">Glissez-déposez ou cliquez pour sélectionner</p>
          </div>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="mt-4"
            disabled={isProcessing}
          />
          {isProcessing && <p className="mt-2 text-blue-600">Analyse en cours...</p>}
        </div>
      </CardContent>
    </Card>
  );

  const renderHousekeepersStep = () => (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Sélection des femmes de chambre
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Femmes de chambre existantes */}
        <div>
          <h3 className="font-medium mb-3">Femmes de chambre existantes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {existingHousekeepers.map(housekeeper => (
              <div key={housekeeper.id} className="flex items-center space-x-3 p-3 border rounded">
                <Checkbox
                  checked={selectedHousekeepers.includes(housekeeper.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedHousekeepers(prev => [...prev, housekeeper.id]);
                    } else {
                      setSelectedHousekeepers(prev => prev.filter(id => id !== housekeeper.id));
                    }
                  }}
                />
                <div className="flex-1">
                  <div className="font-medium">{housekeeper.name}</div>
                  <div className="text-sm text-gray-600">Code: {housekeeper.access_code}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => sendInvitationEmail(housekeeper)}
                >
                  Inviter
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Ajouter nouvelle femme de chambre */}
        <div>
          <h3 className="font-medium mb-3">Ajouter une nouvelle femme de chambre</h3>
          <div className="flex gap-2">
            <Input
              placeholder="Nom de la femme de chambre"
              value={newHousekeeperName}
              onChange={(e) => setNewHousekeeperName(e.target.value)}
            />
            <Button onClick={handleAddNewHousekeeper}>
              Ajouter
            </Button>
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setCurrentStep('upload')}>
            Retour
          </Button>
          <Button onClick={() => setCurrentStep('distribution')}>
            Continuer ({selectedHousekeepers.length} sélectionnées)
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderDistributionStep = () => (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Méthode de distribution
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {[
            { value: 'random', label: 'Distribution aléatoire', desc: 'Répartition équitable des chambres' },
            { value: 'floor', label: 'Par étage', desc: 'Assigner par étage de préférence' },
            { value: 'cleaning-type', label: 'Par type de nettoyage', desc: 'Grouper par type de nettoyage' }
          ].map(method => (
            <div
              key={method.value}
              className={`p-4 border rounded cursor-pointer transition-colors ${
                distributionMethod === method.value ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
              }`}
              onClick={() => setDistributionMethod(method.value as DistributionMethod)}
            >
              <div className="font-medium">{method.label}</div>
              <div className="text-sm text-gray-600">{method.desc}</div>
            </div>
          ))}
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setCurrentStep('housekeepers')}>
            Retour
          </Button>
          <Button onClick={executeDistribution}>
            Exécuter la distribution
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderMobileInterface = () => (
    <Card className="max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Interface mobile - Accès femmes de chambre
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {existingHousekeepers
            .filter(h => selectedHousekeepers.includes(h.id))
            .map(housekeeper => {
              const assignedRooms = rooms.filter(r => r.assignedTo === housekeeper.name);
              return (
                <Card key={housekeeper.id} className="p-4">
                  <div className="text-center space-y-3">
                    <h3 className="font-bold text-lg">{housekeeper.name}</h3>
                    <div className="text-sm text-gray-600">
                      Code: <span className="font-mono">{housekeeper.access_code}</span>
                    </div>
                    
                    {qrCodes[housekeeper.id] && (
                      <div className="flex flex-col items-center space-y-2">
                        <img 
                          src={qrCodes[housekeeper.id]} 
                          alt={`QR Code ${housekeeper.name}`}
                          className="w-32 h-32"
                        />
                        <div className="text-xs text-gray-500">QR Code d'accès mobile</div>
                      </div>
                    )}
                    
                    <div className="text-sm">
                      <div className="font-medium">{assignedRooms.length} chambres assignées</div>
                      <div className="text-gray-600">
                        {assignedRooms.map(r => r.number).join(', ')}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
        </div>

        <div className="flex justify-center gap-4">
          <Button variant="outline" onClick={() => setCurrentStep('distribution')}>
            Modifier la distribution
          </Button>
          <Button onClick={() => window.open('/mobile', '_blank')}>
            <QrCode className="h-4 w-4 mr-2" />
            Ouvrir interface mobile
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Télécharger rapport PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'upload':
        return renderUploadStep();
      case 'housekeepers':
        return renderHousekeepersStep();
      case 'distribution':
        return renderDistributionStep();
      case 'mobile':
        return renderMobileInterface();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* En-tête avec étapes */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            Workflow de gestion housekeeping
          </h1>
          
          {/* Indicateur d'étapes */}
          <div className="flex justify-center items-center space-x-4 mb-6">
            {[
              { key: 'upload', label: '1. Upload', icon: Upload },
              { key: 'housekeepers', label: '2. Personnel', icon: Users },
              { key: 'distribution', label: '3. Distribution', icon: Settings },
              { key: 'mobile', label: '4. Mobile', icon: BarChart3 }
            ].map((step, index) => (
              <div key={step.key} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  currentStep === step.key 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  <step.icon className="h-5 w-5" />
                </div>
                <span className="ml-2 text-sm font-medium">{step.label}</span>
                {index < 3 && <div className="w-8 h-0.5 bg-gray-300 mx-4" />}
              </div>
            ))}
          </div>
        </div>

        {/* Contenu de l'étape */}
        {renderCurrentStep()}
      </div>
    </div>
  );
}