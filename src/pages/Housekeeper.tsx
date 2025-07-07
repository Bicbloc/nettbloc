import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Clock, Bed, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Room } from '@/services/pdfService';

export default function Housekeeper() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [housekeeperName, setHousekeeperName] = useState('');

  // Simuler des chambres assignées (à remplacer par Supabase plus tard)
  useEffect(() => {
    const mockRooms: Room[] = [
      { number: '101', status: 'needs-cleaning', cleaningType: 'full', priority: 'high', floor: 1, isTwin: false, isUrgent: true },
      { number: '102', status: 'needs-cleaning', cleaningType: 'quick', priority: 'medium', floor: 1, isTwin: true, isUrgent: false },
      { number: '103', status: 'needs-cleaning', cleaningType: 'full', priority: 'medium', floor: 1, isTwin: false, isUrgent: false },
      { number: '205', status: 'needs-cleaning', cleaningType: 'quick', priority: 'high', floor: 2, isTwin: true, isUrgent: true },
    ];
    setRooms(mockRooms);
    setHousekeeperName('Marie'); // Nom de la femme de chambre connectée
  }, []);

  const markAsClean = (roomNumber: string) => {
    setRooms(prev => prev.map(room => 
      room.number === roomNumber 
        ? { ...room, status: 'clean', cleaningType: 'none' }
        : room
    ));
    
    toast({
      title: "Chambre nettoyée !",
      description: `La chambre ${roomNumber} a été marquée comme propre.`,
    });
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

  const pendingRooms = rooms.filter(room => room.status === 'needs-cleaning');
  const completedRooms = rooms.filter(room => room.status === 'clean');

  return (
    <div className="min-h-screen bg-gradient-secondary p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bonjour {housekeeperName} !</h1>
            <p className="text-muted-foreground">Vos chambres à nettoyer aujourd'hui</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Progression</div>
            <div className="text-2xl font-bold text-primary">
              {completedRooms.length}/{rooms.length}
            </div>
          </div>
        </div>
        
        {/* Barre de progression */}
        <div className="w-full bg-muted rounded-full h-2">
          <div 
            className="bg-gradient-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${(completedRooms.length / rooms.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Chambres à nettoyer */}
      <div className="space-y-4 mb-6">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Clock className="h-5 w-5" />
          À nettoyer ({pendingRooms.length})
        </h2>
        
        {pendingRooms.map((room) => (
          <Card key={room.number} className="card-modern">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Chambre {room.number}</CardTitle>
                <div className="flex gap-2">
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
              
              <Button
                onClick={() => markAsClean(room.number)}
                className="w-full btn-modern bg-gradient-primary hover:bg-gradient-primary/90"
                size="lg"
              >
                <Check className="h-5 w-5 mr-2" />
                Marquer comme nettoyée
              </Button>
            </CardContent>
          </Card>
        ))}
        
        {pendingRooms.length === 0 && (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Félicitations !
            </h3>
            <p className="text-muted-foreground">
              Toutes vos chambres ont été nettoyées.
            </p>
          </div>
        )}
      </div>

      {/* Chambres terminées */}
      {completedRooms.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            Terminées ({completedRooms.length})
          </h2>
          
          {completedRooms.map((room) => (
            <Card key={room.number} className="bg-green-50 border-green-200">
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <Check className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="font-medium">Chambre {room.number}</span>
                  </div>
                  <Badge variant="outline" className="bg-green-100 text-green-800">
                    Nettoyée
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}