import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Play, Square, RotateCcw, Building, Users, Clock } from 'lucide-react';
import BackButton from '@/components/BackButton';

interface Room {
  id: string;
  number: string;
  status: 'available' | 'cleaning' | 'maintenance' | 'occupied';
  priority: 'low' | 'medium' | 'high';
  notes?: string;
  startTime?: Date;
}

const GuestMode = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [housekeeperName, setHousekeeperName] = useState('');
  const [isSetup, setIsSetup] = useState(false);
  const { toast } = useToast();

  // Données demo par défaut
  const defaultRooms: Room[] = [
    { id: '1', number: '101', status: 'available', priority: 'high', notes: 'Départ tardif, vérifier état' },
    { id: '2', number: '102', status: 'available', priority: 'medium' },
    { id: '3', number: '103', status: 'available', priority: 'low' },
    { id: '4', number: '201', status: 'available', priority: 'high', notes: 'Suite premium' },
    { id: '5', number: '202', status: 'available', priority: 'medium' },
    { id: '6', number: '203', status: 'available', priority: 'low' },
    { id: '7', number: '301', status: 'available', priority: 'medium' },
    { id: '8', number: '302', status: 'available', priority: 'high', notes: 'Arrivée VIP' }
  ];

  useEffect(() => {
    // Charger les données locales si elles existent
    const savedRooms = localStorage.getItem('guestMode_rooms');
    const savedName = localStorage.getItem('guestMode_housekeeperName');
    const savedSetup = localStorage.getItem('guestMode_isSetup');

    if (savedRooms && savedName && savedSetup) {
      setRooms(JSON.parse(savedRooms));
      setHousekeeperName(savedName);
      setIsSetup(true);
    } else {
      setRooms(defaultRooms);
    }
  }, []);

  const saveToLocalStorage = (newRooms: Room[], name?: string) => {
    localStorage.setItem('guestMode_rooms', JSON.stringify(newRooms));
    if (name) {
      localStorage.setItem('guestMode_housekeeperName', name);
    }
    localStorage.setItem('guestMode_isSetup', 'true');
  };

  const handleSetup = () => {
    if (!housekeeperName.trim()) {
      toast({
        variant: "destructive",
        title: "Nom requis",
        description: "Veuillez saisir votre nom pour continuer."
      });
      return;
    }
    
    setIsSetup(true);
    saveToLocalStorage(rooms, housekeeperName);
    toast({
      title: "Mode invité activé",
      description: `Bienvenue ${housekeeperName} ! Vos données sont sauvegardées localement.`
    });
  };

  const updateRoomStatus = (roomId: string, newStatus: Room['status']) => {
    const updatedRooms = rooms.map(room => {
      if (room.id === roomId) {
        const updatedRoom = { 
          ...room, 
          status: newStatus,
          startTime: newStatus === 'cleaning' ? new Date() : undefined
        };
        
        if (newStatus === 'available' && room.status === 'cleaning') {
          toast({
            title: "Chambre terminée",
            description: `Chambre ${room.number} nettoyée avec succès !`
          });
        }
        
        return updatedRoom;
      }
      return room;
    });
    
    setRooms(updatedRooms);
    saveToLocalStorage(updatedRooms);
  };

  const resetDemo = () => {
    localStorage.removeItem('guestMode_rooms');
    localStorage.removeItem('guestMode_housekeeperName');
    localStorage.removeItem('guestMode_isSetup');
    setRooms(defaultRooms);
    setHousekeeperName('');
    setIsSetup(false);
    toast({
      title: "Démonstration réinitialisée",
      description: "Toutes les données ont été effacées."
    });
  };

  const getRoomStatusColor = (status: Room['status']) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'cleaning': return 'bg-blue-100 text-blue-800';
      case 'maintenance': return 'bg-red-100 text-red-800';
      case 'occupied': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: Room['priority']) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: Room['status']) => {
    switch (status) {
      case 'available': return 'Disponible';
      case 'cleaning': return 'En cours';
      case 'maintenance': return 'Maintenance';
      case 'occupied': return 'Occupée';
      default: return status;
    }
  };

  const getPriorityText = (priority: Room['priority']) => {
    switch (priority) {
      case 'high': return 'Haute';
      case 'medium': return 'Moyenne';
      case 'low': return 'Basse';
      default: return priority;
    }
  };

  const completedRooms = rooms.filter(r => r.status === 'available' && r.startTime).length;
  const totalRooms = rooms.length;
  const progress = totalRooms > 0 ? Math.round((completedRooms / totalRooms) * 100) : 0;

  if (!isSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 p-4">
        <div className="absolute top-4 left-4">
          <BackButton to="/" />
        </div>
        
        <div className="max-w-md mx-auto mt-20">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Mode Invité</CardTitle>
              <p className="text-sm text-muted-foreground">
                Essayez l'application sans créer de compte. 
                Vos données seront sauvegardées localement.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Votre nom (optionnel)
                </label>
                <Input
                  placeholder="Ex: Marie Dupont"
                  value={housekeeperName}
                  onChange={(e) => setHousekeeperName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSetup()}
                />
              </div>
              
              <Button onClick={handleSetup} className="w-full">
                <Building className="mr-2 h-4 w-4" />
                Commencer la démonstration
              </Button>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800">
                  <strong>Note:</strong> En mode invité, vos données ne sont pas synchronisées 
                  avec un serveur et seront perdues si vous videz le cache du navigateur.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 p-4">
      <div className="absolute top-4 left-4">
        <BackButton to="/" />
      </div>
      
      <div className="max-w-4xl mx-auto space-y-6">
        {/* En-tête */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Building className="h-6 w-6 text-primary" />
                Hôtel Démo - Mode Invité
              </h1>
              <p className="text-muted-foreground">
                Bienvenue {housekeeperName || 'Invité'} • Démonstration interactive
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={resetDemo}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Réinitialiser
            </Button>
          </div>
        </div>

        {/* Statistiques */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Progression du jour</h3>
                <p className="text-sm text-muted-foreground">
                  {completedRooms} chambres nettoyées sur {totalRooms}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">{progress}%</div>
                <div className="text-xs text-muted-foreground flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  Temps estimé: {(totalRooms - completedRooms) * 30}min
                </div>
              </div>
            </div>
            <div className="mt-4 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Liste des chambres */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <Card key={room.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">Chambre {room.number}</h3>
                  <Badge className={getPriorityColor(room.priority)}>
                    {getPriorityText(room.priority)}
                  </Badge>
                </div>
                <Badge className={getRoomStatusColor(room.status)}>
                  {getStatusText(room.status)}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {room.notes && (
                  <p className="text-sm text-muted-foreground bg-gray-50 p-2 rounded">
                    {room.notes}
                  </p>
                )}
                
                {room.status === 'cleaning' && room.startTime && (
                  <p className="text-xs text-blue-600">
                    Débuté à {room.startTime.toLocaleTimeString()}
                  </p>
                )}

                <div className="flex gap-2">
                  {room.status === 'available' && !room.startTime && (
                    <Button 
                      size="sm" 
                      onClick={() => updateRoomStatus(room.id, 'cleaning')}
                      className="flex-1"
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Commencer
                    </Button>
                  )}
                  
                  {room.status === 'cleaning' && (
                    <Button 
                      size="sm" 
                      onClick={() => updateRoomStatus(room.id, 'available')}
                      className="flex-1"
                      variant="outline"
                    >
                      <Square className="h-4 w-4 mr-1" />
                      Terminer
                    </Button>
                  )}
                  
                  {room.status === 'available' && room.startTime && (
                    <Badge variant="secondary" className="flex-1 justify-center">
                      ✓ Terminée
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GuestMode;