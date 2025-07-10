import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Check, Play, MessageSquare, AlertCircle, Bed, Bell, History } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Room } from '@/services/pdfService';
import { useHousekeeping } from '@/contexts/HousekeepingContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useNotifications } from '@/hooks/use-notifications';
import { SupabaseService } from '@/services/supabaseService';
import { ActionLogPanel } from '@/components/ActionLogPanel';
import { NotificationPanel } from '@/components/NotificationPanel';

export default function Housekeeper() {
  const { housekeeperNames, rooms, isDistributed, getHousekeeperRooms, updateRoomStatus, housekeeperAccessCodes, validateHotelConnection } = useHousekeeping();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [selectedHousekeeper, setSelectedHousekeeper] = useState<string>('');
  const [accessCode, setAccessCode] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [remarkText, setRemarkText] = useState('');
  const [remarkRoomNumber, setRemarkRoomNumber] = useState('');
  const [housekeeperRooms, setHousekeeperRooms] = useState<Room[]>([]);
  const [hotelId, setHotelId] = useState<string | null>(null);
  const [hotelInfo, setHotelInfo] = useState<{ name: string; code: string } | null>(null);
  const [isActionLogOpen, setIsActionLogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'number' | 'status' | 'type'>('number');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Initialiser les notifications avec l'ID de l'hôtel
  const { addNotification, notifications, hasUnread } = useNotifications(hotelId || undefined);
  

  // Vérifier les paramètres URL ou localStorage pour auto-connexion
  useEffect(() => {
    const codeFromUrl = searchParams.get('code');
    const savedName = localStorage.getItem('currentHousekeeper');
    const savedCode = localStorage.getItem('currentAccessCode');

    if (codeFromUrl) {
      // Trouver la femme de chambre correspondant au code
      const matchingHousekeeper = Object.entries(housekeeperAccessCodes).find(
        ([name, code]) => code === codeFromUrl
      );
      
      if (matchingHousekeeper) {
        const [housekeeperName] = matchingHousekeeper;
        setSelectedHousekeeper(housekeeperName);
        setAccessCode(codeFromUrl);
        setIsLoggedIn(true);
        
        // Sauvegarder la connexion
        localStorage.setItem('currentHousekeeper', housekeeperName);
        localStorage.setItem('currentAccessCode', codeFromUrl);
        
        toast({
          title: "Connexion automatique",
          description: `Bienvenue ${housekeeperName} !`
        });
      } else {
        console.log('Code non trouvé:', codeFromUrl, 'Codes disponibles:', Object.values(housekeeperAccessCodes));
      }
    } else if (savedName && savedCode && housekeeperAccessCodes[savedName] === savedCode) {
      setSelectedHousekeeper(savedName);
      setAccessCode(savedCode);
      setIsLoggedIn(true);
    }
  }, [searchParams, housekeeperAccessCodes]);

  // Récupérer l'hotelId réel depuis la base de données
  useEffect(() => {
    const savedHotelCode = localStorage.getItem('selectedHotelCode');
    const savedHotelName = localStorage.getItem('selectedHotelName');
    
    const loadHotelData = async () => {
      if (savedHotelCode) {
        try {
          // Récupérer l'hôtel réel depuis la base de données par son code
          const hotel = await SupabaseService.getHotelByCode(savedHotelCode);
          
          if (hotel) {
            setHotelId(hotel.id);
            setHotelInfo({ code: savedHotelCode, name: hotel.name });
            
            // Mettre à jour localStorage avec l'ID réel
            localStorage.setItem('selectedHotelId', hotel.id);
            localStorage.setItem('selectedHotelName', hotel.name);
            
            console.log('✅ Housekeeper - Hotel ID réel chargé:', hotel.id);
          } else {
            console.error('❌ Housekeeper - Hôtel non trouvé pour le code:', savedHotelCode);
            toast({
              variant: "destructive",
              title: "Hôtel non trouvé",
              description: `Aucun hôtel trouvé avec le code ${savedHotelCode}`
            });
          }
        } catch (error) {
          console.error('❌ Erreur lors du chargement de l\'hôtel:', error);
          toast({
            variant: "destructive",
            title: "Erreur de connexion",
            description: "Impossible de charger les données de l'hôtel"
          });
        }
      } else if (savedHotelName) {
        setHotelInfo({ code: 'HTL', name: savedHotelName });
        console.warn('⚠️ Housekeeper - Code hôtel manquant, utilisation des données sauvegardées');
      } else {
        console.warn('⚠️ Housekeeper - Aucune information d\'hôtel trouvée');
      }
    };
    
    loadHotelData();
  }, []);

  // Valider la connexion hôtel lors de la connexion de la femme de chambre
  useEffect(() => {
    const validateConnection = async () => {
      if (isLoggedIn && selectedHousekeeper) {
        try {
          const validatedHotelId = await validateHotelConnection();
          if (validatedHotelId) {
            console.log('✅ Housekeeper - Connexion hôtel validée pour', selectedHousekeeper, ':', validatedHotelId);
          } else {
            console.warn('⚠️ Housekeeper - Impossible de valider la connexion hôtel');
            toast({
              variant: "destructive",
              title: "Problème de connexion",
              description: "Impossible de valider la connexion à l'hôtel"
            });
          }
        } catch (error) {
          console.error('❌ Erreur validation connexion hôtel:', error);
        }
      }
    };

    validateConnection();
  }, [isLoggedIn, selectedHousekeeper, validateHotelConnection]);
  // Mettre à jour les chambres de la femme de chambre quand les données changent
  useEffect(() => {
    if (selectedHousekeeper && isLoggedIn) {
      const assignedRooms = getHousekeeperRooms(selectedHousekeeper);
      setHousekeeperRooms(assignedRooms);
      console.log("Chambres assignées à", selectedHousekeeper, ":", assignedRooms.length);
    }
  }, [selectedHousekeeper, isLoggedIn, rooms, getHousekeeperRooms]);

  // Vérifier si la distribution a été faite
  if (!isDistributed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-2xl">Distribution Requise</CardTitle>
            <p className="text-center text-muted-foreground">
              Vous devez d'abord distribuer les chambres depuis l'interface principale
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-sm text-muted-foreground mb-4">
              Pour accéder à l'interface mobile, retournez à l'interface principale et cliquez sur "Distribuer les Chambres"
            </div>
            <Button 
              onClick={() => navigate('/')}
              className="w-full bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour à l'interface principale
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Interface de connexion simplifiée si pas encore connecté
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-800">NettoBloc Mobile</CardTitle>
            <p className="text-muted-foreground">Entrez votre code d'accès</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="access-code" className="text-sm font-medium">
                Code d'accès (généré lors de la distribution)
              </label>
              <Input
                id="access-code"
                type="text"
                placeholder="Ex: HTL-1234"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                className="text-center text-lg font-mono h-12"
                autoFocus
              />
              {Object.keys(housekeeperAccessCodes).length > 0 && (
                <div className="text-xs text-gray-500 text-center mt-2">
                  Codes disponibles: {Object.values(housekeeperAccessCodes).join(', ')}
                </div>
              )}
            </div>
            
            <Button 
              onClick={() => {
                if (!accessCode.trim()) {
                  toast({
                    variant: "destructive",
                    title: "Code requis",
                    description: "Veuillez saisir votre code d'accès"
                  });
                  return;
                }

                // Chercher le code d'accès
                const matchingHousekeeper = Object.entries(housekeeperAccessCodes).find(
                  ([name, code]) => code === accessCode
                );

                if (matchingHousekeeper) {
                  const [housekeeperName] = matchingHousekeeper;
                  setSelectedHousekeeper(housekeeperName);
                  setIsLoggedIn(true);
                  
                  // Sauvegarder la connexion
                  localStorage.setItem('currentHousekeeper', housekeeperName);
                  localStorage.setItem('currentAccessCode', accessCode);
                  
                  toast({
                    title: "Connexion réussie",
                    description: `Bienvenue ${housekeeperName} !`
                  });
                } else {
                  toast({
                    variant: "destructive",
                    title: "Code incorrect",
                    description: "Code d'accès non reconnu"
                  });
                }
              }}
              className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700"
            >
              Se connecter
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => navigate('/')}
              className="w-full flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fonction de tri
  const sortRooms = (rooms: Room[]) => {
    return [...rooms].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'number':
          comparison = parseInt(a.number) - parseInt(b.number);
          break;
        case 'status':
          const statusOrder = {
            'needs-cleaning': 1,
            'ready-to-clean': 2,
            'in-progress': 3,
            'clean': 4,
            'needs-attention': 5
          };
          comparison = (statusOrder[a.status as keyof typeof statusOrder] || 0) - 
                      (statusOrder[b.status as keyof typeof statusOrder] || 0);
          break;
        case 'type':
          const typeOrder = { 'full': 1, 'quick': 2 };
          comparison = (typeOrder[a.cleaningType as keyof typeof typeOrder] || 0) - 
                      (typeOrder[b.cleaningType as keyof typeof typeOrder] || 0);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  const sortedRooms = sortRooms(housekeeperRooms);
  
  const pendingRooms = sortedRooms.filter(room => room.status === 'needs-cleaning' || room.status === 'ready-to-clean');
  const inProgressRooms = sortedRooms.filter(room => room.status === 'in-progress');
  const completedRooms = sortedRooms.filter(room => room.status === 'clean');
  const remarkRooms = sortedRooms.filter(room => room.status === 'needs-attention');

  // Fonction pour changer le tri
  const handleSort = (newSortBy: 'number' | 'status' | 'type') => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
  };

  // Fonction pour gérer la mise à jour du statut des chambres
  const handleUpdateRoomStatus = async (roomNumber: string, newStatus: string) => {
    console.log('Housekeeper - updateRoomStatus:', roomNumber, newStatus, selectedHousekeeper); // Debug
    
    // Utiliser la fonction du contexte qui gère les notifications
    updateRoomStatus(roomNumber, newStatus, selectedHousekeeper);
    
    const statusMessages = {
      'clean': 'Chambre marquée comme nettoyée !',
      'in-progress': 'Nettoyage en cours',
      'needs-attention': 'Remarque signalée',
      'ready-to-clean': 'Chambre marquée comme prête à nettoyer'
    };

    // Si la chambre est marquée comme "clean" (terminée), envoyer une notification spéciale
    if (newStatus === 'clean') {
      toast({
        title: '✅ Chambre terminée !',
        description: `Chambre ${roomNumber} - Nettoyage terminé par ${selectedHousekeeper}`,
      });
    } else {
      toast({
        title: statusMessages[newStatus as keyof typeof statusMessages] || 'Statut mis à jour',
        description: `Chambre ${roomNumber}`,
      });
    }
  };

  const handleRemark = () => {
    if (remarkText.trim()) {
      updateRoomStatus(remarkRoomNumber, 'needs-attention', selectedHousekeeper, remarkText.trim());
      setRemarkText('');
      setRemarkRoomNumber('');
    }
  };

  const getCleaningTypeText = (type: string) => {
    switch (type) {
      case 'full': return 'À Blanc';
      case 'quick': return 'Recouche';
      default: return 'Aucun';
    }
  };

  const getCleaningTypeColor = (type: string) => {
    switch (type) {
      case 'full': return 'bg-purple-100 text-purple-800';
      case 'quick': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'clean': return 'bg-green-100 text-green-800';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800';
      case 'needs-attention': return 'bg-red-100 text-red-800';
      case 'ready-to-clean': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'clean': return 'Nettoyée';
      case 'in-progress': return 'En cours';
      case 'needs-attention': return 'Remarque';
      case 'ready-to-clean': return 'Prêt à nettoyer';
      default: return 'À nettoyer';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-secondary p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bonjour {selectedHousekeeper} !</h1>
            <p className="text-muted-foreground">Votre planning aujourd'hui</p>
          </div>
          <div className="flex gap-2">
            <NotificationPanel 
              notifications={notifications}
              hasUnread={hasUnread}
            />
            <Button 
              variant="outline" 
              onClick={() => setIsActionLogOpen(true)}
              size="sm"
            >
              <History className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsLoggedIn(false)}
              size="sm"
            >
              Changer
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/')}
              size="sm"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* ID Hôtel */}
        {hotelInfo && (
          <div className="mb-4 p-3 bg-card border rounded-lg">
            <div className="text-sm text-muted-foreground">Hôtel connecté</div>
            <div className="font-medium">{hotelInfo.name}</div>
            <div className="text-sm text-muted-foreground">Code: {hotelInfo.code}</div>
          </div>
        )}
        
        {/* Barre de progression */}
        <div className="grid grid-cols-2 xs:grid-cols-4 gap-2 text-center text-sm mb-4">
          <div className="p-2 bg-card border rounded-lg">
            <div className="font-semibold text-orange-600">{pendingRooms.length}</div>
            <div className="text-muted-foreground text-xs">À faire</div>
          </div>
          <div className="p-2 bg-card border rounded-lg">
            <div className="font-semibold text-yellow-600">{inProgressRooms.length}</div>
            <div className="text-muted-foreground text-xs">En cours</div>
          </div>
          <div className="p-2 bg-card border rounded-lg">
            <div className="font-semibold text-green-600">{completedRooms.length}</div>
            <div className="text-muted-foreground text-xs">Terminées</div>
          </div>
          <div className="p-2 bg-card border rounded-lg">
            <div className="font-semibold text-red-600">{remarkRooms.length}</div>
            <div className="text-muted-foreground text-xs">Remarques</div>
          </div>
        </div>
        
        <div className="w-full bg-muted rounded-full h-2">
          <div 
            className="bg-gradient-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${housekeeperRooms.length > 0 ? (completedRooms.length / housekeeperRooms.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Boutons de tri */}
      <div className="mb-4">
        <div className="grid grid-cols-3 gap-2 max-w-sm mx-auto">
          <Button
            variant={sortBy === 'number' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleSort('number')}
            className="text-xs px-2"
          >
            <span className="hidden xs:inline">N° chambre</span>
            <span className="xs:hidden">N°</span>
            {sortBy === 'number' && (
              <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
            )}
          </Button>
          <Button
            variant={sortBy === 'status' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleSort('status')}
            className="text-xs px-2"
          >
            Statut
            {sortBy === 'status' && (
              <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
            )}
          </Button>
          <Button
            variant={sortBy === 'type' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleSort('type')}
            className="text-xs px-2"
          >
            Type
            {sortBy === 'type' && (
              <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
            )}
          </Button>
        </div>
      </div>

      {/* Chambres à nettoyer */}
      <div className="space-y-3">
        {sortedRooms.map((room) => (
          <Card key={room.number} className="card-modern">
            <CardHeader className="pb-3">
              <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <CardTitle className="text-lg sm:text-xl">Chambre {room.number}</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Badge className={`${getStatusColor(room.status)} text-xs`}>
                    {getStatusText(room.status)}
                  </Badge>
                  {room.isUrgent && (
                    <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                      <AlertCircle className="h-3 w-3" />
                      <span className="hidden xs:inline">Urgent</span>
                      <span className="xs:hidden">!</span>
                    </Badge>
                  )}
                  {room.isTwin && (
                    <Badge variant="outline" className="flex items-center gap-1 text-xs">
                      <Bed className="h-3 w-3" />
                      <span className="hidden xs:inline">Twin</span>
                      <span className="xs:hidden">2</span>
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3">
              <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2">
                <span className="text-sm text-muted-foreground">Type de nettoyage:</span>
                <Badge className={getCleaningTypeColor(room.cleaningType)}>
                  {getCleaningTypeText(room.cleaningType)}
                </Badge>
              </div>
              
              {(room.status === 'needs-cleaning' || room.status === 'ready-to-clean') && (
                <div className="space-y-3">
                  {room.status === 'ready-to-clean' && (
                    <div className="p-3 bg-orange-50 border-l-4 border-orange-400 rounded-md">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <Check className="h-5 w-5 text-orange-400" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-orange-800">
                            Client sorti
                          </p>
                          <p className="text-xs text-orange-600 mt-1">
                            Chambre prête à nettoyer
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <Button
                    onClick={() => handleUpdateRoomStatus(room.number, 'in-progress')}
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-medium"
                    size="lg"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Commencer le nettoyage
                  </Button>
                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      onClick={() => handleUpdateRoomStatus(room.number, 'clean')}
                      variant="outline"
                      className="border-green-200 text-green-700 hover:bg-green-50 font-medium"
                      size="sm"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Marquer propre
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="border-red-200 text-red-700 hover:bg-red-50 font-medium"
                          size="sm"
                          onClick={() => setRemarkRoomNumber(room.number)}
                        >
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Remarque
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Signaler une remarque - Chambre {room.number}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <Textarea
                            placeholder="Décrivez le problème ou la remarque..."
                            value={remarkText}
                            onChange={(e) => setRemarkText(e.target.value)}
                            rows={4}
                          />
                          <Button 
                            onClick={handleRemark}
                            className="w-full"
                            disabled={!remarkText.trim()}
                          >
                            Signaler la remarque
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              )}
              
              {room.status === 'in-progress' && (
                <div className="space-y-3">
                  <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded-md">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Play className="h-5 w-5 text-yellow-400" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-yellow-800">
                          Nettoyage en cours
                        </p>
                        <p className="text-xs text-yellow-600 mt-1">
                          Commencé à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleUpdateRoomStatus(room.number, 'clean')}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-medium"
                    size="lg"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Marquer comme propre
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full border-red-200 text-red-700 hover:bg-red-50 font-medium"
                        size="sm"
                        onClick={() => setRemarkRoomNumber(room.number)}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Signaler une remarque
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Signaler une remarque - Chambre {room.number}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Textarea
                          placeholder="Décrivez le problème ou la remarque..."
                          value={remarkText}
                          onChange={(e) => setRemarkText(e.target.value)}
                          rows={4}
                        />
                        <Button 
                          onClick={handleRemark}
                          className="w-full"
                          disabled={!remarkText.trim()}
                        >
                          Signaler la remarque
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
              
              {room.status === 'clean' && (
                <div className="p-3 bg-green-50 border-l-4 border-green-400 rounded-md">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Check className="h-5 w-5 text-green-400" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-800">
                        Chambre nettoyée
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        Terminé à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {room.status === 'needs-attention' && (
                <div className="space-y-3">
                  <div className="p-3 bg-red-50 border-l-4 border-red-400 rounded-md">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <AlertCircle className="h-5 w-5 text-red-400" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-red-800">
                          Remarque signalée
                        </p>
                        <p className="text-xs text-red-600 mt-1">
                          Nécessite une attention particulière
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleUpdateRoomStatus(room.number, 'needs-cleaning')}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    Remettre en attente
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        
        {housekeeperRooms.length === 0 && (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Aucune chambre assignée
            </h3>
            <p className="text-muted-foreground">
              Vous n'avez aucune chambre assignée pour aujourd'hui.
            </p>
          </div>
        )}
      </div>

      {/* Action Log Panel */}
      <ActionLogPanel 
        hotelId={hotelId || undefined}
        isOpen={isActionLogOpen}
        onClose={() => setIsActionLogOpen(false)}
      />
    </div>
  );
}