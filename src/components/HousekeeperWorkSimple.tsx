import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, Clock, Home, LogOut, Building2, MapPin, User } from 'lucide-react';
import { HousekeeperAuthService } from '@/services/housekeeperAuthService';

interface Room {
  id: string;
  room_number: string;
  status: string;
  notes?: string;
  cleaning_priority: number;
}

export const HousekeeperWorkSimple: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [hotel, setHotel] = useState<any>(null);
  const [housekeeper, setHousekeeper] = useState<any>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const accessCode = searchParams.get('access_code');
  const hotelId = searchParams.get('hotel');
  const housekeeperName = searchParams.get('name') || 'Femme de chambre';

  useEffect(() => {
    if (accessCode && hotelId) {
      loadWorkData();
    } else {
      toast({
        title: "Paramètres manquants",
        description: "Code d'accès ou hôtel non spécifié",
        variant: "destructive"
      });
      navigate('/housekeeper/auth');
    }
  }, [accessCode, hotelId]);

  const loadWorkData = async () => {
    try {
      // Vérifier l'authentification avec le code
      const authResult = await HousekeeperAuthService.authenticateWithFullCode(accessCode!);
      
      if (!authResult.success) {
        toast({
          title: "Code invalide",
          description: authResult.error || "Code d'accès non valide",
          variant: "destructive"
        });
        navigate('/housekeeper/auth');
        return;
      }

      setHotel(authResult.hotel);
      setHousekeeper(authResult.user);

      // Charger les assignations de cette femme de chambre
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select(`
          *,
          rooms (
            id,
            room_number,
            status,
            notes,
            cleaning_priority
          )
        `)
        .eq('hotel_id', hotelId)
        .eq('housekeeper_id', authResult.user?.id || authResult.user?.access_code)
        .in('status', ['assigned', 'in_progress'])
        .order('created_at', { ascending: false });

      if (assignmentsError) {
        console.error('Erreur chargement assignations:', assignmentsError);
        // Fallback: afficher toutes les chambres en attente
        loadAllPendingRooms();
      } else {
        setAssignments(assignmentsData || []);
        const roomsList = (assignmentsData || [])
          .map(a => a.rooms)
          .filter(Boolean);
        setRooms(roomsList);
      }

    } catch (error) {
      console.error('Erreur chargement données travail:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données de travail",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllPendingRooms = async () => {
    // Fallback: charger toutes les chambres à nettoyer
    const { data: roomsData, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('hotel_id', hotelId)
      .in('status', ['dirty', 'to_clean'])
      .order('room_number');

    if (!error && roomsData) {
      setRooms(roomsData);
    }
  };

  const updateRoomStatus = async (roomId: string, newStatus: string) => {
    try {
      // Mettre à jour le statut de la chambre
      const { error: roomError } = await supabase
        .from('rooms')
        .update({ 
          status: newStatus,
          last_cleaned_at: newStatus === 'clean' ? new Date().toISOString() : null
        })
        .eq('id', roomId);

      if (roomError) {
        toast({
          title: "Erreur",
          description: "Impossible de mettre à jour le statut",
          variant: "destructive"
        });
        return;
      }

      // Mettre à jour l'assignation si elle existe
      const assignment = assignments.find(a => a.rooms?.id === roomId);
      if (assignment) {
        const { error: assignmentError } = await supabase
          .from('assignments')
          .update({ 
            status: newStatus === 'clean' ? 'completed' : 'in_progress',
            started_at: newStatus === 'in_progress' ? new Date().toISOString() : assignment.started_at,
            completed_at: newStatus === 'clean' ? new Date().toISOString() : null
          })
          .eq('id', assignment.id);

        if (assignmentError) {
          console.error('Erreur mise à jour assignation:', assignmentError);
        }
      }

      // Mettre à jour l'état local
      setRooms(prev => prev.map(room => 
        room.id === roomId 
          ? { ...room, status: newStatus }
          : room
      ));

      // Log d'activité
      await supabase
        .from('activities')
        .insert({
          hotel_id: hotelId,
          entity_type: 'room',
          entity_id: roomId,
          activity_type: 'room_status_update',
          actor_name: housekeeperName,
          actor_type: 'housekeeper',
          details: {
            room_number: rooms.find(r => r.id === roomId)?.room_number,
            new_status: newStatus,
            access_code: accessCode
          }
        });

      const statusText = newStatus === 'clean' ? 'terminée' : 
                        newStatus === 'in_progress' ? 'en cours' : 'à nettoyer';
      
      toast({
        title: "Statut mis à jour",
        description: `Chambre ${rooms.find(r => r.id === roomId)?.room_number} : ${statusText}`
      });

    } catch (error) {
      console.error('Erreur mise à jour statut:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue",
        variant: "destructive"
      });
    }
  };

  const handleLogout = () => {
    navigate('/housekeeper/auth');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="p-6 text-center">
          <div className="animate-pulse">Chargement...</div>
        </Card>
      </div>
    );
  }

  const completedRooms = rooms.filter(r => r.status === 'clean').length;
  const totalRooms = rooms.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                {hotel?.name}
              </h1>
              <p className="text-gray-600 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {hotel?.address || 'Adresse non spécifiée'}
              </p>
            </div>
          </div>
          
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        {/* Session Info */}
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <p className="font-medium text-blue-800">Connecté en tant que</p>
                <p className="text-sm text-blue-600">{housekeeperName}</p>
              </div>
              <div>
                <p className="font-medium text-blue-800">Code d'accès</p>
                <p className="text-sm font-mono text-blue-600">{accessCode}</p>
              </div>
            </div>
            <Badge variant="default" className="bg-green-100 text-green-800">
              <CheckCircle className="h-4 w-4 mr-1" />
              Connecté
            </Badge>
          </div>
        </Card>
      </div>

      {/* Progress */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Progression</h3>
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
            {completedRooms === totalRooms && totalRooms > 0 
              ? 'Toutes les chambres terminées !' 
              : `${totalRooms - completedRooms} chambres restantes`}
          </p>
        </CardContent>
      </Card>

      {/* Room List */}
      <Card>
        <CardHeader>
          <CardTitle>Mes chambres assignées</CardTitle>
        </CardHeader>
        <CardContent>
          {rooms.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">
                Aucune chambre assignée
              </h3>
              <p className="text-gray-500">
                En attente d'assignation par l'administrateur
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {rooms.map(room => (
                <div
                  key={room.id}
                  className={`p-4 rounded-lg border-2 ${
                    room.status === 'clean' 
                      ? 'bg-green-100 text-green-800 border-green-200'
                      : room.status === 'in_progress'
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : 'bg-gray-100 text-gray-800 border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold">Chambre {room.room_number}</span>
                         <Badge className={
                           room.cleaning_priority === 3 ? 'bg-red-100 text-red-800' :
                           room.cleaning_priority === 2 ? 'bg-orange-100 text-orange-800' :
                           'bg-gray-100 text-gray-800'
                         }>
                           {room.cleaning_priority === 3 ? 'Urgent' : 
                            room.cleaning_priority === 2 ? 'Prioritaire' : 'Normal'}
                         </Badge>
                         <Badge variant="outline" className={
                           room.status === 'to_clean' || room.status === 'dirty' 
                             ? 'bg-blue-100 text-blue-800 border-blue-300' 
                             : 'bg-gray-100 text-gray-800'
                         }>
                           {room.status === 'to_clean' || room.status === 'dirty' 
                             ? '🧹 À blanc' 
                             : '🛏️ Recouche'}
                         </Badge>
                      </div>
                      {room.notes && (
                        <p className="text-sm text-muted-foreground mt-1">
                          📝 {room.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {room.status === 'dirty' && (
                        <Button 
                          onClick={() => updateRoomStatus(room.id, 'in_progress')}
                          variant="outline"
                        >
                          Commencer
                        </Button>
                      )}
                      {room.status === 'in_progress' && (
                        <Button 
                          onClick={() => updateRoomStatus(room.id, 'clean')}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Terminer
                        </Button>
                      )}
                      {room.status === 'clean' && (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
};