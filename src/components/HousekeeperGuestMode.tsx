import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, Clock, Home, LogOut } from 'lucide-react';
import { useRoomCleaningActions } from '@/hooks/use-room-cleaning-actions';

interface Room {
  number: string;
  status: 'to_clean' | 'in_progress' | 'completed';
  priority: 'normal' | 'high' | 'urgent';
  notes?: string;
}

interface GuestModeProps {
  accessCode: string;
}

export const HousekeeperGuestMode: React.FC<GuestModeProps> = ({ accessCode }) => {
  const [hotel, setHotel] = useState<any>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [housekeeperName, setHousekeeperName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  const { startCleaning, finishCleaning, isLoading: cleaningActionLoading } = useRoomCleaningActions({
    hotelId: hotel?.id || '',
    housekeeperName
  });

  useEffect(() => {
    loadGuestModeData();
  }, [accessCode]);

  const loadGuestModeData = async () => {
    try {
      // Get access code info
      const { data: codeData } = await supabase
        .from('housekeeper_access_codes')
        .select(`
          *,
          hotels (
            id,
            name,
            hotel_code,
            address
          )
        `)
        .eq('access_code', accessCode)
        .eq('is_active', true)
        .single();

      if (!codeData) {
        toast({
          title: "Code invalide",
          description: "Code d'accès non trouvé ou expiré",
          variant: "destructive"
        });
        return;
      }

      setHotel(codeData.hotels);
      setHousekeeperName(codeData.invited_name || 'Invité');

      // Get room assignments (mock data for now - replace with real room assignment logic)
      const mockRooms: Room[] = [
        { number: '101', status: 'to_clean', priority: 'normal' },
        { number: '102', status: 'to_clean', priority: 'high', notes: 'Départ tardif client VIP' },
        { number: '103', status: 'in_progress', priority: 'normal' },
        { number: '201', status: 'to_clean', priority: 'urgent', notes: 'Arrivée immédiate' },
        { number: '202', status: 'completed', priority: 'normal' },
      ];

      setRooms(mockRooms);
    } catch (error) {
      console.error('Error loading guest mode data:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateRoomStatus = async (roomNumber: string, newStatus: Room['status']) => {
    // Log the cleaning action before updating UI
    if (newStatus === 'in_progress') {
      await startCleaning(roomNumber);
    } else if (newStatus === 'completed') {
      await finishCleaning(roomNumber);
    }

    setRooms(prev => prev.map(room => 
      room.number === roomNumber 
        ? { ...room, status: newStatus }
        : room
    ));

    toast({
      title: "Statut mis à jour",
      description: `Chambre ${roomNumber} : ${newStatus === 'completed' ? 'terminée' : newStatus === 'in_progress' ? 'en cours' : 'à nettoyer'}`
    });
  };

  const getRoomStatusColor = (status: Room['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'to_clean': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: Room['priority']) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'normal': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const completedRooms = rooms.filter(r => r.status === 'completed').length;
  const totalRooms = rooms.length;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Chargement...</div>
      </div>
    );
  }

  if (!hotel) {
    return <Navigate to="/housekeeper/auth" replace />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Home className="h-6 w-6" />
            {hotel.name}
          </h1>
          <p className="text-muted-foreground">
            Bonjour {housekeeperName} • Mode Invité • {hotel.address}
          </p>
        </div>
        <Button variant="outline" onClick={() => window.location.href = '/housekeeper/auth'}>
          <LogOut className="h-4 w-4 mr-2" />
          Quitter
        </Button>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Progression du jour</h3>
            <Badge variant="outline" className="text-lg px-3 py-1">
              {completedRooms} / {totalRooms}
            </Badge>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-green-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${totalRooms > 0 ? (completedRooms / totalRooms) * 100 : 0}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {completedRooms === totalRooms ? 'Toutes les chambres terminées !' : `${totalRooms - completedRooms} chambres restantes`}
          </p>
        </CardContent>
      </Card>

      {/* Room List */}
      <Card>
        <CardHeader>
          <CardTitle>Chambres assignées</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {rooms.map(room => (
              <div
                key={room.number}
                className={`p-4 rounded-lg border-2 ${getRoomStatusColor(room.status)}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold">Chambre {room.number}</span>
                      <Badge className={getPriorityColor(room.priority)}>
                        {room.priority === 'urgent' ? 'Urgent' : 
                         room.priority === 'high' ? 'Prioritaire' : 'Normal'}
                      </Badge>
                    </div>
                    {room.notes && (
                      <p className="text-sm text-muted-foreground mt-1">
                        📝 {room.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {room.status === 'to_clean' && (
                      <Button 
                        onClick={() => updateRoomStatus(room.number, 'in_progress')}
                        variant="outline"
                        disabled={cleaningActionLoading}
                      >
                        Commencer
                      </Button>
                    )}
                    {room.status === 'in_progress' && (
                      <Button 
                        onClick={() => updateRoomStatus(room.number, 'completed')}
                        className="bg-green-600 hover:bg-green-700"
                        disabled={cleaningActionLoading}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Terminer
                      </Button>
                    )}
                    {room.status === 'completed' && (
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="h-5 w-5 mr-2" />
                        Terminée
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};