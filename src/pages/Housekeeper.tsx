import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Check, Clock, Bed, AlertCircle, Play, MessageSquare } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Room } from '@/services/pdfService';

export default function Housekeeper() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [housekeeperName, setHousekeeperName] = useState('');
  const [selectedHousekeeper, setSelectedHousekeeper] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [remarkText, setRemarkText] = useState('');
  const [remarkRoomNumber, setRemarkRoomNumber] = useState('');

  // Liste des femmes de chambre disponibles
  const housekeepers = ['Marie', 'Sophie', 'Julie', 'Amélie', 'Claire'];

  // Simuler des chambres assignées par femme de chambre
  const getRoomsForHousekeeper = (name: string): Room[] => {
    const roomsData: Record<string, Room[]> = {
      'Marie': [
        { number: '101', status: 'needs-cleaning', cleaningType: 'full', priority: 'high', floor: 1, isTwin: false, isUrgent: true },
        { number: '102', status: 'needs-cleaning', cleaningType: 'quick', priority: 'medium', floor: 1, isTwin: true, isUrgent: false },
      ],
      'Sophie': [
        { number: '103', status: 'needs-cleaning', cleaningType: 'full', priority: 'medium', floor: 1, isTwin: false, isUrgent: false },
        { number: '205', status: 'needs-cleaning', cleaningType: 'quick', priority: 'high', floor: 2, isTwin: true, isUrgent: true },
      ],
      'Julie': [
        { number: '201', status: 'needs-cleaning', cleaningType: 'full', priority: 'medium', floor: 2, isTwin: false, isUrgent: false },
        { number: '304', status: 'needs-cleaning', cleaningType: 'quick', priority: 'high', floor: 3, isTwin: true, isUrgent: false },
      ],
      'Amélie': [
        { number: '301', status: 'needs-cleaning', cleaningType: 'full', priority: 'high', floor: 3, isTwin: false, isUrgent: true },
      ],
      'Claire': [
        { number: '105', status: 'needs-cleaning', cleaningType: 'quick', priority: 'medium', floor: 1, isTwin: true, isUrgent: false },
        { number: '203', status: 'needs-cleaning', cleaningType: 'full', priority: 'medium', floor: 2, isTwin: false, isUrgent: false },
      ],
    };
    return roomsData[name] || [];
  };

  const handleHousekeeperLogin = () => {
    if (selectedHousekeeper) {
      setHousekeeperName(selectedHousekeeper);
      setRooms(getRoomsForHousekeeper(selectedHousekeeper));
      setIsLoggedIn(true);
    }
  };

  const updateRoomStatus = (roomNumber: string, newStatus: string) => {
    setRooms(prev => prev.map(room => 
      room.number === roomNumber 
        ? { ...room, status: newStatus }
        : room
    ));
    
    const statusMessages = {
      'clean': 'Chambre marquée comme nettoyée !',
      'in-progress': 'Nettoyage en cours',
      'needs-attention': 'Remarque signalée'
    };
    
    toast({
      title: statusMessages[newStatus as keyof typeof statusMessages] || 'Statut mis à jour',
      description: `Chambre ${roomNumber}`,
    });
  };

  const handleRemark = () => {
    if (remarkText.trim()) {
      updateRoomStatus(remarkRoomNumber, 'needs-attention');
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
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'clean': return 'Nettoyée';
      case 'in-progress': return 'En cours';
      case 'needs-attention': return 'Remarque';
      default: return 'À nettoyer';
    }
  };

  // Écran de sélection de la femme de chambre
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-secondary p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-2xl">Interface Mobile</CardTitle>
            <p className="text-center text-muted-foreground">Sélectionnez votre nom</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedHousekeeper} onValueChange={setSelectedHousekeeper}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une femme de chambre" />
              </SelectTrigger>
              <SelectContent>
                {housekeepers.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button 
              onClick={handleHousekeeperLogin}
              disabled={!selectedHousekeeper}
              className="w-full bg-gradient-primary"
              size="lg"
            >
              Accéder à mon planning
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingRooms = rooms.filter(room => room.status === 'needs-cleaning');
  const inProgressRooms = rooms.filter(room => room.status === 'in-progress');
  const completedRooms = rooms.filter(room => room.status === 'clean');
  const remarkRooms = rooms.filter(room => room.status === 'needs-attention');

  return (
    <div className="min-h-screen bg-gradient-secondary p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bonjour {housekeeperName} !</h1>
            <p className="text-muted-foreground">Votre planning aujourd'hui</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setIsLoggedIn(false)}
            size="sm"
          >
            Changer
          </Button>
        </div>
        
        {/* Barre de progression */}
        <div className="grid grid-cols-4 gap-2 text-center text-sm mb-4">
          <div>
            <div className="font-semibold text-orange-600">{pendingRooms.length}</div>
            <div className="text-muted-foreground">À faire</div>
          </div>
          <div>
            <div className="font-semibold text-yellow-600">{inProgressRooms.length}</div>
            <div className="text-muted-foreground">En cours</div>
          </div>
          <div>
            <div className="font-semibold text-green-600">{completedRooms.length}</div>
            <div className="text-muted-foreground">Terminées</div>
          </div>
          <div>
            <div className="font-semibold text-red-600">{remarkRooms.length}</div>
            <div className="text-muted-foreground">Remarques</div>
          </div>
        </div>
        
        <div className="w-full bg-muted rounded-full h-2">
          <div 
            className="bg-gradient-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${(completedRooms.length / rooms.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Chambres à nettoyer */}
      <div className="space-y-4">
        {rooms.map((room) => (
          <Card key={room.number} className="card-modern">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Chambre {room.number}</CardTitle>
                <div className="flex gap-2">
                  <Badge className={getStatusColor(room.status)}>
                    {getStatusText(room.status)}
                  </Badge>
                  {room.isUrgent && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Urgent
                    </Badge>
                  )}
                  {room.isTwin && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Bed className="h-3 w-3" />
                      Twin
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Type de nettoyage:</span>
                <Badge className={getCleaningTypeColor(room.cleaningType)}>
                  {getCleaningTypeText(room.cleaningType)}
                </Badge>
              </div>
              
              {room.status === 'needs-cleaning' && (
                <div className="grid grid-cols-1 gap-2">
                  <Button
                    onClick={() => updateRoomStatus(room.number, 'in-progress')}
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
                    size="sm"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Commencer le nettoyage
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => updateRoomStatus(room.number, 'clean')}
                      className="bg-green-600 hover:bg-green-700 text-white"
                      size="sm"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Nettoyée
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50"
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
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => updateRoomStatus(room.number, 'clean')}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    size="sm"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Terminée
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50"
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
              )}
              
              {room.status === 'clean' && (
                <div className="text-center py-2">
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <Check className="h-5 w-5" />
                    <span className="font-medium">Chambre nettoyée</span>
                  </div>
                </div>
              )}
              
              {room.status === 'needs-attention' && (
                <div className="text-center py-2">
                  <div className="flex items-center justify-center gap-2 text-red-600">
                    <MessageSquare className="h-5 w-5" />
                    <span className="font-medium">Remarque signalée</span>
                  </div>
                  <Button
                    onClick={() => updateRoomStatus(room.number, 'needs-cleaning')}
                    variant="outline"
                    size="sm"
                    className="mt-2"
                  >
                    Remettre en attente
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        
        {rooms.length === 0 && (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Aucune chambre assignée
            </h3>
            <p className="text-muted-foreground">
              Votre planning est vide pour aujourd'hui.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}