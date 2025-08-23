import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  CheckCircle, 
  Clock, 
  User, 
  LogOut, 
  Home, 
  AlertCircle,
  Play,
  Pause,
  RotateCcw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Room {
  number: string;
  floor: number;
  cleaningType: string;
  status: 'pending' | 'in-progress' | 'completed' | 'issue';
  startedAt?: Date;
  completedAt?: Date;
  notes?: string;
  estimatedTime?: number;
}

interface HousekeeperSession {
  id: string;
  name: string;
  hotelName: string;
  accessCode: string;
  roomsAssigned: Room[];
}

export default function MobileInterface() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // États principaux
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessCode, setAccessCode] = useState(searchParams.get('code') || '');
  const [session, setSession] = useState<HousekeeperSession | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [roomNotes, setRoomNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Authentification automatique via code QR
  useEffect(() => {
    const codeFromUrl = searchParams.get('code');
    if (codeFromUrl) {
      authenticateWithCode(codeFromUrl);
    }
  }, [searchParams]);

  // Authentification avec code d'accès
  const authenticateWithCode = async (code: string) => {
    setIsLoading(true);
    
    try {
      // Rechercher la femme de chambre par code d'accès
      const { data: housekeeper, error } = await supabase
        .from('housekeepers')
        .select(`
          id,
          name,
          access_code,
          hotel_id,
          hotels!inner (
            id,
            name,
            hotel_code
          )
        `)
        .eq('access_code', code)
        .eq('is_active', true)
        .single();

      if (error || !housekeeper) {
        toast({
          variant: "destructive",
          title: "Code invalide",
          description: "Code d'accès non reconnu ou expiré"
        });
        return;
      }

      // Charger les chambres assignées (simulation - à adapter selon votre logique)
      const mockRooms: Room[] = [
        { number: '101', floor: 1, cleaningType: 'full', status: 'pending', estimatedTime: 45 },
        { number: '102', floor: 1, cleaningType: 'quick', status: 'pending', estimatedTime: 25 },
        { number: '103', floor: 1, cleaningType: 'full', status: 'pending', estimatedTime: 45 },
        { number: '201', floor: 2, cleaningType: 'quick', status: 'pending', estimatedTime: 25 },
      ];

      const newSession: HousekeeperSession = {
        id: housekeeper.id,
        name: housekeeper.name,
        hotelName: housekeeper.hotels.name,
        accessCode: code,
        roomsAssigned: mockRooms
      };

      setSession(newSession);
      setIsAuthenticated(true);
      
      toast({
        title: "Connexion réussie",
        description: `Bienvenue ${housekeeper.name} à ${housekeeper.hotels.name}`
      });

    } catch (error) {
      console.error('Erreur authentification:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de se connecter"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Démarrer le nettoyage d'une chambre
  const startRoom = async (room: Room) => {
    if (!session) return;

    const updatedRoom = {
      ...room,
      status: 'in-progress' as const,
      startedAt: new Date()
    };

    updateRoomInSession(updatedRoom);
    
    toast({
      title: "Nettoyage démarré",
      description: `Chambre ${room.number} - ${room.cleaningType}`
    });

    // Notification temps réel au client
    await sendRoomStatusUpdate(room.number, 'in-progress', `Démarré par ${session.name}`);
  };

  // Terminer le nettoyage d'une chambre
  const completeRoom = async (room: Room, notes: string = '') => {
    if (!session) return;

    const updatedRoom = {
      ...room,
      status: 'completed' as const,
      completedAt: new Date(),
      notes: notes
    };

    updateRoomInSession(updatedRoom);
    setSelectedRoom(null);
    setRoomNotes('');
    
    toast({
      title: "Chambre terminée",
      description: `Chambre ${room.number} nettoyée avec succès`
    });

    // Notification temps réel au client
    await sendRoomStatusUpdate(room.number, 'completed', `Terminé par ${session.name}`, notes);
  };

  // Signaler un problème
  const reportIssue = async (room: Room, issue: string) => {
    if (!session) return;

    const updatedRoom = {
      ...room,
      status: 'issue' as const,
      notes: issue
    };

    updateRoomInSession(updatedRoom);
    setSelectedRoom(null);
    
    toast({
      variant: "destructive",
      title: "Problème signalé",
      description: `Chambre ${room.number} - ${issue}`
    });

    // Notification temps réel au client
    await sendRoomStatusUpdate(room.number, 'issue', issue);
  };

  // Mettre à jour une chambre dans la session
  const updateRoomInSession = (updatedRoom: Room) => {
    if (!session) return;

    setSession(prev => prev ? {
      ...prev,
      roomsAssigned: prev.roomsAssigned.map(r => 
        r.number === updatedRoom.number ? updatedRoom : r
      )
    } : null);
  };

  // Envoyer notification temps réel au client
  const sendRoomStatusUpdate = async (roomNumber: string, status: string, message: string, notes?: string) => {
    try {
      await supabase
        .from('room_status_updates')
        .insert({
          hotel_id: session?.id, // À adapter selon votre structure
          room_number: roomNumber,
          status: status,
          message: message,
          housekeeper_id: session?.id
        });
    } catch (error) {
      console.error('Erreur envoi notification:', error);
    }
  };

  // Déconnexion
  const handleSignOut = () => {
    setIsAuthenticated(false);
    setSession(null);
    setAccessCode('');
    
    // IMPORTANT: Redirection claire pour éviter le problème d'adresse unique
    window.location.href = '/';
  };

  // Couleurs selon le statut
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-200 text-gray-800';
      case 'in-progress': return 'bg-blue-500 text-white';
      case 'completed': return 'bg-green-500 text-white';
      case 'issue': return 'bg-red-500 text-white';
      default: return 'bg-gray-200 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return Clock;
      case 'in-progress': return Play;
      case 'completed': return CheckCircle;
      case 'issue': return AlertCircle;
      default: return Clock;
    }
  };

  // Interface de connexion mobile
  if (!isAuthenticated || !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-blue-800">
              Interface Mobile Housekeeping
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-gray-600 mb-4">
              <p>Connectez-vous avec votre code d'accès</p>
            </div>
            
            <Input
              type="text"
              placeholder="Code d'accès (ex: HTL-1234-MAR)"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
              className="text-center font-mono text-lg"
            />
            
            <Button 
              onClick={() => authenticateWithCode(accessCode)}
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={!accessCode.trim() || isLoading}
            >
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </Button>
            
            <div className="text-center text-sm text-gray-500">
              <p>Scannez le QR code fourni par votre responsable</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Interface principale mobile
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header mobile */}
      <div className="bg-blue-600 text-white p-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg">{session.name}</h1>
            <p className="text-blue-200 text-sm">{session.hotelName}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-white hover:bg-blue-700"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Statistiques */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xl font-bold">
              {session.roomsAssigned.filter(r => r.status === 'completed').length}
            </div>
            <div className="text-xs text-blue-200">Terminées</div>
          </div>
          <div>
            <div className="text-xl font-bold">
              {session.roomsAssigned.filter(r => r.status === 'in-progress').length}
            </div>
            <div className="text-xs text-blue-200">En cours</div>
          </div>
          <div>
            <div className="text-xl font-bold">
              {session.roomsAssigned.filter(r => r.status === 'pending').length}
            </div>
            <div className="text-xs text-blue-200">À faire</div>
          </div>
        </div>
      </div>

      {/* Liste des chambres */}
      <div className="p-4 space-y-3">
        {session.roomsAssigned.map(room => {
          const StatusIcon = getStatusIcon(room.status);
          return (
            <Card key={room.number} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <Home className="h-6 w-6 text-gray-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Chambre {room.number}</h3>
                      <p className="text-sm text-gray-600">
                        Étage {room.floor} • {room.cleaningType === 'full' ? 'Nettoyage complet' : 'Nettoyage rapide'}
                      </p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(room.status)}>
                    <StatusIcon className="h-4 w-4 mr-1" />
                    {room.status === 'pending' && 'À faire'}
                    {room.status === 'in-progress' && 'En cours'}
                    {room.status === 'completed' && 'Terminée'}
                    {room.status === 'issue' && 'Problème'}
                  </Badge>
                </div>

                {room.estimatedTime && (
                  <div className="text-sm text-gray-600 mb-3">
                    <Clock className="h-4 w-4 inline mr-1" />
                    Temps estimé: {room.estimatedTime} minutes
                  </div>
                )}

                {room.startedAt && room.status === 'in-progress' && (
                  <div className="text-sm text-blue-600 mb-3">
                    Démarré à {room.startedAt.toLocaleTimeString('fr-FR')}
                  </div>
                )}

                {room.completedAt && room.status === 'completed' && (
                  <div className="text-sm text-green-600 mb-3">
                    Terminé à {room.completedAt.toLocaleTimeString('fr-FR')}
                  </div>
                )}

                {room.notes && (
                  <div className="text-sm text-gray-600 bg-gray-100 p-2 rounded mb-3">
                    {room.notes}
                  </div>
                )}

                {/* Actions selon le statut */}
                <div className="flex gap-2">
                  {room.status === 'pending' && (
                    <Button 
                      onClick={() => startRoom(room)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Démarrer
                    </Button>
                  )}

                  {room.status === 'in-progress' && (
                    <>
                      <Button 
                        onClick={() => setSelectedRoom(room)}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Terminer
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => reportIssue(room, 'Problème signalé')}
                      >
                        <AlertCircle className="h-4 w-4" />
                      </Button>
                    </>
                  )}

                  {room.status === 'completed' && (
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        const resetRoom = { ...room, status: 'pending' as const };
                        updateRoomInSession(resetRoom);
                      }}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Refaire
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal de finalisation */}
      {selectedRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Terminer chambre {selectedRoom.number}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Notes (optionnel)"
                value={roomNotes}
                onChange={(e) => setRoomNotes(e.target.value)}
              />
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedRoom(null)}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button 
                  onClick={() => completeRoom(selectedRoom, roomNotes)}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  Confirmer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}